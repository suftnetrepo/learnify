import { Pool } from "pg";
import type { ParticipantRole } from "./types";

/** Same database as the Next.js app; queries mirror the Drizzle schema in src/db/schema/whiteboards.ts. */
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max:              Number(process.env.REALTIME_DB_POOL_MAX) || 5,
});

/** Snapshots kept per whiteboard — matches WhiteboardService in the Next.js app. */
const SNAPSHOTS_KEPT = 20;

export interface SessionRow { id: string; whiteboardId: string; hostId: string; status: "active" | "ended" }

export interface StoredScene {
  type?:     string;
  version?:  number;
  source?:   string;
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?:    Record<string, unknown>;
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT id, whiteboard_id AS "whiteboardId", host_id AS "hostId", status
       FROM whiteboard_sessions WHERE id = $1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function getWhiteboardScene(whiteboardId: string): Promise<StoredScene | null> {
  const { rows } = await pool.query<{ sceneData: StoredScene | null }>(
    `SELECT scene_data AS "sceneData" FROM whiteboards WHERE id = $1 AND is_deleted = false`,
    [whiteboardId],
  );
  return rows[0]?.sceneData ?? null;
}

export interface ParticipantRow { userId: string; name: string | null; role: ParticipantRole; canEdit: boolean }

export async function getParticipant(sessionId: string, userId: string): Promise<ParticipantRow | null> {
  const { rows } = await pool.query<ParticipantRow>(
    `SELECT p.user_id AS "userId", u.name, p.role, p.can_edit AS "canEdit"
       FROM whiteboard_participants p JOIN users u ON u.id = p.user_id
      WHERE p.session_id = $1 AND p.user_id = $2
      ORDER BY p.joined_at DESC LIMIT 1`,
    [sessionId, userId],
  );
  return rows[0] ?? null;
}

/** userId → canEdit for the whole session (picks up changes made through the Next.js API). */
export async function getPermissions(sessionId: string): Promise<Map<string, boolean>> {
  const { rows } = await pool.query<{ userId: string; canEdit: boolean }>(
    `SELECT user_id AS "userId", can_edit AS "canEdit" FROM whiteboard_participants WHERE session_id = $1`,
    [sessionId],
  );
  return new Map(rows.map((r) => [r.userId, r.canEdit]));
}

export async function setCanEdit(sessionId: string, userId: string, canEdit: boolean): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE whiteboard_participants SET can_edit = $3
      WHERE session_id = $1 AND user_id = $2 AND role <> 'host'`,
    [sessionId, userId, canEdit],
  );
  return (rowCount ?? 0) > 0;
}

export async function touchParticipant(sessionId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE whiteboard_participants SET last_seen_at = now() WHERE session_id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
}

/** Writes the scene and bumps the optimistic-concurrency version. Returns the new version. */
export async function saveWhiteboardScene(whiteboardId: string, scene: StoredScene): Promise<number | null> {
  const { rows } = await pool.query<{ version: number }>(
    `UPDATE whiteboards SET scene_data = $2, version = version + 1, updated_at = now()
      WHERE id = $1 AND is_deleted = false RETURNING version`,
    [whiteboardId, JSON.stringify(scene)],
  );
  return rows[0]?.version ?? null;
}

export async function saveSnapshot(
  whiteboardId: string, scene: StoredScene, trigger: "periodic" | "session_end", version: number,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO whiteboard_snapshots (whiteboard_id, whiteboard_version, scene_data, trigger)
       VALUES ($1, $2, $3, $4)`,
      [whiteboardId, version, JSON.stringify(scene), trigger],
    );
    await client.query(
      `DELETE FROM whiteboard_snapshots
        WHERE whiteboard_id = $1
          AND id NOT IN (SELECT id FROM whiteboard_snapshots WHERE whiteboard_id = $1
                          ORDER BY created_at DESC LIMIT $2)`,
      [whiteboardId, SNAPSHOTS_KEPT],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Marks the session ended with its final scene. False if it was already ended. */
export async function endSession(sessionId: string, scene: StoredScene): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE whiteboard_sessions SET status = 'ended', ended_at = now(), final_scene_data = $2
      WHERE id = $1 AND status = 'active'`,
    [sessionId, JSON.stringify(scene)],
  );
  return (rowCount ?? 0) > 0;
}
