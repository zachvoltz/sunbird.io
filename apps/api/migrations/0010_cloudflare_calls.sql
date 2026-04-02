-- Add Cloudflare Calls session ID to Booking
ALTER TABLE "Booking" ADD COLUMN "callSessionId" TEXT;
