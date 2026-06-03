import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let coachCookie: string;
let studentId: string;
let studentCookie: string;
let otherStudentId: string;
let otherStudentCookie: string;
let categoryId: string;

const DAY = 86_400_000;
// Three lessons for the coach+student pair, plus a CANCELLED one between the
// first two and a same-time lesson with a different student.
const ids: Record<string, string> = {};

async function register(name: string, email: string) {
  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name, email, password: "password123" },
  });
  return { id: ((await res.json()) as any).data.id, cookie: getSessionCookie(res)! };
}

async function makeBooking(userId: string, offsetDays: number, status: string): Promise<string> {
  const db = getDb();
  const startsAt = new Date(Date.now() + offsetDays * DAY);
  const b = await db.booking.create({
    data: {
      userId,
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

  const coach = await register("Coach Carla", "coach@example.com");
  coachId = coach.id;
  coachCookie = coach.cookie;
  await db.user.update({ where: { id: coachId }, data: { role: "COACH" } });

  const student = await register("Student Sam", "student@example.com");
  studentId = student.id;
  studentCookie = student.cookie;

  const other = await register("Other Olive", "other@example.com");
  otherStudentId = other.id;
  otherStudentCookie = other.cookie;

  const category = await db.category.create({
    data: { slug: "guitar", title: "Guitar", description: "Six strings." },
  });
  categoryId = category.id;

  ids.t1 = await makeBooking(studentId, -5, "COMPLETED");
  ids.cancelled = await makeBooking(studentId, -3, "CANCELLED"); // between t1 and t2
  ids.t2 = await makeBooking(studentId, 2, "CONFIRMED"); // middle
  ids.t3 = await makeBooking(studentId, 6, "CONFIRMED");
  ids.other = await makeBooking(otherStudentId, 1, "CONFIRMED"); // different student
});

afterAll(() => { resetDb(); cleanup(); });

describe("GET /api/bookings/:id/adjacent", () => {
  it("returns prev/next for the same pair, skipping cancelled, for the student", async () => {
    const res = await jsonRequest(app, `/api/bookings/${ids.t2}/adjacent`, { cookie: studentCookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as any;
    expect(data.prev.id).toBe(ids.t1); // not the cancelled one
    expect(data.next.id).toBe(ids.t3); // not the other student's
  });

  it("returns the same result for the coach", async () => {
    const res = await jsonRequest(app, `/api/bookings/${ids.t2}/adjacent`, { cookie: coachCookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as any;
    expect(data.prev.id).toBe(ids.t1);
    expect(data.next.id).toBe(ids.t3);
  });

  it("has no prev for the earliest lesson", async () => {
    const res = await jsonRequest(app, `/api/bookings/${ids.t1}/adjacent`, { cookie: studentCookie });
    const { data } = (await res.json()) as any;
    expect(data.prev).toBeNull();
    expect(data.next.id).toBe(ids.t2);
  });

  it("has no next for the latest lesson", async () => {
    const res = await jsonRequest(app, `/api/bookings/${ids.t3}/adjacent`, { cookie: studentCookie });
    const { data } = (await res.json()) as any;
    expect(data.next).toBeNull();
    expect(data.prev.id).toBe(ids.t2);
  });

  it("forbids a student who doesn't own the booking", async () => {
    const res = await jsonRequest(app, `/api/bookings/${ids.t2}/adjacent`, { cookie: otherStudentCookie });
    expect(res.status).toBe(403);
  });

  it("404s for an unknown booking", async () => {
    const res = await jsonRequest(app, `/api/bookings/does-not-exist/adjacent`, { cookie: studentCookie });
    expect(res.status).toBe(404);
  });
});
