-- Messaging: persistent coach↔student Conversation threads, a generalized
-- SessionMessage (activity cards + nullable bookingId), notification prefs, and
-- Web Push subscriptions. SQLite can't ALTER a column to nullable or add a new
-- FK, so SessionMessage is rebuilt (same pattern as 0011).

-- Step 1: persistent 1:1 coach↔student thread
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Conversation_coachId_studentId_key" ON "Conversation"("coachId", "studentId");
CREATE INDEX "Conversation_coachId_lastActivityAt_idx" ON "Conversation"("coachId", "lastActivityAt");
CREATE INDEX "Conversation_studentId_lastActivityAt_idx" ON "Conversation"("studentId", "lastActivityAt");

-- Step 2: per-user notification settings
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- Step 3: Web Push subscription (one per browser/device)
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- Step 4: rebuild SessionMessage with nullable bookingId + conversation/activity
-- columns, then copy the existing rows over.
CREATE TABLE "SessionMessage_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT,
    "bookingId" TEXT,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TEXT',
    "refType" TEXT,
    "refId" TEXT,
    "attachments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "SessionMessage_new" ("id", "bookingId", "senderId", "content", "createdAt")
    SELECT "id", "bookingId", "senderId", "content", "createdAt" FROM "SessionMessage";

DROP TABLE "SessionMessage";
ALTER TABLE "SessionMessage_new" RENAME TO "SessionMessage";
CREATE INDEX "SessionMessage_conversationId_createdAt_idx" ON "SessionMessage"("conversationId", "createdAt");
CREATE INDEX "SessionMessage_bookingId_idx" ON "SessionMessage"("bookingId");

-- Step 5: backfill one Conversation per distinct (coach, student) pair from
-- bookings, then point the migrated booking-scoped messages at the matching
-- conversation so existing history shows up in the new thread.
INSERT INTO "Conversation" ("id", "coachId", "studentId", "lastActivityAt", "createdAt")
SELECT lower(hex(randomblob(12))), b."coachId", b."userId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "coachId", "userId" FROM "Booking" WHERE "coachId" IS NOT NULL) b;

UPDATE "SessionMessage"
SET "conversationId" = (
    SELECT c."id" FROM "Conversation" c
    JOIN "Booking" bk ON bk."coachId" = c."coachId" AND bk."userId" = c."studentId"
    WHERE bk."id" = "SessionMessage"."bookingId"
    LIMIT 1
)
WHERE "bookingId" IS NOT NULL;
