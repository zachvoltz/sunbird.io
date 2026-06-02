import { Hono } from "hono";
import { createPlanSchema, updatePlanSchema } from "@sunbird/shared";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const coachPlansRoutes = new Hono();

// A coach's N-per-month package tier. We don't pre-create Stripe Price objects:
// the subscribe Checkout builds inline price_data with a destination transfer to
// the coach's connected account (same approach as the per-session recurring
// flow), so `stripePriceId` stays reserved/unused and a plan is fully editable
// without any Stripe round-trip. "subscribable" is what the student cares about:
// the plan is active AND the coach can actually take charges.
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

// GET /api/coach-plans — the calling coach's package tiers (active + inactive).
coachPlansRoutes.get(
  "/",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    const [coach, plans] = await Promise.all([
      db.user.findUnique({ where: { id: user.id }, select: { stripeChargesEnabled: true } }),
      db.subscriptionPlan.findMany({
        where: { coachId: user.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    const charges = !!coach?.stripeChargesEnabled;
    return c.json({ data: plans.map((p: any) => serializePlan(p, charges)) });
  },
);

// POST /api/coach-plans — create a tier.
coachPlansRoutes.post(
  "/",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json().catch(() => null);
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid plan" }, 400);
    }
    const db = getDb();
    const coach = await db.user.findUnique({
      where: { id: user.id },
      select: { stripeChargesEnabled: true },
    });
    const plan = await db.subscriptionPlan.create({
      data: {
        coachId: user.id,
        name: parsed.data.name,
        lessonsPerMonth: parsed.data.lessonsPerMonth,
        priceMonthly: parsed.data.priceMonthly,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });
    return c.json({ data: serializePlan(plan, !!coach?.stripeChargesEnabled) }, 201);
  },
);

// PATCH /api/coach-plans/:id — edit a tier the coach owns.
coachPlansRoutes.patch(
  "/:id",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid plan" }, 400);
    }
    const db = getDb();
    const existing = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!existing || existing.coachId !== user.id) {
      return c.json({ error: "Plan not found" }, 404);
    }
    const coach = await db.user.findUnique({
      where: { id: user.id },
      select: { stripeChargesEnabled: true },
    });
    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: parsed.data,
    });
    return c.json({ data: serializePlan(plan, !!coach?.stripeChargesEnabled) });
  },
);

// DELETE /api/coach-plans/:id — remove a tier. Blocked while students hold the
// plan; the coach should deactivate it instead (existing subscriptions keep
// running until they end / are cancelled).
coachPlansRoutes.delete(
  "/:id",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = getDb();
    const existing = await db.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!existing || existing.coachId !== user.id) {
      return c.json({ error: "Plan not found" }, 404);
    }
    if (existing._count.subscriptions > 0) {
      return c.json(
        { error: "Students are subscribed to this plan — deactivate it instead of deleting." },
        409,
      );
    }
    await db.subscriptionPlan.delete({ where: { id } });
    return c.json({ data: { id } });
  },
);
