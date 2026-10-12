-- Optional external whiteboard link (Excalidraw, tldraw, Miro, …) shown to booked students
ALTER TABLE "course_sessions"
  ADD COLUMN "whiteboard_url" text;
