-- Student practice goals, shared with the coach. A freshly-set goal (isNew)
-- surfaces on the coach's session-prep agenda as a "talk through how to
-- approach this" item; the coach clears isNew once it's discussed.
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "targetLabel" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "achievedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Goal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Goal_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Goal_studentId_status_idx" ON "Goal"("studentId", "status");
CREATE INDEX "Goal_coachId_status_idx" ON "Goal"("coachId", "status");
