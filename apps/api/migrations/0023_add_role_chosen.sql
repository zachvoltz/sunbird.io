-- Post-signup role picker: new users stay roleChosen=false until they pick
-- (student vs coach) on /onboarding/role. Existing users already have a
-- meaningful role, so backfill them to true — never bounce them to onboarding.
ALTER TABLE "User" ADD COLUMN "roleChosen" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "roleChosen" = true;
