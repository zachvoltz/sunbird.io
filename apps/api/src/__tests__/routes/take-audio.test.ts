import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let studentId: string;
let studentCookie: string;
let coachId: string;
let takeId: string;

async function register(email: string) {
  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: email.split("@")[0], email, password: "password123" },
  });
  return { id: ((await res.json()) as any).data.id, cookie: getSessionCookie(res)! };
}

// Multipart upload helper — jsonRequest only does JSON, so build a Request.
function uploadReq(path: string, cookie: string | null) {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "take.webm");
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return app.request(new Request(`http://localhost${path}`, { method: "POST", headers, body: fd }));
}

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();
  const coach = await register("coach@example.com");
  coachId = coach.id;
  const student = await register("student@example.com");
  studentId = student.id;
  studentCookie = student.cookie;
  takeId = (await db.take.create({
    data: { studentId, coachId, pieceTitle: "Etude", durationSec: 30, status: "UNREVIEWED" },
  })).id;
});

afterAll(() => { resetDb(); cleanup(); });

describe("POST /api/me/takes/:id/audio (guards)", () => {
  it("404 for a missing take", async () => {
    const res = await uploadReq("/api/me/takes/nope/audio", studentCookie);
    expect(res.status).toBe(404);
  });

  it("403 when another student uploads to someone else's take", async () => {
    const other = await register("other@example.com");
    const res = await uploadReq(`/api/me/takes/${takeId}/audio`, other.cookie);
    expect(res.status).toBe(403);
  });

  it("401 unauthenticated", async () => {
    const res = await uploadReq(`/api/me/takes/${takeId}/audio`, null);
    expect(res.status).toBe(401);
  });

  it("501 for the owner when R2 isn't bound (no bucket in test env)", async () => {
    const res = await uploadReq(`/api/me/takes/${takeId}/audio`, studentCookie);
    expect(res.status).toBe(501);
  });

  it("serve route 501s without a bucket", async () => {
    const res = await jsonRequest(app, "/api/me/takes/audio/takes/x/y/z.webm");
    expect(res.status).toBe(501);
  });
});
