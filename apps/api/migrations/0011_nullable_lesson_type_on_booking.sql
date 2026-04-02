-- SQLite doesn't support ALTER COLUMN, so we recreate the table with lessonTypeId nullable.
-- This also makes lessonTypeId nullable on RecurringSchedule.

-- Step 1: Create new Booking table with nullable lessonTypeId
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
    "callSessionId" TEXT,
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
    CONSTRAINT "Booking_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_lessonTypeId_fkey" FOREIGN KEY ("lessonTypeId") REFERENCES "LessonType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_skillTreeId_fkey" FOREIGN KEY ("skillTreeId") REFERENCES "SkillTree" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_lessonCategoryId_fkey" FOREIGN KEY ("lessonCategoryId") REFERENCES "LessonCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RecurringSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 2: Copy data
INSERT INTO "Booking_new" SELECT
    "id", "userId", "coachId", "lessonTypeId", "lessonCategoryId",
    "startsAt", "endsAt", "status", "mode",
    "meetingUrl", "meetingId", "meetingProvider", "callSessionId",
    "studentNote", "practiceNotes", "practiceNotesSentAt", "completedAt",
    "stripePaymentId", "usedSubscription", "scheduleId",
    "categoryId", "skillTreeId", "nodeId", "createdAt"
FROM "Booking";

-- Step 3: Drop old table and rename
DROP TABLE "Booking";
ALTER TABLE "Booking_new" RENAME TO "Booking";

-- Step 4: Recreate the same for RecurringSchedule
CREATE TABLE "RecurringSchedule_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "lessonTypeId" TEXT,
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
    CONSTRAINT "RecurringSchedule_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringSchedule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringSchedule_skillTreeId_fkey" FOREIGN KEY ("skillTreeId") REFERENCES "SkillTree" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringSchedule_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "RecurringSchedule_new" SELECT
    "id", "userId", "coachId", "lessonTypeId",
    "dayOfWeek", "startTime", "frequency", "mode",
    "startsOn", "endsOn", "status",
    "categoryId", "skillTreeId", "nodeId", "createdAt"
FROM "RecurringSchedule";

DROP TABLE "RecurringSchedule";
ALTER TABLE "RecurringSchedule_new" RENAME TO "RecurringSchedule";
