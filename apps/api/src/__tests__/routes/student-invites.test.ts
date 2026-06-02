import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;
let coachCookie: string;

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
});

afterAll(() => { resetDb(); cleanup(); });

describe("student invites", () => {
  it("rejects an invite from a non-coach", async () => {
    const student = await register("randint@example.com");
    const res = await jsonRequest(app, "/api/coaches/invites", {
      method: "POST", cookie: student.cookie, body: { email: "x@example.com" },
    });
    expect(res.status).toBe(403);
  });

  it("creates a PENDING invite for a brand-new email and lists it gray", async () => {
    const res = await jsonRequest(app, "/api/coaches/invites", {
      method: "POST", cookie: coachCookie, body: { email: "New.Student@Example.com", name: "Newbie" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.status).toBe("PENDING");
    expect(body.data.email).toBe("new.student@example.com"); // lowercased

    const list = await jsonRequest(app, "/api/coaches/students", { cookie: coachCookie });
    const students = ((await list.json()) as any).data;
    const pending = students.find((s: any) => s.status === "PENDING");
    expect(pending).toBeTruthy();
    expect(pending.email).toBe("new.student@example.com");
    expect(pending.inviteId).toBe(body.data.id);
  });

  it("rejects a duplicate invite with 409", async () => {
    const res = await jsonRequest(app, "/api/coaches/invites", {
      method: "POST", cookie: coachCookie, body: { email: "new.student@example.com" },
    });
    expect(res.status).toBe(409);
  });

  it("flips a pending invite to ACTIVE when the invitee registers", async () => {
    const joined = await register("new.student@example.com");
    expect(joined.id).toBeTruthy();

    const list = await jsonRequest(app, "/api/coaches/students", { cookie: coachCookie });
    const students = ((await list.json()) as any).data;
    // No longer pending; now an active student linked by id.
    expect(students.find((s: any) => s.status === "PENDING")).toBeFalsy();
    const active = students.find((s: any) => s.email === "new.student@example.com");
    expect(active).toBeTruthy();
    expect(active.status).toBe("ACTIVE");
    expect(active.id).toBe(joined.id);
  });

  it("links an existing account immediately as ACTIVE (no pending step)", async () => {
    const existing = await register("already@example.com");
    expect(existing.id).toBeTruthy();

    const res = await jsonRequest(app, "/api/coaches/invites", {
      method: "POST", cookie: coachCookie, body: { email: "already@example.com" },
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).data.status).toBe("ACCEPTED");

    const list = await jsonRequest(app, "/api/coaches/students", { cookie: coachCookie });
    const students = ((await list.json()) as any).data;
    const linked = students.find((s: any) => s.email === "already@example.com");
    expect(linked.status).toBe("ACTIVE");
    expect(linked.id).toBe(existing.id);
  });

  it("revokes a pending invite", async () => {
    const create = await jsonRequest(app, "/api/coaches/invites", {
      method: "POST", cookie: coachCookie, body: { email: "revokeme@example.com" },
    });
    const inviteId = ((await create.json()) as any).data.id;

    const del = await jsonRequest(app, `/api/coaches/invites/${inviteId}`, {
      method: "DELETE", cookie: coachCookie,
    });
    expect(del.status).toBe(200);

    const list = await jsonRequest(app, "/api/coaches/students", { cookie: coachCookie });
    const students = ((await list.json()) as any).data;
    expect(students.find((s: any) => s.inviteId === inviteId)).toBeFalsy();
  });

  it("won't revoke an accepted invite", async () => {
    const invite = await getDb().studentInvite.findFirst({ where: { email: "already@example.com" } });
    const del = await jsonRequest(app, `/api/coaches/invites/${invite!.id}`, {
      method: "DELETE", cookie: coachCookie,
    });
    expect(del.status).toBe(409);
  });
});
