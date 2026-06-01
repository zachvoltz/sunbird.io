-- Idempotency flags for the 24h / 1h "upcoming lesson" reminder cron. Set once
-- the corresponding reminder has been sent so an overlapping cron tick never
-- double-notifies. NULL = not yet reminded.
ALTER TABLE "Booking" ADD COLUMN "remindedAt24h" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "remindedAt1h" DATETIME;
