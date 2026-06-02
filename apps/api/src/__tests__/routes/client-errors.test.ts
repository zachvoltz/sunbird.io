import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest } from "../helpers";
import { resetDb } from "../../lib/db";

let cleanup: () => void;

beforeAll(() => {
  resetDb();
  cleanup = createTestDb().cleanup;
});
afterAll(() => { resetDb(); cleanup(); });

describe("POST /api/client-errors", () => {
  it("accepts a report (204), unauthenticated", async () => {
    const res = await jsonRequest(app, "/api/client-errors", {
      method: "POST",
      body: { name: "TypeError", message: "x is not a function", source: "boundary" },
    });
    expect(res.status).toBe(204);
  });

  it("acknowledges an oversized body without erroring", async () => {
    const res = await jsonRequest(app, "/api/client-errors", {
      method: "POST",
      body: { message: "a".repeat(20_000) },
    });
    expect(res.status).toBe(204);
  });

  it("acknowledges invalid JSON without erroring", async () => {
    const res = await app.request(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(204);
  });
});
