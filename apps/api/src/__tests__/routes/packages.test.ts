import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let studentCookie: string;
let studentId: string;
let activePlanId: string;
let inactivePlanId: string;

async function register(email: string) {
  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: email.split("@")[0], email, password: "password123" },
  });
  return { id: ((await res.json()) as any).data.id, cookie: getSessionCookie(res)! };
}

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();

  const coach = await register("coach@example.com");
  coachId = coach.id;
  // Coach can take charges so plans are subscribable.
  await db.user.update({
    where: { id: coachId },
    data: { role: "COACH", stripeAccountId: "acct_test", stripeChargesEnabled: true },
  });

  const student = await register("student@example.com");
  studentCookie = student.cookie;
  studentId = student.id;

  activePlanId = (await db.subscriptionPlan.create({
    data: { coachId, name: "Starter", lessonsPerMonth: 4, priceMonthly: 8000, isActive: true },
  })).id;
  inactivePlanId = (await db.subscriptionPlan.create({
    data: { coachId, name: "Hidden", lessonsPerMonth: 8, priceMonthly: 15000, isActive: false },
  })).id;
});

afterAll(() => { resetDb(); cleanup(); });

describe("packages (student-facing)", () => {
  it("lists only a coach's active, subscribable plans", async () => {
    const res = await jsonRequest(app, `/api/packages?coachId=${coachId}`, { cookie: studentCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(activePlanId);
    expect(body.data[0].subscribable).toBe(true);
  });

  it("requires coachId", async () => {
    const res = await jsonRequest(app, "/api/packages", { cookie: studentCookie });
    expect(res.status).toBe(400);
  });

  it("subscribe 404s on an inactive/unknown plan", async () => {
    const res = await jsonRequest(app, "/api/packages/subscribe", {
      method: "POST", cookie: studentCookie, body: { planId: inactivePlanId },
    });
    expect(res.status).toBe(404);
  });

  it("subscribe 409s when the student already has an active package with the coach", async () => {
    const db = getDb();
    const sub = await db.subscription.create({
      data: {
        userId: studentId, coachId, planId: activePlanId,
        stripeSubscriptionId: `sub_existing_${Date.now()}`,
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    const res = await jsonRequest(app, "/api/packages/subscribe", {
      method: "POST", cookie: studentCookie, body: { planId: activePlanId },
    });
    expect(res.status).toBe(409);
    await db.subscription.delete({ where: { id: sub.id } });
  });

  it("GET /api/packages/mine returns the student's subscriptions with credits", async () => {
    const db = getDb();
    const sub = await db.subscription.create({
      data: {
        userId: studentId, coachId, planId: activePlanId,
        stripeSubscriptionId: `sub_mine_${Date.now()}`,
        lessonsUsedThisPeriod: 1,
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    const res = await jsonRequest(app, "/api/packages/mine", { cookie: studentCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].creditsRemaining).toBe(3); // 4 - 1
    expect(body.data[0].plan.name).toBe("Starter");
    await db.subscription.delete({ where: { id: sub.id } });
  });
});
