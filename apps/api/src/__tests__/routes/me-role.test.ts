import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { resetDb } from "../../lib/db";

let cleanup: () => void;

beforeAll(() => {
  resetDb();
  const db = createTestDb();
  cleanup = db.cleanup;
});

afterAll(() => {
  resetDb();
  cleanup();
});

// Registers a fresh user and returns their session cookie. New users are
// always roleChosen=false, which is what the picker endpoint operates on.
async function registerUser(email: string): Promise<string> {
  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: "Picker", email, password: "password123" },
  });
  expect(res.status).toBe(201);
  const cookie = getSessionCookie(res);
  expect(cookie).toBeTruthy();
  return cookie!;
}

describe("POST /api/me/role", () => {
  it("new users come back roleChosen=false", async () => {
    const cookie = await registerUser("picker-default@example.com");
    const me = await jsonRequest(app, "/api/me", { cookie });
    const body = (await me.json()) as any;
    expect(body.data.roleChosen).toBe(false);
    expect(body.data.role).toBe("STUDENT");
  });

  it("sets the chosen role and flips roleChosen", async () => {
    const cookie = await registerUser("picker-coach@example.com");
    const res = await jsonRequest(app, "/api/me/role", {
      method: "POST",
      cookie,
      body: { role: "COACH" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.role).toBe("COACH");
    expect(body.data.roleChosen).toBe(true);
  });

  it("rejects a second pick with 409", async () => {
    const cookie = await registerUser("picker-twice@example.com");
    const first = await jsonRequest(app, "/api/me/role", {
      method: "POST",
      cookie,
      body: { role: "STUDENT" },
    });
    expect(first.status).toBe(200);

    const second = await jsonRequest(app, "/api/me/role", {
      method: "POST",
      cookie,
      body: { role: "COACH" },
    });
    expect(second.status).toBe(409);
  });

  it("rejects an invalid role with 400", async () => {
    const cookie = await registerUser("picker-bad@example.com");
    const res = await jsonRequest(app, "/api/me/role", {
      method: "POST",
      cookie,
      body: { role: "ADMIN" },
    });
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await jsonRequest(app, "/api/me/role", {
      method: "POST",
      body: { role: "STUDENT" },
    });
    expect(res.status).toBe(401);
  });
});
