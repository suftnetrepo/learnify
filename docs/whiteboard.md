# Whiteboards

Edquis whiteboards are Excalidraw canvases in two forms:

- **Individual boards.** A personal canvas any user can create from **My Whiteboards**
  (`/dashboard/whiteboards` for students, `/instructor/whiteboards` for tutors and admins). It
  autosaves, keeps backup snapshots, and exports to PNG/SVG. A board can optionally be linked to a
  course and lecture.
- **Live classrooms.** A tutor turns a board into a real-time session that enrolled students join.
  The host controls who may draw, everyone sees each other's cursors, and the board is saved back
  when the session ends. Live sync is a Socket.IO server (`realtime/src`) that runs inside the
  Next.js process through the custom server `server.ts`; see [`realtime/README.md`](../realtime/README.md).

| Piece | Where |
|-------|-------|
| Schema | `src/db/schema/whiteboards.ts`, migrations `0008`, `0009` |
| Services | `src/services/whiteboard.service.ts`, `src/services/whiteboard-session.service.ts` |
| HTTP API | `src/app/api/whiteboards/**` |
| UI | `src/components/whiteboard/*`, pages under `(dashboard)/dashboard/whiteboards` and `(instructor)/instructor/whiteboards` |
| Realtime server | `realtime/src`, attached to Next.js by `server.ts` (compiled with `tsconfig.server.json`) |
| Tests | `src/__tests__/whiteboards/`, `realtime/src/__tests__/` |

## Database

### `whiteboards`

| Column | Purpose |
|--------|---------|
| `id` | UUID primary key |
| `owner_id` | Creator (FK `users`, cascade delete). Always taken from the session, never the request body. |
| `title` | Up to 200 characters, default "Untitled Whiteboard" |
| `mode` | `individual` (personal) or `classroom`. Boards are created as `individual`; a live session doesn't change the mode. |
| `course_id` | Optional course link (FK `courses`, set null on delete). Students may link courses they're enrolled in, tutors their assigned courses, admins any. |
| `lecture_id` | Optional lecture link. **No FK** (opaque reference); validated to belong to `course_id` when set. |
| `scene_data` | Excalidraw scene JSON (`elements`, `appState`, `files`), at most 10 MB |
| `version` | Optimistic-concurrency counter, bumped on every save (including realtime saves) |
| `is_deleted` | Soft-delete flag. Deleted boards are hidden everywhere. |
| `created_at`, `updated_at` | Timestamps; lists sort by `updated_at` |

### `whiteboard_sessions`: one live classroom

| Column | Purpose |
|--------|---------|
| `whiteboard_id` | The board being taught on (FK, cascade) |
| `course_session_id` | Optional link to a scheduled course session (cohort). Narrows which enrolled students may join. |
| `host_id` | The user who started it. Has full control. |
| `status` | `active` or `ended`. At most one active session per board (enforced with an advisory lock). |
| `final_scene_data` | Scene at the moment the host ended the session |
| `started_at`, `ended_at` | Timestamps |

### `whiteboard_participants`: who's been admitted to a session

| Column | Purpose |
|--------|---------|
| `session_id`, `user_id` | **Unique together** (constraint `uq_wb_participant_session_user`, migration `0009`) |
| `role` | `host`, `editor` (tutor, admin or board owner) or `viewer` (student). Derived by the server. |
| `can_edit` | Drawing permission. Viewers start `false`; the host can grant it. The realtime server reads this on join. |
| `joined_at`, `last_seen_at` | Timestamps |

### `whiteboard_snapshots`: backups

| Column | Purpose |
|--------|---------|
| `whiteboard_id` | Board (FK, cascade) |
| `whiteboard_version` | Board version the snapshot corresponds to |
| `scene_data` | Full scene |
| `trigger` | `periodic` (5 min in the editor, 30 s in live rooms, only when changed), `manual` (Save button) or `session_end` |

Only the newest 20 snapshots per board are kept. There's no restore UI yet. Snapshots are for
recovery by an engineer.

## Individual board flow

1. **Create.** "New Whiteboard" → `POST /api/whiteboards` → opens the editor.
2. **Load.** The editor page checks read access on the server, then the client fetches
   `GET /api/whiteboards/[id]` and gives `scene_data` to Excalidraw (empty canvas if null). Excalidraw
   only ever renders in the browser (`next/dynamic` with `ssr: false`).
3. **Autosave.** Edits are debounced 1.5 s (`NEXT_PUBLIC_WHITEBOARD_AUTOSAVE_MS`), then sent as
   `PATCH /api/whiteboards/[id]` with the version the client last saw. Scrolling and selecting don't
   count as edits. Saves are queued one at a time so a rename and a scene save can't conflict with
   each other.
4. **Conflicts.** If the board changed elsewhere (another tab or device, or a live session), the API
   returns **409** with the current version. Autosave pauses and the user chooses **Reload latest**
   or **Keep my changes**; nothing is silently overwritten.
5. **Snapshots.** Every 5 minutes while open (if changed), and on **Save**:
   `POST /api/whiteboards/[id]/snapshot`.
6. **Export.** PNG/SVG are rendered in the browser from the live canvas (Excalidraw's export needs
   a DOM). `GET /api/whiteboards/[id]/export` returns the scene JSON and a filename for the same
   reason.
7. **Manage.** Rename (inline), duplicate (`POST /api/whiteboards/[id]/duplicate`) and delete
   (soft, with optimistic removal) from the listing grid.

## Live classroom flow

```
Tutor: Start Live Session ──► POST /api/whiteboards/sessions            (create or resume)
Everyone: classroom page ───► POST /api/whiteboards/sessions            (resume → sessionId)
                              GET  /api/whiteboards/sessions/[id]        (title, roster)
                              POST /api/whiteboards/sessions/[id]/token  (role derived + participant row written)
                              Socket.IO connect { auth: { token } } ──► /socket.io/ (same server)
                              emit join ──► room:state (elements, roster, your role)
Drawing:                      elements:update ⇄ elements:patch, cursor:move ⇄ cursor:moved
Host:                         permission:set ──► permission:changed
                              session:end ──► final save + snapshot ──► session:ended
```

- **Starting.** Tutors and admins see **Start Live Session** in the editor header (**Rejoin
  Session** if one is running). Creating needs the board's owner, an admin, or a tutor assigned to
  the board's course. Calling create while a session is active returns that session.
- **Finding a session.** Your own boards with a live session show a **Join** badge. Sessions on
  other people's boards that you may join (e.g. your tutor's) appear under **Live now** on
  My Whiteboards.
- **Tokens** last 4 hours (HS256, `WHITEBOARD_JWT_SECRET`). The client requests a fresh one on
  every reconnect.
- **While a session runs**, the solo editor for that board is read-only, so its autosave can't fight
  the room's saves.
- **Connection states.** Amber "Reconnecting…" banner on disconnect; red banner with **Reload** after
  30 s. On reconnect the client takes the server state and re-sends only its own edits that are newer
  than the server's copy.
- **Ending.** In the room, the host's **End Session** goes through the socket (saves the final
  scene). `DELETE /api/whiteboards/sessions/[id]` (host or admin) also works; open rooms notice
  within 30 s.

## Deployment

The whole feature ships as **one web service**: `server.ts` serves Next.js and Socket.IO on the same
port.

| | |
|---|---|
| Build | `yarn build` (`tsc -p tsconfig.server.json && next build`) |
| Start | `yarn start` (`NODE_ENV=production node dist/server.js`) |
| Required env | `WHITEBOARD_JWT_SECRET`; `NEXT_PUBLIC_REALTIME_URL` = the app's own URL, set **before** building (it's inlined into the client and the CSP) |
| Host | Any long-running Node host (e.g. one Render web service). Not Vercel or other serverless platforms: they can't hold WebSockets or in-memory rooms. |

Without `WHITEBOARD_JWT_SECRET` the site runs normally with live classrooms disabled. Plain
`next start` also serves the site without them. The realtime server can still be deployed on its
own if ever needed; see the realtime README.

## Security model

- **Authentication.** Every API route calls `auth()` and returns 401 without a session. The user id
  and role always come from the session, never from the request.
- **Board ownership.**
  - **Read:** owner, any tutor, any admin.
  - **Write and delete:** owner or admin. Tutors can't modify another user's individual board; for
    `classroom`-mode boards they need editor access to its course.
  - **Snapshots:** owner only.
  - Requests for a board you can't read get **404**, not 403, so existence isn't revealed.
- **Course and lecture links** are checked against the caller's enrolments or assignments.
- **Size limit.** Scene bodies over 10 MB (`WHITEBOARD_MAX_SCENE_BYTES`) get **413**, checked
  before the JSON is parsed.
- **Live sessions:**
  - **Who may join** is decided server-side from the database. The host gets `host`; admins, the
    board owner and tutors assigned to the course get `editor`; enrolled students get `viewer`.
    When a course session is linked, their enrolment must be for that cohort or not tied to one.
    Anyone else gets 404.
  - **Tokens prove identity only.** The token route writes the participant row, and the realtime
    server re-reads role and `can_edit` from `whiteboard_participants` on every join. Role or edit
    flags in a token or message are never trusted.
  - **`canEdit` is enforced on the server.** `elements:update` from a participant without drawing
    access is rejected even if a modified client sends it. Only the host can change permissions or
    end the session, and the host's own access can't be revoked.
  - **Session state is checked** at connect and on every join. Ended or unknown sessions are refused.
- **CSP.** `connect-src` allows `https://esm.sh` (Excalidraw fonts) and the realtime origin from
  `NEXT_PUBLIC_REALTIME_URL`; `font-src` allows `https://esm.sh`.

**Deliberately broad, worth revisiting:** any tutor can *read* any user's individual board,
including students in courses they don't teach. This was the original requirement; narrowing it
to the tutor's own courses would be a small change in `WhiteboardService.canRead`.

## Known limitations

- **Images don't sync live.** Pasted images are stored inside the scene (`files`) and aren't sent
  through the realtime server, so other participants don't see them, and they inflate every
  autosave. Fix: upload images to Cloudinary (already used elsewhere) and store URLs.
- **One app instance.** Room state is in the web process's memory, so the app must run as a
  single instance. Scaling out needs sticky sessions, the Socket.IO Redis adapter and
  session-to-instance routing; see the realtime README. A redeploy restarts live rooms: they're
  saved on shutdown and clients reconnect, but expect a brief "Reconnecting…".
- **Not deployable to Vercel as-is.** The custom server needs a long-running host. (If the site
  ever moves to Vercel, run the realtime server standalone elsewhere. Vercel also caps request
  bodies at 4.5 MB, below the 10 MB scene limit.)
- **Excalidraw fonts load from esm.sh.** If that CDN is unreachable, text falls back to system fonts
  and SVG export may lack embedded fonts. Self-hosting means adding about 16 MB of font files.
- **No snapshot restore UI.**
- **`lecture_id` has no foreign key**, so deleting a lecture leaves boards pointing at it.
- **Event types are duplicated** between `realtime/src/types.ts` and
  `src/components/whiteboard/realtime-types.ts`, and must be kept in sync by hand.
