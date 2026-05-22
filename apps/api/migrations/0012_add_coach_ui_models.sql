-- AlterTable: User adds age + instrument
ALTER TABLE "User" ADD COLUMN "age" INTEGER;
ALTER TABLE "User" ADD COLUMN "instrument" TEXT;

-- AlterTable: Booking adds structured-note sections (JSON-encoded)
ALTER TABLE "Booking" ADD COLUMN "noteSections" TEXT;

-- CreateTable: practice streak (1:1 with User)
CREATE TABLE "PracticeStreak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentDays" INTEGER NOT NULL DEFAULT 0,
    "longestDays" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PracticeStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PracticeStreak_userId_key" ON "PracticeStreak"("userId");

-- CreateTable: per-week assignments
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "bars" TEXT,
    "weekStartsOn" DATETIME NOT NULL,
    "tempoBpmStart" INTEGER,
    "tempoBpmEnd" INTEGER,
    "durationMin" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "noteText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hasMidi" BOOLEAN NOT NULL DEFAULT false,
    "hasNotePinned" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" DATETIME,
    "bookingId" TEXT,
    "resourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CoachResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Assignment_studentId_weekStartsOn_idx" ON "Assignment"("studentId", "weekStartsOn");

-- CreateTable: take submissions
CREATE TABLE "Take" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "pieceTitle" TEXT NOT NULL,
    "bars" TEXT,
    "takeNumber" INTEGER NOT NULL DEFAULT 1,
    "durationSec" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "selfRating" INTEGER,
    "selfNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Take_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Take_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Take_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Take_studentId_createdAt_idx" ON "Take"("studentId", "createdAt");

-- CreateTable: pins on score/timeline of a take
CREATE TABLE "TakeAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "takeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetBar" INTEGER,
    "targetTimeSec" REAL,
    "text" TEXT,
    "voiceUrl" TEXT,
    "voiceDurSec" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TakeAnnotation_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TakeAnnotation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: coach reply to a take
CREATE TABLE "TakeReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "takeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT,
    "voiceUrl" TEXT,
    "voiceDurSec" INTEGER,
    "starRating" INTEGER,
    "summaryText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TakeReply_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TakeReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: stubbed AI lesson summary (manual-edit only for now)
CREATE TABLE "LessonSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "bullets" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "durationMin" INTEGER,
    "recordingUrl" TEXT,
    "editedById" TEXT,
    "generatedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonSummary_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonSummary_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LessonSummary_bookingId_key" ON "LessonSummary"("bookingId");

-- CreateTable: read receipts for the practice note
CREATE TABLE "NoteReadReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteReadReceipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "NoteReadReceipt_bookingId_userId_idx" ON "NoteReadReceipt"("bookingId", "userId");

-- CreateTable: voice memos appended to the note
CREATE TABLE "NoteVoiceMemo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteVoiceMemo_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteVoiceMemo_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
