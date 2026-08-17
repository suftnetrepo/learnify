import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { invitationStatusEnum } from "./enums";
import { users } from "./users";

// ─── Tutor Invitations ────────────────────────────────────────────────────────
export const tutorInvitations = pgTable(
  "tutor_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    // Unique token embedded in the invitation link
    token: text("token").notNull().unique(),
    invitedById: uuid("invited_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Set once the invitee completes registration
    inviteeId: uuid("invitee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: invitationStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invitations_email_idx").on(table.email),
    index("invitations_token_idx").on(table.token),
    index("invitations_status_idx").on(table.status),
  ]
);

export const tutorInvitationsRelations = relations(
  tutorInvitations,
  ({ one }) => ({
    invitedBy: one(users, {
      fields: [tutorInvitations.invitedById],
      references: [users.id],
      relationName: "invitedBy",
    }),
    invitee: one(users, {
      fields: [tutorInvitations.inviteeId],
      references: [users.id],
      relationName: "invitee",
    }),
  })
);

export type TutorInvitation = typeof tutorInvitations.$inferSelect;
export type NewTutorInvitation = typeof tutorInvitations.$inferInsert;
