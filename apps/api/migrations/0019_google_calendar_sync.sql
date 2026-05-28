-- Two-way Google Calendar sync mirror/shadow.
--
--   Outbound mirror: bookingId or busyId is set; row tracks the Google
--     event we created to reflect a Sunbird booking/busy block.
--   Inbound shadow:  both bookingId and busyId are NULL; row was
--     pulled from Google so the coach's existing calendar entries
--     block them from being double-booked on Sunbird.
CREATE TABLE "GoogleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL DEFAULT 'primary',
    "bookingId" TEXT,
    "busyId" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "summary" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleEvent_coachId_fkey"   FOREIGN KEY ("coachId")   REFERENCES "User"     ("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "GoogleEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"  ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GoogleEvent_busyId_fkey"    FOREIGN KEY ("busyId")    REFERENCES "CoachBusy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GoogleEvent_coachId_googleEventId_key" ON "GoogleEvent"("coachId", "googleEventId");
CREATE INDEX "GoogleEvent_coachId_idx"   ON "GoogleEvent"("coachId");
CREATE INDEX "GoogleEvent_bookingId_idx" ON "GoogleEvent"("bookingId");
CREATE INDEX "GoogleEvent_busyId_idx"    ON "GoogleEvent"("busyId");
