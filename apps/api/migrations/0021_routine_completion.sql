-- One row per (student, routine item, day) the student checks off on the
-- Practice path. routineItemId is the id inside the User.currentRoutine
-- JSON blob; `day` is UTC midnight so completions are scoped to a calendar
-- day. First completion of a day bumps PracticeStreak (handled in the API).
CREATE TABLE "RoutineCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "routineItemId" TEXT NOT NULL,
    "day" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoutineCompletion_userId_routineItemId_day_key" ON "RoutineCompletion"("userId", "routineItemId", "day");
CREATE INDEX "RoutineCompletion_userId_day_idx" ON "RoutineCompletion"("userId", "day");
