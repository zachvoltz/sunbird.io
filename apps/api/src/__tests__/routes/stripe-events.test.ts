import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers";
import { getDb, resetDb } from "../../lib/db";
import { handleStripeEvent } from "../../routes/payments";

let cleanup: () => void;
let coachId: string;
let studentId: string;
let categoryId: string;

async function seedBooking(paymentStatus: string) {
  const db = getDb();
  const startsAt = new Date(Date.now() + 3 * 86_400_000);
  return db.booking.create({
    data: {
      userId: studentId, coachId, categoryId,
      startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000),
      status: "CONFIRMED", paymentStatus,
    },
  });
}

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();
  coachId = (await db.user.create({ data: { name: "Coach", email: "c@example.com", role: "COACH", roleChosen: true } })).id;
  studentId = (await db.user.create({ data: { name: "Student", email: "s@example.com", roleChosen: true } })).id;
  categoryId = (await db.category.create({ data: { slug: "guitar", title: "Guitar", description: "x" } })).id;
});

afterAll(() => { resetDb(); cleanup(); });

describe("handleStripeEvent", () => {
  it("checkout.session.completed (payment) marks the booking PAID + stores the payment id", async () => {
    const db = getDb();
    const b = await seedBooking("PENDING");
    await handleStripeEvent(db, {
      type: "checkout.session.completed",
      data: { object: { mode: "payment", metadata: { bookingId: b.id }, payment_intent: "pi_123" } },
    });
    const updated = await db.booking.findUnique({ where: { id: b.id } });
    expect(updated?.paymentStatus).toBe("PAID");
    expect(updated?.stripePaymentId).toBe("pi_123");
  });

  it("checkout.session.expired (payment) marks FAILED + CANCELLED and notifies both sides", async () => {
    const db = getDb();
    const b = await seedBooking("PENDING");
    await handleStripeEvent(db, {
      type: "checkout.session.expired",
      data: { object: { mode: "payment", metadata: { bookingId: b.id } } },
    });
    const updated = await db.booking.findUnique({ where: { id: b.id } });
    expect(updated?.paymentStatus).toBe("FAILED");
    expect(updated?.status).toBe("CANCELLED");
    expect(await db.sessionMessage.count({ where: { bookingId: b.id } })).toBe(2);
  });

  it("checkout.session.completed (subscription) activates the schedule + creates its bookings", async () => {
    const db = getDb();
    const schedule = await db.recurringSchedule.create({
      data: {
        userId: studentId, coachId, categoryId,
        dayOfWeek: 1, startTime: "15:00", frequency: "WEEKLY", mode: "IN_PERSON",
        startsOn: new Date(Date.now() + 2 * 86_400_000),
        endsOn: new Date(Date.now() + 20 * 86_400_000),
        status: "ACTIVE", paymentStatus: "PENDING",
      },
    });
    await handleStripeEvent(db, {
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", metadata: { scheduleId: schedule.id }, subscription: "sub_123" } },
    });
    const updated = await db.recurringSchedule.findUnique({ where: { id: schedule.id } });
    expect(updated?.paymentStatus).toBe("PAID");
    expect(updated?.stripeSubscriptionId).toBe("sub_123");
    const bookings = await db.booking.findMany({ where: { scheduleId: schedule.id } });
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((b) => b.paymentStatus === "PAID")).toBe(true);
  });

  it("checkout.session.completed (subscription + planId) creates a package Subscription", async () => {
    const db = getDb();
    const plan = await db.subscriptionPlan.create({
      data: { coachId, name: "Starter", lessonsPerMonth: 4, priceMonthly: 8000 },
    });
    await handleStripeEvent(db, {
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_pkg_1", metadata: { planId: plan.id, studentId, coachId } } },
    });
    const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: "sub_pkg_1" } });
    expect(sub).toBeTruthy();
    expect(sub?.planId).toBe(plan.id);
    expect(sub?.status).toBe("ACTIVE");
    expect(sub?.lessonsUsedThisPeriod).toBe(0);
    // Idempotent — a duplicate delivery doesn't create a second row.
    await handleStripeEvent(db, {
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_pkg_1", metadata: { planId: plan.id, studentId, coachId } } },
    });
    expect(await db.subscription.count({ where: { stripeSubscriptionId: "sub_pkg_1" } })).toBe(1);
  });

  it("invoice.paid (subscription_cycle) resets package credits", async () => {
    const db = getDb();
    await db.subscription.update({
      where: { stripeSubscriptionId: "sub_pkg_1" },
      data: { lessonsUsedThisPeriod: 3, status: "PAST_DUE" },
    });
    await handleStripeEvent(db, {
      type: "invoice.paid",
      data: { object: { subscription: "sub_pkg_1", billing_reason: "subscription_cycle" } },
    });
    const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: "sub_pkg_1" } });
    expect(sub?.lessonsUsedThisPeriod).toBe(0);
    expect(sub?.status).toBe("ACTIVE");
  });

  it("invoice.paid (subscription_create) does NOT reset (no cycle)", async () => {
    const db = getDb();
    await db.subscription.update({
      where: { stripeSubscriptionId: "sub_pkg_1" },
      data: { lessonsUsedThisPeriod: 2 },
    });
    await handleStripeEvent(db, {
      type: "invoice.paid",
      data: { object: { subscription: "sub_pkg_1", billing_reason: "subscription_create" } },
    });
    const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: "sub_pkg_1" } });
    expect(sub?.lessonsUsedThisPeriod).toBe(2);
  });

  it("customer.subscription.deleted cancels a package Subscription", async () => {
    const db = getDb();
    await handleStripeEvent(db, {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_pkg_1" } },
    });
    const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: "sub_pkg_1" } });
    expect(sub?.status).toBe("CANCELLED");
  });

  it("invoice.payment_failed marks the schedule PAST_DUE + notifies", async () => {
    const db = getDb();
    const schedule = await db.recurringSchedule.create({
      data: {
        userId: studentId, coachId, categoryId,
        dayOfWeek: 1, startTime: "15:00", frequency: "WEEKLY", mode: "IN_PERSON",
        startsOn: new Date(Date.now() + 2 * 86_400_000),
        endsOn: new Date(Date.now() + 20 * 86_400_000),
        status: "ACTIVE", paymentStatus: "PAID", stripeSubscriptionId: "sub_fail",
      },
    });
    const startsAt = new Date(Date.now() + 4 * 86_400_000);
    const anchor = await db.booking.create({
      data: { userId: studentId, coachId, categoryId, scheduleId: schedule.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), status: "CONFIRMED", paymentStatus: "PAID" },
    });
    await handleStripeEvent(db, {
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_fail" } },
    });
    const updated = await db.recurringSchedule.findUnique({ where: { id: schedule.id } });
    expect(updated?.paymentStatus).toBe("PAST_DUE");
    expect(await db.sessionMessage.count({ where: { bookingId: anchor.id } })).toBe(2);
  });
});
