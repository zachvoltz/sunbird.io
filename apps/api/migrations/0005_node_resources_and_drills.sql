-- Node resources (files, links attached to curriculum nodes)
CREATE TABLE "NodeResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NodeResource_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CurriculumNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Practice drills (exercises linked to curriculum nodes)
CREATE TABLE "PracticeDrill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resourceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PracticeDrill_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CurriculumNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
