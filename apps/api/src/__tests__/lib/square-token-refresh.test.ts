import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers";
import { getDb, resetDb } from "../../lib/db";
import { processSquareTokenRefresh } from "../../lib/square-token-refresh";

let cleanup: () => void;

const ENV = {
  SQUARE_ENVIRONMENT: "sandbox",
  SQUARE_APPLICATION_ID: "app_id",
  SQUARE_APPLICATION_SECRET: "app_secret",
};

const FAR = new Date(Date.now() + 40 * 86_400_000); // ~40 days out (not due)
const SOON = new Date(Date.now() + 2 * 86_400_000); // ~2 days out (within 7d window)

async function makeCoach(over: Record<string, any>) {
  return getDb().user.create({
    data: {
      name: "Coach", email: `c${Math.random()}@e.com`, role: "COACH", roleChosen: true,
      paymentProvider: "SQUARE", squareConnected: true,
      squareAccessToken: "old_access", squareRefreshToken: "refresh_tok",
      ...over,
    },
  });
}

beforeAll(() => { resetDb(); cleanup = createTestDb().cleanup; });
afterAll(() => { resetDb(); cleanup(); });

describe("processSquareTokenRefresh", () => {
  it("refreshes tokens within the expiry window and skips ones that aren't due", async () => {
    const db = getDb();
    const due = await makeCoach({ squareTokenExpiresAt: SOON });
    const notDue = await makeCoach({ squareTokenExpiresAt: FAR });

    const newExpiry = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const res = await processSquareTokenRefresh(db, ENV, new Date(), {
      refresh: async () => ({
        accessToken: "new_access", refreshToken: "new_refresh",
        expiresAt: newExpiry, merchantId: "m1",
      }),
    });

    expect(res.refreshed).toBe(1);
    expect(res.failed).toBe(0);

    const dueAfter = await db.user.findUnique({ where: { id: due.id } });
    expect(dueAfter?.squareAccessToken).toBe("new_access");
    expect(dueAfter?.squareRefreshToken).toBe("new_refresh");

    const notDueAfter = await db.user.findUnique({ where: { id: notDue.id } });
    expect(notDueAfter?.squareAccessToken).toBe("old_access"); // untouched
  });

  it("counts failures without throwing, keeping the old token", async () => {
    const db = getDb();
    const coach = await makeCoach({ squareTokenExpiresAt: SOON });
    const res = await processSquareTokenRefresh(db, ENV, new Date(), {
      refresh: async () => { throw new Error("invalid_grant"); },
    });
    expect(res.failed).toBeGreaterThanOrEqual(1);
    const after = await db.user.findUnique({ where: { id: coach.id } });
    expect(after?.squareAccessToken).toBe("old_access");
  });

  it("no-ops when Square platform creds aren't configured", async () => {
    const res = await processSquareTokenRefresh(getDb(), { SQUARE_ENVIRONMENT: "sandbox" }, new Date(), {
      refresh: async () => { throw new Error("should not be called"); },
    });
    expect(res).toEqual({ refreshed: 0, failed: 0 });
  });
});
