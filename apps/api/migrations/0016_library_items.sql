-- Coach's library — warmups, exercises, songs they can drag onto a
-- student's week or attach to path lessons. Tags stored as JSON.
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "bpmStart" INTEGER,
    "bpmEnd" INTEGER,
    "durationMin" INTEGER,
    "hasMidi" INTEGER NOT NULL DEFAULT 0,
    "midiUrl" TEXT,
    "pdfUrl" TEXT,
    "audioUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryItem_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LibraryItem_coachId_idx" ON "LibraryItem"("coachId");
