import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest } from "../helpers";
import { getDb, resetDb } from "../../lib/db";

let cleanup: () => void;
let coachId: string;

// A target date ~10 days out, anchored in UTC. The coach's availability is
// seeded for THIS date's UTC day-of-week so the endpoint must agree with
// booking validation (which uses getUTCDay()).
const target = new Date(Date.now() + 10 * 86_400_000);
const DATE_STR = target.toISOString().slice(0, 10);
const UTC_DOW = new Date(DATE_STR + "T00:00:00Z").getUTCDay();

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();
  coachId = (await db.user.create({ data: { name: "Coach", email: "c@example.com", role: "COACH", roleChosen: true } })).id;
  await db.coachAvailability.create({
    data: { coachId, dayOfWeek: UTC_DOW, startTime: "15:00", endTime: "16:00", isActive: true },
  });
});

afterAll(() => { resetDb(); cleanup(); });

describe("GET /api/availability (UTC consistency)", () => {
  it("returns the slot at the UTC wall-clock the coach set", async () => {
    const res = await jsonRequest(app, `/api/availability?date=${DATE_STR}`);
    expect(res.status).toBe(200);
    const slots = ((await res.json()) as any).data as { startsAt: string; coachIds: string[] }[];
    const slot = slots.find((s) => s.startsAt === `${DATE_STR}T15:00:00.000Z`);
    expect(slot).toBeTruthy();
    expect(slot!.coachIds).toContain(coachId);
  });

  it("rejects a date in the past (UTC bound)", async () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    const res = await jsonRequest(app, `/api/availability?date=${past}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/availability?coachId= (pinned coach)", () => {
  let coach2Id: string;

  beforeAll(async () => {
    const db = getDb();
    // A second coach available at the same 15:00 slot as the first.
    coach2Id = (await db.user.create({ data: { name: "Coach Two", email: "c2@example.com", role: "COACH", roleChosen: true } })).id;
    await db.coachAvailability.create({
      data: { coachId: coach2Id, dayOfWeek: UTC_DOW, startTime: "15:00", endTime: "16:00", isActive: true },
    });
  });

  it("without a coachId, the shared slot lists both coaches", async () => {
    const res = await jsonRequest(app, `/api/availability?date=${DATE_STR}`);
    const slots = ((await res.json()) as any).data as { startsAt: string; coachIds: string[] }[];
    const slot = slots.find((s) => s.startsAt === `${DATE_STR}T15:00:00.000Z`);
    expect(slot!.coachIds).toEqual(expect.arrayContaining([coachId, coach2Id]));
  });

  it("with a coachId, slots are restricted to that coach", async () => {
    const res = await jsonRequest(app, `/api/availability?date=${DATE_STR}&coachId=${coach2Id}`);
    const slots = ((await res.json()) as any).data as { startsAt: string; coachIds: string[] }[];
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) expect(s.coachIds).toEqual([coach2Id]);
  });
});
