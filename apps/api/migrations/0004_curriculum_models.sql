-- Curriculum / Skill Trees

CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "lessonTypeId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Curriculum_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Curriculum_lessonTypeId_fkey" FOREIGN KEY ("lessonTypeId") REFERENCES "LessonType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Curriculum_coachId_lessonTypeId_key" ON "Curriculum"("coachId", "lessonTypeId");

CREATE TABLE "CurriculumNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "curriculumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CurriculumNode_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CurriculumEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "curriculumId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    CONSTRAINT "CurriculumEdge_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "CurriculumNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CurriculumEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "CurriculumNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CurriculumEdge_fromNodeId_toNodeId_key" ON "CurriculumEdge"("fromNodeId", "toNodeId");

CREATE TABLE "StudentProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "StudentProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentProgress_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CurriculumNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentProgress_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentProgress_studentId_nodeId_key" ON "StudentProgress"("studentId", "nodeId");
