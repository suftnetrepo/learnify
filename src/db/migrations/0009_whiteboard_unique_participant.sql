-- One participant row per (session, user). Milestone 3 code already avoids duplicates;
-- this makes it a database guarantee. Fails if duplicate rows already exist.
ALTER TABLE "whiteboard_participants"
  ADD CONSTRAINT "uq_wb_participant_session_user"
  UNIQUE ("session_id", "user_id");
