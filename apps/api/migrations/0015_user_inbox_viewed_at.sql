-- Drives the unread-message badge on the coach sidebar. NULL means
-- the user has never opened the inbox, so every incoming message is
-- considered unread until they do.
ALTER TABLE "User" ADD COLUMN "lastInboxViewedAt" DATETIME;
