-- Global coach resource library
CREATE TABLE "CoachResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachResource_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Join table linking resources to curriculum nodes
CREATE TABLE "NodeResourceLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    CONSTRAINT "NodeResourceLink_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CurriculumNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeResourceLink_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CoachResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NodeResourceLink_nodeId_resourceId_key" ON "NodeResourceLink"("nodeId", "resourceId");

-- Drop old NodeResource table (data migrated to CoachResource + NodeResourceLink)
DROP TABLE IF EXISTS "NodeResource";
