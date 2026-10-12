import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";
import { courseSessions } from "./courseSessions";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const whiteboardModeEnum = pgEnum("whiteboard_mode", [
  "individual", // personal workspace — owner-only by default
  "classroom",  // live collaborative session linked to a course session
]);

export const whiteboardSessionStatusEnum = pgEnum("whiteboard_session_status", [
  "active",
  "ended",
]);

export const whiteboardParticipantRoleEnum = pgEnum("whiteboard_participant_role", [
  "host",    // tutor who started the room
  "editor",  // student or co-tutor with draw rights
  "viewer",  // student in read-only mode
]);

// ─── Whiteboards ──────────────────────────────────────────────────────────────
// Personal and classroom canvases. Scene data stored as JSON (Excalidraw format).
// Size limit enforced at the API layer (MAX_SCENE_BYTES).

export const whiteboards = pgTable(
  "whiteboards",
  {
    id:      uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 200 }).notNull().default("Untitled Whiteboard"),
    mode:  whiteboardModeEnum("mode").notNull().default("individual"),

    // Optional course / lecture association
    courseId:  uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    lectureId: uuid("lecture_id"), // no FK — lectures live in courseSections; stored as opaque ref

    // Excalidraw scene JSON blob.  Max 10 MB enforced at API layer.
    sceneData: jsonb("scene_data"),

    // Monotonically increasing version number — used for optimistic concurrency.
    version: integer("version").notNull().default(1),

    // Whether this whiteboard is soft-deleted
    isDeleted: boolean("is_deleted").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("whiteboards_owner_idx").on(t.ownerId),
    index("whiteboards_course_idx").on(t.courseId),
    index("whiteboards_mode_idx").on(t.mode),
  ]
);

export const whiteboardsRelations = relations(whiteboards, ({ one, many }) => ({
  owner:    one(users,   { fields: [whiteboards.ownerId],  references: [users.id] }),
  course:   one(courses, { fields: [whiteboards.courseId], references: [courses.id] }),
  sessions:   many(whiteboardSessions),
  snapshots:  many(whiteboardSnapshots),
}));

// ─── Whiteboard Sessions ──────────────────────────────────────────────────────
// A "room" that brings a whiteboard into a live collaborative classroom.
// Linked to an existing course session so enrollment can be verified.

export const whiteboardSessions = pgTable(
  "whiteboard_sessions",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    whiteboardId:  uuid("whiteboard_id")
      .notNull()
      .references(() => whiteboards.id, { onDelete: "cascade" }),

    // The Edquis course session this room is attached to
    courseSessionId: uuid("course_session_id")
      .references(() => courseSessions.id, { onDelete: "set null" }),

    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    status: whiteboardSessionStatusEnum("status").notNull().default("active"),

    // Scene state at session end — written when host ends the room
    finalSceneData: jsonb("final_scene_data"),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt:   timestamp("ended_at",   { withTimezone: true }),
  },
  (t) => [
    index("wb_sessions_whiteboard_idx").on(t.whiteboardId),
    index("wb_sessions_course_session_idx").on(t.courseSessionId),
    index("wb_sessions_host_idx").on(t.hostId),
    index("wb_sessions_status_idx").on(t.status),
  ]
);

export const whiteboardSessionsRelations = relations(whiteboardSessions, ({ one, many }) => ({
  whiteboard:    one(whiteboards,     { fields: [whiteboardSessions.whiteboardId],    references: [whiteboards.id] }),
  courseSession: one(courseSessions,  { fields: [whiteboardSessions.courseSessionId], references: [courseSessions.id] }),
  host:          one(users,           { fields: [whiteboardSessions.hostId],           references: [users.id] }),
  participants:  many(whiteboardParticipants),
}));

// ─── Whiteboard Participants ───────────────────────────────────────────────────
// Per-session roster.  Role and editing permission are set server-side;
// clients never supply these — they are derived from the user's enrollment
// and tutor assignment at join time.

export const whiteboardParticipants = pgTable(
  "whiteboard_participants",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => whiteboardSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role:          whiteboardParticipantRoleEnum("role").notNull().default("viewer"),
    canEdit:       boolean("can_edit").notNull().default(false),
    joinedAt:      timestamp("joined_at",  { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt:    timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("wb_participants_session_idx").on(t.sessionId),
    index("wb_participants_user_idx").on(t.userId),
  ]
);

export const whiteboardParticipantsRelations = relations(whiteboardParticipants, ({ one }) => ({
  session: one(whiteboardSessions, { fields: [whiteboardParticipants.sessionId], references: [whiteboardSessions.id] }),
  user:    one(users,              { fields: [whiteboardParticipants.userId],    references: [users.id] }),
}));

// ─── Whiteboard Snapshots ──────────────────────────────────────────────────────
// Versioned scene backups written periodically and at session end.
// Used for recovery — last good snapshot can be restored if the live scene
// becomes corrupted.

export const whiteboardSnapshots = pgTable(
  "whiteboard_snapshots",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    whiteboardId: uuid("whiteboard_id")
      .notNull()
      .references(() => whiteboards.id, { onDelete: "cascade" }),

    // Which version of the whiteboard this snapshot corresponds to
    whiteboardVersion: integer("whiteboard_version").notNull(),

    // Full Excalidraw scene blob at the time of snapshot
    sceneData: jsonb("scene_data").notNull(),

    // What triggered this snapshot
    trigger: varchar("trigger", { length: 50 }).notNull().default("periodic"),
    // 'periodic' | 'session_end' | 'manual'

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("wb_snapshots_whiteboard_idx").on(t.whiteboardId),
    index("wb_snapshots_version_idx").on(t.whiteboardVersion),
  ]
);

export const whiteboardSnapshotsRelations = relations(whiteboardSnapshots, ({ one }) => ({
  whiteboard: one(whiteboards, { fields: [whiteboardSnapshots.whiteboardId], references: [whiteboards.id] }),
}));
