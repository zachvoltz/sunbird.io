import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { getProvider, readPaymentEnv } from "../lib/payment-provider";
import { coachCanCharge, toCoachConnection, type CoachPayInfo } from "../lib/payments";

export const packagesRoutes = new Hono();

// Coach columns needed to decide whether (and via which provider) a package can
// be sold — mirrors bookings.ts's coachPaySelect.
const coachPaySelect = {
  paymentProvider: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
  squareAccessToken: true,
  squareLocationId: true,
  squareConnected: true,
  sessionPrice: true,
} as const;

function creditsRemaining(plan: { lessonsPerMonth: number }, used: number): number {
  return Math.max(0, plan.lessonsPerMonth - used);
}

function serializePlan(p: any, coachChargesEnabled: boolean) {
  return {
    id: p.id,
    coachId: p.coachId,
    name: p.name,
    lessonsPerMonth: p.lessonsPerMonth,
    priceMonthly: p.priceMonthly,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    subscribable: p.isActive && coachChargesEnabled,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeSubscription(s: any) {
  return {
    id: s.id,
    coachId: s.coachId,
    planId: s.planId,
    plan: serializePlan(s.plan, true),
    status: s.status,
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    lessonsUsedThisPeriod: s.lessonsUsedThisPeriod,
    creditsRemaining: creditsRemaining(s.plan, s.lessonsUsedThisPeriod),
    createdAt: s.createdAt.toISOString(),
  };
}

// GET /api/packages?coachId=... — a coach's subscribable package tiers, for a
// student deciding whether to buy a package. Only active tiers are returned,
// and `subscribable` reflects whether the coach can actually take charges.
packagesRoutes.get("/", requireAuth, async (c) => {
  const coachId = c.req.query("coachId");
  if (!coachId) return c.json({ error: "coachId is required" }, 400);
  const db = getDb();
  const coach = await db.user.findUnique({ where: { id: coachId }, select: coachPaySelect });
  const plans = await db.subscriptionPlan.findMany({
    where: { coachId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const charges = !!coach && coachCanCharge(coach);
  return c.json({ data: plans.map((p: any) => serializePlan(p, charges)) });
});

// GET /api/packages/mine — the calling student's active package subscriptions,
// with remaining credits this period.
packagesRoutes.get("/mine", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const subs = await db.subscription.findMany({
    where: { userId: user.id, status: { not: "CANCELLED" } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: subs.map(serializeSubscription) });
});

// POST /api/packages/subscribe — start a monthly-package subscription Checkout.
// Body: { planId }. Like the recurring flow, the Subscription row is created by
// the webhook once payment is confirmed; here we just open Checkout. Inline
// price_data with a destination transfer to the coach's connected account (no
// pre-created Stripe Price needed).
packagesRoutes.post("/subscribe", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = (await c.req.json().catch(() => null)) as { planId?: string } | null;
  const planId = body?.planId;
  if (!planId) return c.json({ error: "planId is required" }, 400);

  const db = getDb();
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return c.json({ error: "Package not found" }, 404);

  const coach: CoachPayInfo | null = await db.user.findUnique({
    where: { id: plan.coachId },
    select: coachPaySelect,
  });
  if (!coach || !coachCanCharge(coach)) {
    return c.json({ error: "This coach isn't set up to take package payments yet." }, 409);
  }

  // One active package per coach at a time (a PENDING Square row counts too, so
  // a student can't double-subscribe while the first invoice is unpaid).
  const existing = await db.subscription.findFirst({
    where: { userId: user.id, coachId: plan.coachId, status: { not: "CANCELLED" } },
  });
  if (existing) {
    return c.json({ error: "You already have an active package with this coach." }, 409);
  }

  try {
    const provider = getProvider(coach.paymentProvider);
    const result = await provider.createPackageCheckout(readPaymentEnv(c), {
      connection: toCoachConnection(coach),
      amountCents: plan.priceMonthly,
      planName: plan.name,
      lessonsPerMonth: plan.lessonsPerMonth,
      planId: plan.id,
      studentId: user.id,
      coachId: plan.coachId,
      studentEmail: user.email,
      studentName: user.name,
      origin: new URL(c.req.url).origin,
    });
    if (!result.url) {
      return c.json({ error: "Payments aren't configured yet." }, 501);
    }
    // Stripe creates the Subscription row in the webhook (from Checkout metadata).
    // Square has no such metadata, so we create a PENDING row now carrying the
    // Square subscription id; the invoice.payment_made webhook activates it.
    if (result.externalRef) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.subscription.create({
        data: {
          userId: user.id,
          coachId: plan.coachId,
          planId: plan.id,
          squareSubscriptionId: result.externalRef,
          status: "PENDING",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lessonsUsedThisPeriod: 0,
        },
      }).catch(() => {});
    }
    return c.json({ data: { checkoutUrl: result.url } }, 201);
  } catch (err: any) {
    console.error("Package subscribe Checkout failed:", err);
    return c.json({ error: err?.message ?? "Couldn't start checkout" }, 502);
  }
});
