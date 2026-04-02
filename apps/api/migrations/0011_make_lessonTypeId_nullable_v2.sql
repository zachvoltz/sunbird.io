-- SQLite doesn't support ALTER COLUMN, so we need to recreate the tables
-- Make lessonTypeId nullable on Booking and RecurringSchedule

-- Clean up any partial previous attempt
DROP TABLE IF EXISTS "Booking_new";
DROP TABLE IF EXISTS "RecurringSchedule_new";

-- Booking: create new table with nullable lessonTypeId
CREATE TABLE "Booking_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT,
    "lessonTypeId" TEXT,
    "lessonCategoryId" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "mode" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "meetingUrl" TEXT,
    "meetingId" TEXT,
    "meetingProvider" TEXT,
    "studentNote" TEXT,
    "practiceNotes" TEXT,
    "practiceNotesSentAt" DATETIME,
    "completedAt" DATETIME,
    "stripePaymentId" TEXT,
    "usedSubscription" BOOLEAN NOT NULL DEFAULT false,
    "scheduleId" TEXT,
    "categoryId" TEXT,
    "skillTreeId" TEXT,
    "nodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "Booking_new" ("id", "userId", "coachId", "lessonTypeId", "lessonCategoryId", "startsAt", "endsAt", "status", "mode", "meetingUrl", "meetingId", "meetingProvider", "studentNote", "practiceNotes", "practiceNotesSentAt", "completedAt", "stripePaymentId", "usedSubscription", "scheduleId", "categoryId", "skillTreeId", "nodeId", "createdAt")
SELECT "id", "userId", "coachId", "lessonTypeId", "lessonCategoryId", "startsAt", "endsAt", COALESCE("status", 'CONFIRMED'), COALESCE("mode", 'IN_PERSON'), "meetingUrl", "meetingId", "meetingProvider", "studentNote", "practiceNotes", "practiceNotesSentAt", "completedAt", "stripePaymentId", COALESCE("usedSubscription", false), "scheduleId", "categoryId", "skillTreeId", "nodeId", "createdAt" FROM "Booking";

DROP TABLE "Booking";
ALTER TABLE "Booking_new" RENAME TO "Booking";

-- RecurringSchedule: create new table with nullable lessonTypeId
CREATE TABLE "RecurringSchedule_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "lessonTypeId" TEXT,
    "lessonCategoryId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "mode" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT,
    "skillTreeId" TEXT,
    "nodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringSchedule_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "RecurringSchedule_new" ("id", "userId", "coachId", "lessonTypeId", "lessonCategoryId", "dayOfWeek", "startTime", "frequency", "mode", "startsOn", "endsOn", "status", "categoryId", "skillTreeId", "nodeId", "createdAt")
SELECT "id", "userId", "coachId", "lessonTypeId", "lessonCategoryId", "dayOfWeek", "startTime", COALESCE("frequency", 'WEEKLY'), COALESCE("mode", 'IN_PERSON'), "startsOn", "endsOn", COALESCE("status", 'ACTIVE'), "categoryId", "skillTreeId", "nodeId", "createdAt" FROM "RecurringSchedule";

DROP TABLE "RecurringSchedule";
ALTER TABLE "RecurringSchedule_new" RENAME TO "RecurringSchedule";
