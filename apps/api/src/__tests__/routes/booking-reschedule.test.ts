import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let categoryId: string;
let studentCookie: string;
let studentId: string;

// A valid future slot the coach is available for: 7 days out at 15:00 UTC.
const target = new Date(Date.now() + 7 * 86_400_000);
target.setUTCHours(15, 0, 0, 0);
const TARGET_ISO = target.toISOString();
// Same day, 16:00 UTC — no availability row, so reschedule there must fail.
const noAvail = new Date(target);
noAvail.setUTCHours(16, 0, 0, 0);
const NO_AVAIL_ISO = noAvail.toISOString();

// Seed a CONFIRMED booking for the student with the coach at an arbitrary time.
async function seedBooking(status = "CONFIRMED"): Promise<string> {
  const db = getDb();
  const startsAt = new Date(Date.now() + 2 * 86_400_000);
  const b = await db.booking.create({
    data: {
      userId: studentId,
      coachId,
      categoryId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      status,
    },
  });
  return b.id;
}

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;

  const db = getDb();
  const coach = await db.user.create({
    data: { name: "Coach Carla", email: "coach@example.com", role: "COACH", roleChosen: true },
  });
  coachId = coach.id;
  const category = await db.category.create({
    data: { slug: "guitar", title: "Guitar", description: "Six strings." },
  });
  categoryId = category.id;
  await db.coachCategory.create({ data: { coachId, categoryId } });
  await db.coachAvailability.create({
    data: { coachId, dayOfWeek: target.getUTCDay(), startTime: "15:00", endTime: "16:00", isActive: true },
  });

  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: "Student Sam", email: "student@example.com", password: "password123" },
  });
  studentCookie = getSessionCookie(res)!;
  studentId = ((await res.json()) as any).data.id;
});

afterAll(() => {
  resetDb();
  cleanup();
});

describe("PATCH /api/bookings/:id/reschedule", () => {
  it("moves the booking to a valid new slot and stays CONFIRMED", async () => {
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      cookie: studentCookie,
      body: { newStartsAt: TARGET_ISO },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.startsAt).toBe(TARGET_ISO);
    expect(body.data.status).toBe("CONFIRMED");
  });

  it("rejects a slot outside the coach's availability (400)", async () => {
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      cookie: studentCookie,
      body: { newStartsAt: NO_AVAIL_ISO },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a slot that conflicts with another booking (409)", async () => {
    // Occupy the target slot with a different booking for the same coach.
    const db = getDb();
    await db.booking.create({
      data: {
        userId: studentId,
        coachId,
        categoryId,
        startsAt: target,
        endsAt: new Date(target.getTime() + 60 * 60 * 1000),
        status: "CONFIRMED",
      },
    });
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      cookie: studentCookie,
      body: { newStartsAt: TARGET_ISO },
    });
    expect(res.status).toBe(409);
  });

  it("rejects a non-CONFIRMED booking (400)", async () => {
    const id = await seedBooking("CANCELLED");
    const res = await jsonRequest(app, `/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      cookie: studentCookie,
      body: { newStartsAt: TARGET_ISO },
    });
    expect(res.status).toBe(400);
  });

  it("forbids a different student (403)", async () => {
    const other = await jsonRequest(app, "/api/auth/register", {
      method: "POST",
      body: { name: "Other", email: "other@example.com", password: "password123" },
    });
    const otherCookie = getSessionCookie(other)!;
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      cookie: otherCookie,
      body: { newStartsAt: TARGET_ISO },
    });
    expect(res.status).toBe(403);
  });

  it("requires authentication (401)", async () => {
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      body: { newStartsAt: TARGET_ISO },
    });
    expect(res.status).toBe(401);
  });
});
