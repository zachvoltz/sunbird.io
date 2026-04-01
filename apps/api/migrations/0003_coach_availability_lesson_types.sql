-- Per-coach availability (replaces global AvailabilitySlot for booking)
CREATE TABLE "CoachAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CoachAvailability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CoachAvailability_coachId_dayOfWeek_startTime_key" ON "CoachAvailability"("coachId", "dayOfWeek", "startTime");

-- Coach-to-LessonType join table
CREATE TABLE "CoachLessonType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "lessonTypeId" TEXT NOT NULL,
    CONSTRAINT "CoachLessonType_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachLessonType_lessonTypeId_fkey" FOREIGN KEY ("lessonTypeId") REFERENCES "LessonType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CoachLessonType_coachId_lessonTypeId_key" ON "CoachLessonType"("coachId", "lessonTypeId");
