-- Add token storage to OAuthAccount
ALTER TABLE "OAuthAccount" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "OAuthAccount" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "OAuthAccount" ADD COLUMN "accessTokenExpiresAt" DATETIME;
ALTER TABLE "OAuthAccount" ADD COLUMN "scopes" TEXT;

-- Add session address to User
ALTER TABLE "User" ADD COLUMN "sessionAddress" TEXT;

-- Add booking mode and meeting fields
ALTER TABLE "Booking" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'IN_PERSON';
ALTER TABLE "Booking" ADD COLUMN "meetingUrl" TEXT;
ALTER TABLE "Booking" ADD COLUMN "meetingId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "meetingProvider" TEXT;
