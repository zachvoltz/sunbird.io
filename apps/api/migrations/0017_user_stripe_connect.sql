-- Stripe Connect (Express) fields on the coach's User row. Flags mirror
-- Stripe's account.{charges,payouts,details_submitted} so the payments
-- dashboard can pick the right stage without hitting the API on every
-- render.
ALTER TABLE "User" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeChargesEnabled" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "stripePayoutsEnabled" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "stripeDetailsSubmitted" INTEGER NOT NULL DEFAULT 0;
