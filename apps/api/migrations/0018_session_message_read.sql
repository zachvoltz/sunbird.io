-- Per-user read receipts on SessionMessages. Combined with the
-- existing User.lastInboxViewedAt timestamp, this lets us support
-- both "mark all read" (cheap stamp) and per-item "mark read"
-- toggles in the coach + student inbox views.
CREATE TABLE "SessionMessageRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SessionMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionMessageRead_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "User"           ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SessionMessageRead_messageId_userId_key" ON "SessionMessageRead"("messageId", "userId");
CREATE INDEX "SessionMessageRead_userId_idx" ON "SessionMessageRead"("userId");
