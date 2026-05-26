-- Date-specific coach busy blocks. Takes precedence over CoachAvailability
-- in the booking conflict check, so a coach can carve out vacations,
-- one-off appointments, etc. without touching their weekly schedule.
CREATE TABLE "CoachBusy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachBusy_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CoachBusy_coachId_startsAt_idx" ON "CoachBusy"("coachId", "startsAt");
