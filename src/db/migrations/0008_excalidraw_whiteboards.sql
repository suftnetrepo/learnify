-- Migration: 0008_excalidraw_whiteboards
-- Adds whiteboard tables for individual canvases and live collaborative classrooms.
-- Run with: npm run db:migrate (dev) or npm run db:migrate:live (production — requires approval)

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "whiteboard_mode" AS ENUM ('individual', 'classroom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "whiteboard_session_status" AS ENUM ('active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "whiteboard_participant_role" AS ENUM ('host', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── whiteboards ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "whiteboards" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"       varchar(200) NOT NULL DEFAULT 'Untitled Whiteboard',
  "mode"        "whiteboard_mode" NOT NULL DEFAULT 'individual',
  "course_id"   uuid REFERENCES "courses"("id") ON DELETE SET NULL,
  "lecture_id"  uuid,
  "scene_data"  jsonb,
  "version"     integer NOT NULL DEFAULT 1,
  "is_deleted"  boolean NOT NULL DEFAULT false,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "whiteboards_owner_idx"  ON "whiteboards" ("owner_id");
CREATE INDEX IF NOT EXISTS "whiteboards_course_idx" ON "whiteboards" ("course_id");
CREATE INDEX IF NOT EXISTS "whiteboards_mode_idx"   ON "whiteboards" ("mode");

-- ─── whiteboard_sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "whiteboard_sessions" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "whiteboard_id"     uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE CASCADE,
  "course_session_id" uuid REFERENCES "course_sessions"("id") ON DELETE SET NULL,
  "host_id"           uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"            "whiteboard_session_status" NOT NULL DEFAULT 'active',
  "final_scene_data"  jsonb,
  "started_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at"          timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "wb_sessions_whiteboard_idx"     ON "whiteboard_sessions" ("whiteboard_id");
CREATE INDEX IF NOT EXISTS "wb_sessions_course_session_idx" ON "whiteboard_sessions" ("course_session_id");
CREATE INDEX IF NOT EXISTS "wb_sessions_host_idx"           ON "whiteboard_sessions" ("host_id");
CREATE INDEX IF NOT EXISTS "wb_sessions_status_idx"         ON "whiteboard_sessions" ("status");

-- ─── whiteboard_participants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "whiteboard_participants" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id"   uuid NOT NULL REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"         "whiteboard_participant_role" NOT NULL DEFAULT 'viewer',
  "can_edit"     boolean NOT NULL DEFAULT false,
  "joined_at"    timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wb_participants_session_idx" ON "whiteboard_participants" ("session_id");
CREATE INDEX IF NOT EXISTS "wb_participants_user_idx"    ON "whiteboard_participants" ("user_id");

-- ─── whiteboard_snapshots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "whiteboard_snapshots" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "whiteboard_id"       uuid NOT NULL REFERENCES "whiteboards"("id") ON DELETE CASCADE,
  "whiteboard_version"  integer NOT NULL,
  "scene_data"          jsonb NOT NULL,
  "trigger"             varchar(50) NOT NULL DEFAULT 'periodic',
  "created_at"          timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wb_snapshots_whiteboard_idx" ON "whiteboard_snapshots" ("whiteboard_id");
CREATE INDEX IF NOT EXISTS "wb_snapshots_version_idx"    ON "whiteboard_snapshots" ("whiteboard_version");
