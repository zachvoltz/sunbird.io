import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let otherCoachId: string;
let categoryId: string;
let studentId: string;
let studentCookie: string;
let subId: string;

// Two valid future slots on the same weekday the coach is available for.
const slotA = new Date(Date.now() + 7 * 86_400_000);
slotA.setUTCHours(15, 0, 0, 0);
const slotB = new Date(slotA);
slotB.setUTCHours(16, 0, 0, 0);

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();

  // Coach that DOES charge per session (so the credit path is meaningfully
  // different from the free path) and can take charges.
  coachId = (await db.user.create({
    data: {
      name: "Paid Coach", email: "paid@example.com", role: "COACH", roleChosen: true,
      stripeAccountId: "acct_test", stripeChargesEnabled: true, sessionPrice: 6000,
    },
  })).id;
  otherCoachId = (await db.user.create({ data: { name: "Other", email: "other@example.com", role: "COACH", roleChosen: true } })).id;
  categoryId = (await db.category.create({ data: { slug: "guitar", title: "Guitar", description: "x" } })).id;
  await db.coachCategory.create({ data: { coachId, categoryId } });
  await db.coachAvailability.create({ data: { coachId, dayOfWeek: slotA.getUTCDay(), startTime: "15:00", endTime: "16:00", isActive: true } });
  await db.coachAvailability.create({ data: { coachId, dayOfWeek: slotB.getUTCDay(), startTime: "16:00", endTime: "17:00", isActive: true } });
  // Other coach is validly bookable (teaches category + available at slotB) but
  // the student has no package with them — so the 409 is about the package, not
  // slot validation.
  await db.coachCategory.create({ data: { coachId: otherCoachId, categoryId } });
  await db.coachAvailability.create({ data: { coachId: otherCoachId, dayOfWeek: slotB.getUTCDay(), startTime: "16:00", endTime: "17:00", isActive: true } });

  const reg = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: "Student", email: "student@example.com", password: "password123" },
  });
  studentId = ((await reg.json()) as any).data.id;
  studentCookie = getSessionCookie(reg)!;

  // Student holds a 2-lesson/month package with the paid coach.
  subId = (await db.subscription.create({
    data: {
      userId: studentId, coachId,
      planId: (await db.subscriptionPlan.create({
        data: { coachId, name: "Duo", lessonsPerMonth: 2, priceMonthly: 10000 },
      })).id,
      stripeSubscriptionId: "sub_credits", status: "ACTIVE", lessonsUsedThisPeriod: 0,
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  })).id;
});

afterAll(() => { resetDb(); cleanup(); });

describe("booking with a package credit", () => {
  let bookingId: string;

  it("books PAID via credit (no checkout) and decrements the balance", async () => {
    const res = await jsonRequest(app, "/api/bookings", {
      method: "POST",
      cookie: studentCookie,
      body: { categoryId, coachId, startsAt: slotA.toISOString(), mode: "IN_PERSON", usePackage: true },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    bookingId = body.data.id;
    expect(body.checkoutUrl).toBeUndefined();
    expect(body.data.paymentStatus).toBe("PAID");
    expect(body.data.usedSubscription).toBe(true);
    expect(body.data.subscriptionId).toBe(subId);

    const sub = await getDb().subscription.findUnique({ where: { id: subId } });
    expect(sub?.lessonsUsedThisPeriod).toBe(1);
  });

  it("returns the credit when the credit-backed booking is cancelled", async () => {
    const res = await jsonRequest(app, `/api/bookings/${bookingId}/cancel`, {
      method: "PATCH", cookie: studentCookie,
    });
    expect(res.status).toBe(200);
    const sub = await getDb().subscription.findUnique({ where: { id: subId } });
    expect(sub?.lessonsUsedThisPeriod).toBe(0);
  });

  it("409s when the package is exhausted", async () => {
    const db = getDb();
    await db.subscription.update({ where: { id: subId }, data: { lessonsUsedThisPeriod: 2 } });
    const res = await jsonRequest(app, "/api/bookings", {
      method: "POST",
      cookie: studentCookie,
      body: { categoryId, coachId, startsAt: slotB.toISOString(), mode: "IN_PERSON", usePackage: true },
    });
    expect(res.status).toBe(409);
    await db.subscription.update({ where: { id: subId }, data: { lessonsUsedThisPeriod: 0 } });
  });

  it("409s when there's no package with the coach", async () => {
    const res = await jsonRequest(app, "/api/bookings", {
      method: "POST",
      cookie: studentCookie,
      body: { categoryId, coachId: otherCoachId, startsAt: slotB.toISOString(), mode: "IN_PERSON", usePackage: true },
    });
    expect(res.status).toBe(409);
  });
});
