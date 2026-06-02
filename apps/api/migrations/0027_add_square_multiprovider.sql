-- Multi-provider payments (§5b): let each coach pick Stripe OR Square.
-- Adds a `paymentProvider` discriminator + Square-specific columns alongside the
-- existing stripe* columns. Existing rows default to 'STRIPE', so every current
-- coach is unchanged. A coach uses exactly one provider at a time; the unused
-- provider's columns stay null.

-- Coach connection. Stripe Connect columns already exist (0017/0025); Square is
-- an OAuth grant, so we store the merchant/location + access/refresh tokens.
ALTER TABLE "User" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "User" ADD COLUMN "squareMerchantId" TEXT;
ALTER TABLE "User" ADD COLUMN "squareLocationId" TEXT;
ALTER TABLE "User" ADD COLUMN "squareAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "squareRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "squareTokenExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "squareConnected" BOOLEAN NOT NULL DEFAULT false;

-- One-time payment correlation for Square: the Payment Link's order id, matched
-- back from the payment.updated webhook (Stripe uses stripePaymentId instead).
ALTER TABLE "Booking" ADD COLUMN "squareOrderId" TEXT;

-- Square subscription backing a recurring schedule (set synchronously at create,
-- unlike Stripe where the webhook fills stripeSubscriptionId in).
ALTER TABLE "RecurringSchedule" ADD COLUMN "squareSubscriptionId" TEXT;
CREATE UNIQUE INDEX "RecurringSchedule_squareSubscriptionId_key" ON "RecurringSchedule"("squareSubscriptionId");

-- Subscription (monthly packages): make stripeSubscriptionId nullable and add
-- squareSubscriptionId. SQLite can't drop a NOT NULL / unique index in place, so
-- rebuild the table, copying any existing rows across.
CREATE TABLE "Subscription_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "squareSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "lessonsUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Subscription_new" ("id","userId","coachId","planId","stripeSubscriptionId","status","currentPeriodStart","currentPeriodEnd","lessonsUsedThisPeriod","createdAt")
  SELECT "id","userId","coachId","planId","stripeSubscriptionId","status","currentPeriodStart","currentPeriodEnd","lessonsUsedThisPeriod","createdAt" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "Subscription_new" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "Subscription_squareSubscriptionId_key" ON "Subscription"("squareSubscriptionId");
CREATE INDEX "Subscription_userId_coachId_idx" ON "Subscription"("userId", "coachId");
