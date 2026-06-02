import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers";
import { getDb, resetDb } from "../../lib/db";
import { handleSquareEvent } from "../../routes/payments";

let cleanup: () => void;
let coachId: string;
let studentId: string;
let categoryId: string;

async function seedBooking(squareOrderId: string, paymentStatus: string) {
  const db = getDb();
  const startsAt = new Date(Date.now() + 3 * 86_400_000);
  return db.booking.create({
    data: {
      userId: studentId, coachId, categoryId,
      startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000),
      status: "CONFIRMED", paymentStatus, squareOrderId,
    },
  });
}

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();
  coachId = (await db.user.create({ data: { name: "Coach", email: "c@example.com", role: "COACH", roleChosen: true, paymentProvider: "SQUARE" } })).id;
  studentId = (await db.user.create({ data: { name: "Student", email: "s@example.com", roleChosen: true } })).id;
  categoryId = (await db.category.create({ data: { slug: "guitar", title: "Guitar", description: "x" } })).id;
});

afterAll(() => { resetDb(); cleanup(); });

describe("handleSquareEvent", () => {
  it("payment.updated (COMPLETED) marks the matching booking PAID", async () => {
    const db = getDb();
    const b = await seedBooking("ord_paid_1", "PENDING");
    await handleSquareEvent(db, {
      type: "payment.updated",
      data: { object: { payment: { id: "pay_1", order_id: "ord_paid_1", status: "COMPLETED" } } },
    });
    const updated = await db.booking.findUnique({ where: { id: b.id } });
    expect(updated?.paymentStatus).toBe("PAID");
  });

  it("payment.updated (not COMPLETED) leaves the booking PENDING", async () => {
    const db = getDb();
    const b = await seedBooking("ord_pending_1", "PENDING");
    await handleSquareEvent(db, {
      type: "payment.updated",
      data: { object: { payment: { id: "pay_2", order_id: "ord_pending_1", status: "APPROVED" } } },
    });
    const updated = await db.booking.findUnique({ where: { id: b.id } });
    expect(updated?.paymentStatus).toBe("PENDING");
  });

  it("invoice.payment_made activates a recurring schedule + creates its bookings", async () => {
    const db = getDb();
    const schedule = await db.recurringSchedule.create({
      data: {
        userId: studentId, coachId, categoryId,
        dayOfWeek: 1, startTime: "15:00", frequency: "WEEKLY", mode: "IN_PERSON",
        startsOn: new Date(Date.now() + 2 * 86_400_000),
        endsOn: new Date(Date.now() + 20 * 86_400_000),
        status: "ACTIVE", paymentStatus: "PENDING", squareSubscriptionId: "sqsub_sched_1",
      },
    });
    await handleSquareEvent(db, {
      type: "invoice.payment_made",
      data: { object: { invoice: { id: "inv_1", subscription_id: "sqsub_sched_1" } } },
    });
    const updated = await db.recurringSchedule.findUnique({ where: { id: schedule.id } });
    expect(updated?.paymentStatus).toBe("PAID");
    const bookings = await db.booking.findMany({ where: { scheduleId: schedule.id } });
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((b) => b.paymentStatus === "PAID")).toBe(true);

    // Idempotent — a duplicate delivery doesn't create a second batch.
    const countBefore = bookings.length;
    await handleSquareEvent(db, {
      type: "invoice.payment_made",
      data: { object: { invoice: { id: "inv_1", subscription_id: "sqsub_sched_1" } } },
    });
    expect(await db.booking.count({ where: { scheduleId: schedule.id } })).toBe(countBefore);
  });

  it("invoice.payment_made activates a PENDING package, then resets credits on renewal", async () => {
    const db = getDb();
    const plan = await db.subscriptionPlan.create({
      data: { coachId, name: "Starter", lessonsPerMonth: 4, priceMonthly: 8000 },
    });
    const now = new Date();
    await db.subscription.create({
      data: {
        userId: studentId, coachId, planId: plan.id, squareSubscriptionId: "sqsub_pkg_1",
        status: "PENDING", currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        lessonsUsedThisPeriod: 0,
      },
    });
    // First invoice → activate.
    await handleSquareEvent(db, {
      type: "invoice.payment_made",
      data: { object: { invoice: { id: "inv_pkg_1", subscription_id: "sqsub_pkg_1" } } },
    });
    let sub = await db.subscription.findUnique({ where: { squareSubscriptionId: "sqsub_pkg_1" } });
    expect(sub?.status).toBe("ACTIVE");

    // Use some credits, then force the period to look expired and renew.
    await db.subscription.update({
      where: { squareSubscriptionId: "sqsub_pkg_1" },
      data: { lessonsUsedThisPeriod: 3, currentPeriodEnd: new Date(Date.now() - 86_400_000) },
    });
    await handleSquareEvent(db, {
      type: "invoice.payment_made",
      data: { object: { invoice: { id: "inv_pkg_2", subscription_id: "sqsub_pkg_1" } } },
    });
    sub = await db.subscription.findUnique({ where: { squareSubscriptionId: "sqsub_pkg_1" } });
    expect(sub?.lessonsUsedThisPeriod).toBe(0);
    expect(sub?.status).toBe("ACTIVE");
  });

  it("invoice.payment_made does NOT reset credits mid-period (duplicate delivery)", async () => {
    const db = getDb();
    await db.subscription.update({
      where: { squareSubscriptionId: "sqsub_pkg_1" },
      data: { lessonsUsedThisPeriod: 2, currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000) },
    });
    await handleSquareEvent(db, {
      type: "invoice.payment_made",
      data: { object: { invoice: { id: "inv_pkg_2", subscription_id: "sqsub_pkg_1" } } },
    });
    const sub = await db.subscription.findUnique({ where: { squareSubscriptionId: "sqsub_pkg_1" } });
    expect(sub?.lessonsUsedThisPeriod).toBe(2);
  });

  it("invoice.scheduled_charge_failed marks the schedule PAST_DUE + notifies both sides", async () => {
    const db = getDb();
    const schedule = await db.recurringSchedule.create({
      data: {
        userId: studentId, coachId, categoryId,
        dayOfWeek: 1, startTime: "15:00", frequency: "WEEKLY", mode: "IN_PERSON",
        startsOn: new Date(Date.now() + 2 * 86_400_000),
        endsOn: new Date(Date.now() + 20 * 86_400_000),
        status: "ACTIVE", paymentStatus: "PAID", squareSubscriptionId: "sqsub_fail",
      },
    });
    const startsAt = new Date(Date.now() + 4 * 86_400_000);
    const anchor = await db.booking.create({
      data: { userId: studentId, coachId, categoryId, scheduleId: schedule.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), status: "CONFIRMED", paymentStatus: "PAID" },
    });
    await handleSquareEvent(db, {
      type: "invoice.scheduled_charge_failed",
      data: { object: { invoice: { id: "inv_fail", subscription_id: "sqsub_fail" } } },
    });
    const updated = await db.recurringSchedule.findUnique({ where: { id: schedule.id } });
    expect(updated?.paymentStatus).toBe("PAST_DUE");
    expect(await db.sessionMessage.count({ where: { bookingId: anchor.id } })).toBe(2);
  });

  it("subscription.updated (CANCELED) cancels the package subscription", async () => {
    const db = getDb();
    await handleSquareEvent(db, {
      type: "subscription.updated",
      data: { object: { subscription: { id: "sqsub_pkg_1", status: "CANCELED" } } },
    });
    const sub = await db.subscription.findUnique({ where: { squareSubscriptionId: "sqsub_pkg_1" } });
    expect(sub?.status).toBe("CANCELLED");
  });

  it("subscription.updated (CANCELED) cancels a schedule + its future bookings", async () => {
    const db = getDb();
    const schedule = await db.recurringSchedule.create({
      data: {
        userId: studentId, coachId, categoryId,
        dayOfWeek: 1, startTime: "15:00", frequency: "WEEKLY", mode: "IN_PERSON",
        startsOn: new Date(Date.now() + 2 * 86_400_000),
        endsOn: new Date(Date.now() + 20 * 86_400_000),
        status: "ACTIVE", paymentStatus: "PAID", squareSubscriptionId: "sqsub_cancel",
      },
    });
    const startsAt = new Date(Date.now() + 5 * 86_400_000);
    const future = await db.booking.create({
      data: { userId: studentId, coachId, categoryId, scheduleId: schedule.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), status: "CONFIRMED", paymentStatus: "PAID" },
    });
    await handleSquareEvent(db, {
      type: "subscription.updated",
      data: { object: { subscription: { id: "sqsub_cancel", status: "CANCELED" } } },
    });
    const updated = await db.recurringSchedule.findUnique({ where: { id: schedule.id } });
    expect(updated?.status).toBe("CANCELLED");
    const fb = await db.booking.findUnique({ where: { id: future.id } });
    expect(fb?.status).toBe("CANCELLED");
  });
});
