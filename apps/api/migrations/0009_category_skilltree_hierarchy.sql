-- New Category > SkillTree > Node hierarchy

CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

CREATE TABLE "CoachCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "CoachCategory_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CoachCategory_coachId_categoryId_key" ON "CoachCategory"("coachId", "categoryId");

CREATE TABLE "SkillTree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillTree_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillTree_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SkillTreeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillTreeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SkillTreeNode_skillTreeId_fkey" FOREIGN KEY ("skillTreeId") REFERENCES "SkillTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SkillTreeEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillTreeId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    CONSTRAINT "SkillTreeEdge_skillTreeId_fkey" FOREIGN KEY ("skillTreeId") REFERENCES "SkillTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillTreeEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillTreeEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SkillTreeEdge_fromNodeId_toNodeId_key" ON "SkillTreeEdge"("fromNodeId", "toNodeId");

CREATE TABLE "STNodeProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "STNodeProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "STNodeProgress_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "STNodeProgress_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "STNodeProgress_studentId_nodeId_key" ON "STNodeProgress"("studentId", "nodeId");

CREATE TABLE "STNodeResourceLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    CONSTRAINT "STNodeResourceLink_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "STNodeResourceLink_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CoachResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "STNodeResourceLink_nodeId_resourceId_key" ON "STNodeResourceLink"("nodeId", "resourceId");

CREATE TABLE "STDrill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resourceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "STDrill_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SkillTreeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add new FK columns to Booking (nullable for migration)
ALTER TABLE "Booking" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "skillTreeId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "nodeId" TEXT;

-- Add new FK columns to RecurringSchedule (nullable for migration)
ALTER TABLE "RecurringSchedule" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "RecurringSchedule" ADD COLUMN "skillTreeId" TEXT;
ALTER TABLE "RecurringSchedule" ADD COLUMN "nodeId" TEXT;
