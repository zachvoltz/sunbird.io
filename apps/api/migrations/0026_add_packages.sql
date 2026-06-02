-- N-per-month lesson packages (Model B), coexisting additively with the shipped
-- per-session pricing. The SubscriptionPlan / Subscription tables existed from
-- 0001 but were never used (no API/UI/webhook touched them), so they hold zero
-- rows in prod — we drop and recreate them with the package-ready shape rather
-- than ALTER (SQLite can't add a NOT NULL column without a default, nor drop the
-- old UNIQUE indexes on stripePriceId / userId in place).
--
-- Changes vs the 0001 shape:
--   SubscriptionPlan: + coachId (owner), stripePriceId now NULLABLE (draft plans
--     / dev without Stripe), + createdAt/updatedAt.
--   Subscription: userId no longer UNIQUE (a student may hold packages with
--     multiple coaches — additive model), + coachId.
--   Booking: + subscriptionId, linking a credit-backed booking to the package it
--     was paid from (drives credit return on cancel/reschedule).

DROP TABLE IF EXISTS "Subscription";
DROP TABLE IF EXISTS "SubscriptionPlan";

CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lessonsPerMonth" INTEGER NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceId_key" ON "SubscriptionPlan"("stripePriceId");
CREATE INDEX "SubscriptionPlan_coachId_idx" ON "SubscriptionPlan"("coachId");

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "lessonsUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_userId_coachId_idx" ON "Subscription"("userId", "coachId");

ALTER TABLE "Booking" ADD COLUMN "subscriptionId" TEXT;
