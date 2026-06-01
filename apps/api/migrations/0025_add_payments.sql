-- One-time + recurring Stripe payments. Coaches set a flat per-session rate;
-- bookings/schedules carry a payment status driven by the Stripe webhook.
ALTER TABLE "User" ADD COLUMN "sessionPrice" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "RecurringSchedule" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "RecurringSchedule" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
CREATE UNIQUE INDEX "RecurringSchedule_stripeSubscriptionId_key" ON "RecurringSchedule"("stripeSubscriptionId");
