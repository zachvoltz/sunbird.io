import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let coachCookie: string;
let categoryId: string;
let studentId: string;
let studentCookie: string;

async function register(email: string): Promise<{ id: string; cookie: string }> {
  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: email.split("@")[0], email, password: "password123" },
  });
  return { id: ((await res.json()) as any).data.id, cookie: getSessionCookie(res)! };
}

async function seedBooking(status = "CONFIRMED"): Promise<string> {
  const db = getDb();
  const startsAt = new Date(Date.now() + 3 * 86_400_000);
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

  // Register the coach via the API (so they get a session), then promote.
  const coach = await register("coach@example.com");
  coachId = coach.id;
  coachCookie = coach.cookie;
  await db.user.update({ where: { id: coachId }, data: { role: "COACH" } });

  const student = await register("student@example.com");
  studentId = student.id;
  studentCookie = student.cookie;

  const category = await db.category.create({
    data: { slug: "guitar", title: "Guitar", description: "Six strings." },
  });
  categoryId = category.id;
  await db.coachCategory.create({ data: { coachId, categoryId } });
});

afterAll(() => {
  resetDb();
  cleanup();
});

async function coachInbox(): Promise<any[]> {
  const res = await jsonRequest(app, "/api/coaches/inbox", { cookie: coachCookie });
  return ((await res.json()) as any).data.items;
}
async function studentInbox(): Promise<any[]> {
  const res = await jsonRequest(app, "/api/me/inbox", { cookie: studentCookie });
  return ((await res.json()) as any).data.items;
}

describe("booking-change notifications", () => {
  it("student cancels → coach inbox gains a message", async () => {
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/cancel`, { method: "PATCH", cookie: studentCookie });
    expect(res.status).toBe(200);
    const items = await coachInbox();
    expect(items.some((m) => m.bookingId === id && /Cancelled/i.test(m.content))).toBe(true);
  });

  it("coach cancels → student inbox gains a message", async () => {
    const id = await seedBooking();
    const res = await jsonRequest(app, `/api/bookings/${id}/cancel`, { method: "PATCH", cookie: coachCookie });
    expect(res.status).toBe(200);
    const items = await studentInbox();
    expect(items.some((m) => m.bookingId === id && /Cancelled/i.test(m.content))).toBe(true);
  });
});

describe("take notifications", () => {
  it("new take → coach inbox gains a message", async () => {
    await seedBooking(); // gives the take a coach + booking to attach to
    const res = await jsonRequest(app, "/api/me/takes", {
      method: "POST",
      cookie: studentCookie,
      body: { pieceTitle: "Minuet in G", durationSec: 42 },
    });
    expect(res.status).toBe(201);
    const items = await coachInbox();
    expect(items.some((m) => /New take: Minuet in G/.test(m.content))).toBe(true);
  });

  it("coach reply → student inbox + take marked REPLIED", async () => {
    const db = getDb();
    await seedBooking();
    const take = await db.take.create({
      data: { studentId, coachId, pieceTitle: "Gymnopédie", durationSec: 60, status: "UNREVIEWED" },
    });
    const res = await jsonRequest(app, `/api/coaches/takes/${take.id}/reply`, {
      method: "POST",
      cookie: coachCookie,
      body: { text: "Lovely phrasing — watch the tempo in bar 8." },
    });
    expect(res.status).toBe(201);

    const items = await studentInbox();
    expect(items.some((m) => /replied on your "Gymnopédie" take/.test(m.content))).toBe(true);

    const updated = await db.take.findUnique({ where: { id: take.id }, select: { status: true } });
    expect(updated?.status).toBe("REPLIED");
  });

  it("a different coach cannot reply on someone else's take (403)", async () => {
    const db = getDb();
    const other = await register("coach2@example.com");
    await db.user.update({ where: { id: other.id }, data: { role: "COACH" } });
    const take = await db.take.create({
      data: { studentId, coachId, pieceTitle: "Etude", durationSec: 30, status: "UNREVIEWED" },
    });
    const res = await jsonRequest(app, `/api/coaches/takes/${take.id}/reply`, {
      method: "POST",
      cookie: other.cookie,
      body: { text: "nope" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects an empty reply (400)", async () => {
    const db = getDb();
    const take = await db.take.create({
      data: { studentId, coachId, pieceTitle: "Empty", durationSec: 10, status: "UNREVIEWED" },
    });
    const res = await jsonRequest(app, `/api/coaches/takes/${take.id}/reply`, {
      method: "POST",
      cookie: coachCookie,
      body: { starRating: 5 },
    });
    expect(res.status).toBe(400);
  });
});
