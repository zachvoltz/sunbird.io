import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let coachCookie: string;
let studentCookie: string;

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
  coachCookie = coach.cookie;
  await db.user.update({ where: { id: coachId }, data: { role: "COACH" } });

  const student = await register("student@example.com");
  studentCookie = student.cookie;
});

afterAll(() => { resetDb(); cleanup(); });

describe("coach plans CRUD", () => {
  let planId: string;

  it("creates a plan tier", async () => {
    const res = await jsonRequest(app, "/api/coach-plans", {
      method: "POST",
      cookie: coachCookie,
      body: { name: "Starter", lessonsPerMonth: 4, priceMonthly: 8000 },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    planId = body.data.id;
    expect(body.data.name).toBe("Starter");
    expect(body.data.lessonsPerMonth).toBe(4);
    expect(body.data.coachId).toBe(coachId);
    // No Stripe charges enabled in test → not subscribable yet.
    expect(body.data.subscribable).toBe(false);
  });

  it("rejects an invalid plan (price below the floor)", async () => {
    const res = await jsonRequest(app, "/api/coach-plans", {
      method: "POST",
      cookie: coachCookie,
      body: { name: "Bad", lessonsPerMonth: 4, priceMonthly: 10 },
    });
    expect(res.status).toBe(400);
  });

  it("becomes subscribable once the coach can take charges", async () => {
    const db = getDb();
    await db.user.update({ where: { id: coachId }, data: { stripeChargesEnabled: true } });
    const res = await jsonRequest(app, "/api/coach-plans", { cookie: coachCookie });
    const body = (await res.json()) as any;
    expect(body.data[0].subscribable).toBe(true);
  });

  it("lists only the calling coach's plans", async () => {
    const res = await jsonRequest(app, "/api/coach-plans", { cookie: coachCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(planId);
  });

  it("forbids students from listing coach plans", async () => {
    const res = await jsonRequest(app, "/api/coach-plans", { cookie: studentCookie });
    expect(res.status).toBe(403);
  });

  it("edits a plan", async () => {
    const res = await jsonRequest(app, `/api/coach-plans/${planId}`, {
      method: "PATCH",
      cookie: coachCookie,
      body: { priceMonthly: 9000, isActive: false },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.priceMonthly).toBe(9000);
    expect(body.data.isActive).toBe(false);
    // Inactive → not subscribable even with charges enabled.
    expect(body.data.subscribable).toBe(false);
  });

  it("blocks deleting a plan that has subscribers", async () => {
    const db = getDb();
    const sub = await db.subscription.create({
      data: {
        userId: coachId, // any user; fk only needs a valid user row
        coachId,
        planId,
        stripeSubscriptionId: `sub_test_${Date.now()}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    const res = await jsonRequest(app, `/api/coach-plans/${planId}`, {
      method: "DELETE",
      cookie: coachCookie,
    });
    expect(res.status).toBe(409);
    await db.subscription.delete({ where: { id: sub.id } });
  });

  it("deletes a plan with no subscribers", async () => {
    const res = await jsonRequest(app, `/api/coach-plans/${planId}`, {
      method: "DELETE",
      cookie: coachCookie,
    });
    expect(res.status).toBe(200);
    const db = getDb();
    expect(await db.subscriptionPlan.count()).toBe(0);
  });
});
