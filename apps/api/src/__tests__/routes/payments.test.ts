import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let categoryId: string;
let studentCookie: string;

// A valid future slot the coach is available for.
const target = new Date(Date.now() + 7 * 86_400_000);
target.setUTCHours(15, 0, 0, 0);

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();

  // Coach with NO Stripe account / no session price → lessons are free.
  coachId = (await db.user.create({ data: { name: "Free Coach", email: "free@example.com", role: "COACH", roleChosen: true } })).id;
  categoryId = (await db.category.create({ data: { slug: "guitar", title: "Guitar", description: "x" } })).id;
  await db.coachCategory.create({ data: { coachId, categoryId } });
  await db.coachAvailability.create({ data: { coachId, dayOfWeek: target.getUTCDay(), startTime: "15:00", endTime: "16:00", isActive: true } });

  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: "Student", email: "student@example.com", password: "password123" },
  });
  studentCookie = getSessionCookie(res)!;
});

afterAll(() => { resetDb(); cleanup(); });

describe("POST /api/bookings — free path (coach has no Stripe)", () => {
  it("creates a NOT_REQUIRED booking with no checkout URL", async () => {
    const res = await jsonRequest(app, "/api/bookings", {
      method: "POST",
      cookie: studentCookie,
      body: { categoryId, coachId, startsAt: target.toISOString(), mode: "IN_PERSON" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.checkoutUrl).toBeUndefined();
    expect(body.data.paymentStatus).toBe("NOT_REQUIRED");
  });
});
