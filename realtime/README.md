# Edquis realtime server

Socket.IO server for **live whiteboard classrooms**. It holds the authoritative state of each live
board in memory, relays drawing, cursors and permission changes between participants, and writes the
board back to Postgres.

It can run **inside the Next.js process** (the default: one server, one port; see below) or as a
**standalone service**. Either way it shares the app's database and a JWT secret: the Next.js app
issues join tokens, and this code verifies them and enforces who may draw.

See [`docs/whiteboard.md`](../docs/whiteboard.md) for the whole feature, including the HTTP API.

## Running inside Next.js (recommended for single-server deployments)

`server.ts` at the repo root is a [custom Next.js server](https://nextjs.org/docs/app/guides/custom-server).
It creates one HTTP server, lets Next.js handle pages and API routes, and attaches this Socket.IO
server to the same server via `attachSocketIO()` from `src/index.ts`. Socket.IO answers on
`/socket.io/`; everything else goes to Next.js, including Next's own WebSocket upgrades (dev hot reload).

From the repo root:

```bash
yarn dev                 # tsx server.ts: Next.js dev server + Socket.IO on :3000
yarn build && yarn start # tsc -p tsconfig.server.json && next build; then node dist/server.js
```

- Expected output: `[realtime] Socket.IO attached (…)` then `> Ready on http://localhost:3000`.
- The realtime code is compiled with the root `tsconfig.server.json` into `dist/realtime/src/`, and
  its runtime dependencies (`socket.io`, `pg`, `jsonwebtoken`, `zod`) are root dependencies too, so a
  root `yarn install` is all a host needs.
- Configuration comes from the app's environment (`.env.local` locally). `NEXT_PUBLIC_REALTIME_URL`
  can be left unset; the client then connects to the page's own origin.
- If `WHITEBOARD_JWT_SECRET` is missing, a warning is logged and live classrooms are disabled; the
  rest of the site still runs.
- `next dev` / `next start` still work for the site alone, without live classrooms.

The standalone mode below remains for realtime-only testing, or for deploying it separately later.

## Standalone mode: local development

**Prerequisites:** Node.js 20+ (22.12+ to run the tests), Yarn 1, and the Postgres database the
Next.js app uses, with migrations through `0009` applied.

```bash
cd realtime
cp .env.example .env      # then fill in DATABASE_URL and WHITEBOARD_JWT_SECRET
yarn
yarn dev
```

Expected output:

```
[realtime] listening on :4000 (CORS: http://localhost:3000)
```

Check it's up: `curl localhost:4000/healthz` → `{"ok":true,"rooms":0}`.

In the Next.js app's `.env.local`, set the same `WHITEBOARD_JWT_SECRET` and
`NEXT_PUBLIC_REALTIME_URL=http://localhost:4000`, then open a whiteboard as a tutor and click
**Start Live Session**.

| Script       | What it does                                    |
|--------------|-------------------------------------------------|
| `yarn dev`   | Runs `src/index.ts` with ts-node, loading `.env` |
| `yarn build` | Compiles to `dist/`                             |
| `yarn start` | Runs `dist/index.js` (env from the host)        |
| `yarn test`  | Vitest unit tests (`src/__tests__/`)            |

## Environment variables

| Variable                | Required | Default                 | Purpose |
|-------------------------|----------|-------------------------|---------|
| `DATABASE_URL`          | yes      | —                       | Same Postgres database as the Next.js app. |
| `WHITEBOARD_JWT_SECRET` | yes      | —                       | Verifies join tokens. **Must match the Next.js app.** The server refuses to start without it. |
| `REALTIME_CORS_ORIGIN`  | standalone prod | `NEXT_PUBLIC_APP_URL`, else `http://localhost:3000` | Browser origins allowed to connect, comma-separated (e.g. `https://edquis.com,https://www.edquis.com`). Not needed inside Next.js, where connections are same-origin. |
| `REALTIME_PORT`         | no       | `PORT`, else `4000`     | Standalone only: listen port. Inside Next.js everything uses the app's `PORT`. |

Tuning (optional): `REALTIME_FLUSH_MS` (default 30000), `REALTIME_EMPTY_ROOM_GRACE_MS` (60000),
`REALTIME_DB_POOL_MAX` (5).

## How rooms work

- **One room per live session** (`whiteboard_sessions.id`). It's created in memory when the first
  participant joins, loaded from the whiteboard's saved scene.
- **Connecting.** The client passes a JWT in `socket.handshake.auth.token`. The server verifies the
  signature and expiry, and checks the session exists and is `active`.
- **Joining.** The participant's role and `canEdit` are read from `whiteboard_participants` on every
  join. Nothing in the token or the client's messages is trusted for permissions.
- **The server is authoritative.** Clients send only changed elements. An element is accepted if it's
  new or its `version` is strictly higher than the stored one. Losers are sent the server's copy so
  they converge (`src/reconcile.ts`). Viewers' updates are rejected outright.
- **Saving.** Every 30 s, if anything changed, the room writes its scene to `whiteboards.scene_data`
  (bumping `version`) and records a `periodic` snapshot (last 20 kept). The same tick picks up
  changes made through the Next.js API: a session ended by `DELETE`, or drawing access changed by
  the participants `PATCH`.
- **Ending.** When the host ends the session, the final scene goes to
  `whiteboard_sessions.final_scene_data` and the whiteboard, a `session_end` snapshot is taken,
  everyone receives `session:ended`, and the room closes.
- **Empty rooms** are kept for 60 s (so a quick reconnect doesn't reload from the database), then
  saved and closed.
- **Reconnecting** clients get the current server state (`room:state`); events aren't replayed.
- **Shutdown** (`SIGTERM`/`SIGINT`) saves every open room before exiting, so deploys don't lose work.
  Inside Next.js this also stops the web server, since both share the process.

### Events

| Client → server   | Who        | Purpose |
|-------------------|------------|---------|
| `join`            | anyone     | Enter the room; replies with `room:state` |
| `elements:update` | `canEdit`  | `{ elements }`, changed elements only |
| `cursor:move`     | anyone     | `{ x, y }` in scene coordinates; broadcast at most every 50 ms |
| `permission:set`  | host       | `{ userId, canEdit }` |
| `session:end`     | host       | Save and close the session |

Server → client: `room:state`, `elements:patch`, `participant:joined`, `participant:left`,
`cursor:moved`, `permission:changed`, `session:ended`, `error` (`{ code, message }`).
The TypeScript contract is in `src/types.ts`, mirrored by hand in
`src/components/whiteboard/realtime-types.ts` in the Next.js app. Keep the two in sync.

## Deployment

Rooms live in memory and hold WebSocket connections open, so this needs a **long-running Node
host**: Render (web service), Fly.io, Railway, a VM or a container. Serverless platforms (Vercel
functions, AWS Lambda) **won't work**, and neither will deploying the Next.js app to Vercel while
expecting live classrooms.

### Single server (recommended)

One web service runs the whole app. On Render:

| Setting | Value |
|---------|-------|
| Build command | `yarn install --frozen-lockfile && yarn build` |
| Start command | `yarn start` (sets `NODE_ENV=production`) |
| Health check path | `/` (or any public page) |
| Environment | The app's usual variables, plus `WHITEBOARD_JWT_SECRET` and `NEXT_PUBLIC_REALTIME_URL=https://<your-app>.onrender.com` |

`NEXT_PUBLIC_REALTIME_URL` is read at build time, so set it before the first build.

### Standalone service

```bash
cd realtime
yarn install --frozen-lockfile && yarn build   # build command
yarn start                                     # start command
```

- Health check path: `/healthz`.
- Set the environment variables above. `REALTIME_CORS_ORIGIN` must list the production site's
  origin(s).
- Database connections: up to `REALTIME_DB_POOL_MAX` (5) per instance. With Neon/Supabase, use
  the pooled connection string.
- Allow a graceful-shutdown window of about 10 s so rooms are saved on deploy.

**Sizing.** One small instance (512 MB) comfortably handles typical school usage: dozens of
concurrent classrooms of around 30 participants each. Memory per room is roughly the size of the
board's scene.

**Scaling past one instance.** Rooms live in a single process's memory, so every participant of a
session must reach the same instance. Running more than one needs:

1. Sticky sessions at the load balancer (Socket.IO's HTTP long-polling fallback needs them anyway), and
2. The [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/) for cross-instance
   broadcasts, **plus** routing each session to one owning instance (e.g. by hashing `sessionId`),
   because room state itself isn't shared.

Until then, run exactly one instance.

## Connecting the Next.js app

Inside Next.js, `NEXT_PUBLIC_REALTIME_URL` is the app's own URL (or unset, meaning same-origin).
For a standalone deployment, set these in the Next.js app's environment **before running
`next build`**:

| Variable                   | Value |
|----------------------------|-------|
| `NEXT_PUBLIC_REALTIME_URL` | Public URL of the realtime service, e.g. `https://realtime.edquis.com` |
| `WHITEBOARD_JWT_SECRET`    | Same value as the realtime service |

`NEXT_PUBLIC_REALTIME_URL` is inlined into the client bundle **and** added to the site's
Content-Security-Policy `connect-src` (http and ws forms) at build time. Changing it means
rebuilding the Next.js app, or browsers will block the connection.
