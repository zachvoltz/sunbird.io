-- Routine columns added via prisma db push locally but never mirrored to
-- D1. User.currentRoutine holds the student's live routine (JSON); the
-- missing column was breaking every login (session.findUnique selects the
-- full User row). Booking.routineSnapshot stores the routine as set at the
-- end of a session for per-session history. Both are nullable JSON strings.
ALTER TABLE "User" ADD COLUMN "currentRoutine" TEXT;
ALTER TABLE "Booking" ADD COLUMN "routineSnapshot" TEXT;
