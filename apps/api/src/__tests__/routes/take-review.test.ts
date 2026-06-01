import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let coachCookie: string;
let studentId: string;
let takeId: string;

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

  studentId = (await register("student@example.com")).id;
  takeId = (await db.take.create({
    data: { studentId, coachId, pieceTitle: "Etude", durationSec: 48, status: "UNREVIEWED" },
  })).id;
});

afterAll(() => { resetDb(); cleanup(); });

describe("coach take review", () => {
  it("GET /api/coaches/takes/:id returns the take + student", async () => {
    const res = await jsonRequest(app, `/api/coaches/takes/${takeId}`, { cookie: coachCookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.id).toBe(takeId);
    expect(body.data.student.id).toBe(studentId);
    expect(body.data.annotations).toEqual([]);
  });

  it("adds an annotation and moves the take to REVIEWING", async () => {
    const res = await jsonRequest(app, `/api/coaches/takes/${takeId}/annotations`, {
      method: "POST",
      cookie: coachCookie,
      body: { kind: "LOVE", targetType: "TIMELINE", targetTimeSec: 14, text: "lovely swell here" },
    });
    expect(res.status).toBe(201);
    const ann = (await res.json()) as any;
    expect(ann.data.kind).toBe("LOVE");
    expect(ann.data.targetTimeSec).toBe(14);

    const db = getDb();
    const take = await db.take.findUnique({ where: { id: takeId }, select: { status: true } });
    expect(take?.status).toBe("REVIEWING");
  });

  it("rejects an invalid annotation kind (400)", async () => {
    const res = await jsonRequest(app, `/api/coaches/takes/${takeId}/annotations`, {
      method: "POST", cookie: coachCookie, body: { kind: "NOPE" },
    });
    expect(res.status).toBe(400);
  });

  it("deletes an annotation", async () => {
    const created = await jsonRequest(app, `/api/coaches/takes/${takeId}/annotations`, {
      method: "POST", cookie: coachCookie, body: { kind: "WATCH", targetType: "SCORE_BAR", targetBar: 20 },
    });
    const annId = ((await created.json()) as any).data.id;
    const del = await jsonRequest(app, `/api/coaches/takes/${takeId}/annotations/${annId}`, {
      method: "DELETE", cookie: coachCookie,
    });
    expect(del.status).toBe(200);
    const db = getDb();
    expect(await db.takeAnnotation.findUnique({ where: { id: annId } })).toBeNull();
  });

  it("forbids a coach who doesn't own the take", async () => {
    const other = await register("coach2@example.com");
    const db = getDb();
    await db.user.update({ where: { id: other.id }, data: { role: "COACH" } });
    const res = await jsonRequest(app, `/api/coaches/takes/${takeId}`, { cookie: other.cookie });
    expect(res.status).toBe(403);
  });
});
