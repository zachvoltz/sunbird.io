import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let coachCookie: string;
let studentId: string;
let studentCookie: string;
const SLUG = "scales-101";

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
  studentId = student.id;
  studentCookie = student.cookie;

  await db.path.create({
    data: {
      coachId, slug: SLUG, title: "Scales 101", status: "published",
      nodes: JSON.stringify([
        { id: "n1", col: 0, row: 0, title: "Major", titleB: "scale", meta: "" },
        { id: "n2", col: 1, row: 0, title: "Minor", titleB: "scale", meta: "" },
      ]),
      edges: JSON.stringify([["n1", "n2"]]),
    },
  });
});

afterAll(() => { resetDb(); cleanup(); });

describe("path assignment", () => {
  it("assigns a student and starts them on the first lesson", async () => {
    const res = await jsonRequest(app, `/api/paths/${SLUG}/assign`, {
      method: "POST", cookie: coachCookie, body: { studentId },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.id).toBe(studentId);
    expect(body.data.currentLessonId).toBe("n1");
  });

  it("is idempotent — re-assigning keeps a single enrollment", async () => {
    const res = await jsonRequest(app, `/api/paths/${SLUG}/assign`, {
      method: "POST", cookie: coachCookie, body: { studentId },
    });
    expect(res.status).toBe(201);
    const db = getDb();
    const count = await db.pathAssignment.count({ where: { studentId } });
    expect(count).toBe(1);
  });

  it("advances the student to a valid lesson", async () => {
    const res = await jsonRequest(app, `/api/paths/${SLUG}/assign/${studentId}`, {
      method: "PATCH", cookie: coachCookie, body: { currentLessonId: "n2" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).data.currentLessonId).toBe("n2");
  });

  it("rejects a lesson id not in the path", async () => {
    const res = await jsonRequest(app, `/api/paths/${SLUG}/assign/${studentId}`, {
      method: "PATCH", cookie: coachCookie, body: { currentLessonId: "nope" },
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/me/paths returns the student's path with current lesson", async () => {
    const res = await jsonRequest(app, "/api/me/paths", { cookie: studentCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.length).toBe(1);
    expect(body.data[0].slug).toBe(SLUG);
    expect(body.data[0].currentLessonId).toBe("n2");
    expect(body.data[0].nodes.length).toBe(2);
  });

  it("a coach who doesn't own the path can't assign (404)", async () => {
    const other = await register("coach2@example.com");
    const db = getDb();
    await db.user.update({ where: { id: other.id }, data: { role: "COACH" } });
    const res = await jsonRequest(app, `/api/paths/${SLUG}/assign`, {
      method: "POST", cookie: other.cookie, body: { studentId },
    });
    expect(res.status).toBe(404);
  });

  it("unassigns the student", async () => {
    const res = await jsonRequest(app, `/api/paths/${SLUG}/assign/${studentId}`, {
      method: "DELETE", cookie: coachCookie,
    });
    expect(res.status).toBe(200);
    const db = getDb();
    expect(await db.pathAssignment.count({ where: { studentId } })).toBe(0);
  });
});
