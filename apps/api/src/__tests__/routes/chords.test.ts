import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { resetDb } from "../../lib/db";
import type {
  ChordDeckOverviewPublic,
  ChordLevelDetailPublic,
  ChordSessionPublic,
  ChordSettingsPublic,
} from "@sunbird/shared";

let cleanup: () => void;
let cookie: string;

async function register(email: string): Promise<{ id: string; cookie: string }> {
  const res = await jsonRequest(app, "/api/auth/register", {
    method: "POST",
    body: { name: email.split("@")[0], email, password: "password123" },
  });
  return { id: ((await res.json()) as any).data.id, cookie: getSessionCookie(res)! };
}

beforeAll(async () => {
  resetDb();
  cleanup = createTestDb().cleanup;
  cookie = (await register("chords-student@example.com")).cookie;
});
afterAll(() => {
  resetDb();
  cleanup();
});

describe("Chord Flash Cards API", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await jsonRequest(app, "/api/me/chords/decks");
    expect(res.status).toBe(401);
  });

  it("serves the deck overview with six levels", async () => {
    const res = await jsonRequest(app, "/api/me/chords/decks", { cookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChordDeckOverviewPublic };
    expect(data.levels).toHaveLength(6);
    expect(data.levels[0].name).toBe("Open Chords");
    // Fresh student: nothing scheduled yet, all cards are new.
    expect(data.dueCount).toBe(0);
    expect(data.levels[0].masteryPct).toBe(0);
    expect(data.levels[0].dueCount).toBe(data.levels[0].chordCount);
  });

  it("serves a level's chord list", async () => {
    const res = await jsonRequest(app, "/api/me/chords/levels/1", { cookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChordLevelDetailPublic };
    const ids = data.chords.map((c) => c.id);
    expect(ids).toContain("c");
    expect(ids).toContain("am");
    expect(data.chords.every((c) => c.status === "new")).toBe(true);
  });

  it("returns new cards for a level session and full card shape", async () => {
    const res = await jsonRequest(app, "/api/me/chords/session?level=1", { cookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChordSessionPublic };
    expect(data.source).toBe("level");
    expect(data.cards.length).toBeGreaterThan(0);
    const card = data.cards[0];
    expect(card.tones.length).toBeGreaterThanOrEqual(2);
    expect(card.tones[0].degree).toMatch(/root/);
    expect(card.voicings.some((v) => v.recommended)).toBe(true);
    expect(card.voicings[0].shape.fingering).toHaveLength(6);
    expect(card.status).toBe("new");
  });

  it("grades a card and schedules it, moving mastery + due", async () => {
    // First "easy" on a fresh card schedules it a few days out (still
    // "learning" — mastery needs a week-plus interval).
    const g = await jsonRequest(app, "/api/me/chords/grade", {
      method: "POST",
      cookie,
      body: { chordId: "c", grade: "easy" },
    });
    expect(g.status).toBe(200);
    const { data } = (await g.json()) as { data: { status: string; intervalDays: number; dueAt: string } };
    expect(data.status).toBe("learning");
    expect(data.intervalDays).toBeGreaterThanOrEqual(4);

    // Mastery for level 1 should now be > 0 since one chord is known.
    const decks = await jsonRequest(app, "/api/me/chords/decks", { cookie });
    const overview = ((await decks.json()) as { data: ChordDeckOverviewPublic }).data;
    expect(overview.levels[0].masteryPct).toBeGreaterThan(0);
  });

  it("resurfaces a missed card immediately in the due deck", async () => {
    await jsonRequest(app, "/api/me/chords/grade", {
      method: "POST",
      cookie,
      body: { chordId: "am", grade: "again" },
    });
    const res = await jsonRequest(app, "/api/me/chords/session?deck=due", { cookie });
    const { data } = (await res.json()) as { data: ChordSessionPublic };
    expect(data.source).toBe("due");
    expect(data.cards.some((c) => c.id === "am")).toBe(true);
  });

  it("rejects an unknown chord id", async () => {
    const res = await jsonRequest(app, "/api/me/chords/grade", {
      method: "POST",
      cookie,
      body: { chordId: "not-a-chord", grade: "good" },
    });
    expect(res.status).toBe(404);
  });

  it("reads and updates settings", async () => {
    const initial = await jsonRequest(app, "/api/me/chords/settings", { cookie });
    const s0 = ((await initial.json()) as { data: ChordSettingsPublic }).data;
    expect(s0.handedness).toBe("right");
    expect(s0.micCheck).toBe(true);

    const put = await jsonRequest(app, "/api/me/chords/settings", {
      method: "PUT",
      cookie,
      body: { handedness: "left", newPerDay: 15, notation: "flat" },
    });
    expect(put.status).toBe(200);
    const s1 = ((await put.json()) as { data: ChordSettingsPublic }).data;
    expect(s1.handedness).toBe("left");
    expect(s1.newPerDay).toBe(15);
    expect(s1.notation).toBe("flat");

    // Notation should now flow into tone spelling on served cards.
    const sess = await jsonRequest(app, "/api/me/chords/session?level=2", { cookie });
    const { data } = (await sess.json()) as { data: ChordSessionPublic };
    const bb = data.cards.find((c) => c.id === "bb");
    if (bb) expect(bb.tones[0].note).toBe("Bb");
  });
});
