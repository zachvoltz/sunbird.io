-- Khan-style lesson trees owned by a coach. The node/edge graph is
-- stored as JSON on the row (typically <30 nodes per path).
CREATE TABLE "Path" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sub" TEXT,
    "shape" TEXT NOT NULL DEFAULT 'linear',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "coral" INTEGER NOT NULL DEFAULT 0,
    "nodes" TEXT NOT NULL DEFAULT '[]',
    "edges" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Path_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Path_coachId_slug_key" ON "Path"("coachId", "slug");

-- A student walking through one of a coach's paths.
CREATE TABLE "PathAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "currentLessonId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PathAssignment_pathId_fkey"    FOREIGN KEY ("pathId")    REFERENCES "Path" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PathAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PathAssignment_coachId_fkey"   FOREIGN KEY ("coachId")   REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PathAssignment_pathId_studentId_key" ON "PathAssignment"("pathId", "studentId");
CREATE INDEX "PathAssignment_coachId_idx"   ON "PathAssignment"("coachId");
CREATE INDEX "PathAssignment_studentId_idx" ON "PathAssignment"("studentId");
