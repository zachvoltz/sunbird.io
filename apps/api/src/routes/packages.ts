import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { makeStripe } from "../lib/stripe";

export const packagesRoutes = new Hono();

function stripeKey(c: any): string | undefined {
  return (c.env as any)?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || undefined;
}

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
  const coach = await db.user.findUnique({
    where: { id: coachId },
    select: { stripeChargesEnabled: true },
  });
  const plans = await db.subscriptionPlan.findMany({
    where: { coachId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const charges = !!coach?.stripeChargesEnabled;
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

  const coach = await db.user.findUnique({
    where: { id: plan.coachId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  if (!coach?.stripeAccountId || !coach.stripeChargesEnabled) {
    return c.json({ error: "This coach isn't set up to take package payments yet." }, 409);
  }

  // One active package per coach at a time.
  const existing = await db.subscription.findFirst({
    where: { userId: user.id, coachId: plan.coachId, status: { not: "CANCELLED" } },
  });
  if (existing) {
    return c.json({ error: "You already have an active package with this coach." }, 409);
  }

  const key = stripeKey(c);
  if (!key) {
    return c.json({ error: "Stripe isn't configured yet." }, 501);
  }
  const stripe = makeStripe(key);
  const origin = new URL(c.req.url).origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: plan.priceMonthly,
            recurring: { interval: "month" },
            product_data: { name: `${plan.name} — ${plan.lessonsPerMonth} lessons/mo` },
          },
          quantity: 1,
        },
      ],
      subscription_data: { transfer_data: { destination: coach.stripeAccountId } },
      metadata: { planId: plan.id, studentId: user.id, coachId: plan.coachId },
      success_url: `${origin}/my-bookings?package=success`,
      cancel_url: `${origin}/my-bookings?package=canceled`,
    });
    return c.json({ data: { checkoutUrl: session.url } }, 201);
  } catch (err: any) {
    console.error("Package subscribe Checkout failed:", err);
    return c.json({ error: err?.message ?? "Couldn't start checkout" }, 502);
  }
});
