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

describe("POST /api/auth/register", () => {
  it("creates a new user and returns session cookie", async () => {
    const res = await jsonRequest(app, "/api/auth/register", {
      method: "POST",
      body: { name: "Test User", email: "test@example.com", password: "password123" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.name).toBe("Test User");
    expect(body.data.role).toBe("STUDENT");
    expect(getSessionCookie(res)).toBeTruthy();
  });

  it("returns 409 for duplicate email", async () => {
    const res = await jsonRequest(app, "/api/auth/register", {
      method: "POST",
      body: { name: "Dupe", email: "test@example.com", password: "password123" },
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid input", async () => {
    const res = await jsonRequest(app, "/api/auth/register", {
      method: "POST",
      body: { name: "", email: "bad", password: "short" },
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials", async () => {
    const res = await jsonRequest(app, "/api/auth/login", {
      method: "POST",
      body: { email: "test@example.com", password: "password123" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email).toBe("test@example.com");
    expect(getSessionCookie(res)).toBeTruthy();
  });

  it("returns 401 for wrong password", async () => {
    const res = await jsonRequest(app, "/api/auth/login", {
      method: "POST",
      body: { email: "test@example.com", password: "wrongpassword" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for nonexistent user", async () => {
    const res = await jsonRequest(app, "/api/auth/login", {
      method: "POST",
      body: { email: "nobody@example.com", password: "password123" },
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/me", () => {
  it("returns user when authenticated", async () => {
    // Login first to get session cookie
    const loginRes = await jsonRequest(app, "/api/auth/login", {
      method: "POST",
      body: { email: "test@example.com", password: "password123" },
    });
    const cookie = getSessionCookie(loginRes)!;

    const res = await jsonRequest(app, "/api/me", { cookie });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email).toBe("test@example.com");
  });

  it("returns 401 when not authenticated", async () => {
    const res = await jsonRequest(app, "/api/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears session cookie", async () => {
    // Login first
    const loginRes = await jsonRequest(app, "/api/auth/login", {
      method: "POST",
      body: { email: "test@example.com", password: "password123" },
    });
    const cookie = getSessionCookie(loginRes)!;

    const res = await jsonRequest(app, "/api/auth/logout", {
      method: "POST",
      cookie,
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 401 when not authenticated", async () => {
    const res = await jsonRequest(app, "/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(401);
  });
});
