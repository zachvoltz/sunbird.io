import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { createTestDb, jsonRequest, getSessionCookie } from "../helpers";
import { resetDb } from "../../lib/db";
import type {
  ChordDeckOverviewPublic,
  ChordLevelDetailPublic,
  ChordLibraryDetailPublic,
  ChordLibraryListPublic,
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

  it("serves the deck overview with seven tiers", async () => {
    const res = await jsonRequest(app, "/api/me/chords/decks", { cookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChordDeckOverviewPublic };
    expect(data.levels).toHaveLength(7);
    expect(data.levels[0].name).toBe("Open majors & minors");
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
    expect(ids).toContain("c-major");
    expect(ids).toContain("a-minor");
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
      body: { chordId: "c-major", grade: "easy" },
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
      body: { chordId: "a-minor", grade: "again" },
    });
    const res = await jsonRequest(app, "/api/me/chords/session?deck=due", { cookie });
    const { data } = (await res.json()) as { data: ChordSessionPublic };
    expect(data.source).toBe("due");
    expect(data.cards.some((c) => c.id === "a-minor")).toBe(true);
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
  });

  it("serves theory-correct spellings + projected voicings for a barre chord", async () => {
    // Grade Bb7 so it's scheduled and reliably shows in the due deck.
    const g = await jsonRequest(app, "/api/me/chords/grade", {
      method: "POST",
      cookie,
      body: { chordId: "bb-7", grade: "again" },
    });
    expect(g.status).toBe(200);
    const res = await jsonRequest(app, "/api/me/chords/session?deck=due", { cookie });
    const { data } = (await res.json()) as { data: ChordSessionPublic };
    const bb7 = data.cards.find((c) => c.id === "bb-7");
    expect(bb7).toBeDefined();
    expect(bb7!.name).toBe("Bb7");
    expect(bb7!.tones.map((t) => t.note)).toEqual(["Bb", "D", "F", "Ab"]);
    // Window-relative library frets project to absolute positions across 6 strings.
    expect(bb7!.voicings[0].shape.fingering).toHaveLength(6);
    expect(bb7!.voicings.some((v) => v.recommended)).toBe(true);
  });

  it("browses the library grouped by root", async () => {
    const res = await jsonRequest(app, "/api/me/chords/library?root=C", { cookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChordLibraryListPublic };
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].root).toBe("C");
    const names = data.groups[0].items.map((i) => i.name);
    expect(names).toContain("Cmaj7");
    const cmaj7 = data.groups[0].items.find((i) => i.name === "Cmaj7")!;
    expect(cmaj7.shapeCount).toBeGreaterThan(1);
    expect(cmaj7.shape.fingering).toHaveLength(6);
  });

  it("fuzzy-searches (Cm surfaces Cmaj via alias)", async () => {
    const res = await jsonRequest(app, "/api/me/chords/library?q=Cm&root=C", { cookie });
    const { data } = (await res.json()) as { data: ChordLibraryListPublic };
    const names = data.groups.flatMap((g) => g.items).map((i) => i.name);
    expect(names).toContain("Cm7");
    expect(names).toContain("Cmaj7"); // fuzzy: "Cm" ⊂ alias "Cmaj7"
  });

  it("serves chord detail with per-voicing metadata", async () => {
    const res = await jsonRequest(app, "/api/me/chords/library/c-maj7", { cookie });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChordLibraryDetailPublic };
    expect(data.name).toBe("Cmaj7");
    expect(data.notes).toEqual(["C", "E", "G", "B"]);
    expect(data.voicings.length).toBeGreaterThan(1);
    const v = data.voicings[0];
    expect(v.position).toBeTruthy();
    expect(v.fingersLabel).toBeTruthy();
    expect(v.rootString).toMatch(/string/);
    expect(["beginner", "intermediate", "advanced"]).toContain(v.difficulty);
  });

  it("adds a library chord to practice (schedules it due)", async () => {
    const add = await jsonRequest(app, "/api/me/chords/library/g-major/add", { method: "POST", cookie });
    expect(add.status).toBe(200);
    expect(((await add.json()) as { data: { added: boolean } }).data.added).toBe(true);
    const due = await jsonRequest(app, "/api/me/chords/session?deck=due", { cookie });
    const { data } = (await due.json()) as { data: ChordSessionPublic };
    expect(data.cards.some((c) => c.id === "g-major")).toBe(true);
  });

  it("404s an unknown library chord", async () => {
    const res = await jsonRequest(app, "/api/me/chords/library/not-a-chord", { cookie });
    expect(res.status).toBe(404);
  });

  it("adds a Chord Flash Cards stop to the daily practice path", async () => {
    // Enable via chord settings.
    const put = await jsonRequest(app, "/api/me/chords/settings", {
      method: "PUT",
      cookie,
      body: { inDailyRoutine: true },
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { data: ChordSettingsPublic }).data.inDailyRoutine).toBe(true);

    // It appears on the student's routine (student-data).
    const sd1 = await jsonRequest(app, "/api/me/student-data", { cookie });
    const routine1 = ((await sd1.json()) as any).data.routine;
    const chordStop = routine1.items.find((it: any) => it.id === "chord-flashcards");
    expect(chordStop).toBeDefined();
    expect(chordStop.title).toBe("Chord Flash Cards");
    expect(chordStop.completedToday).toBe(false);

    // Completing it is accepted and reflected.
    const done = await jsonRequest(app, "/api/me/routine/complete", {
      method: "POST",
      cookie,
      body: { routineItemId: "chord-flashcards", completed: true },
    });
    expect(done.status).toBe(200);

    const sd2 = await jsonRequest(app, "/api/me/student-data", { cookie });
    const routine2 = ((await sd2.json()) as any).data.routine;
    expect(routine2.items.find((it: any) => it.id === "chord-flashcards").completedToday).toBe(true);
  });

  it("rejects the chord stop when it is not in the routine", async () => {
    // Turn it off, then completing it should 404.
    await jsonRequest(app, "/api/me/chords/settings", {
      method: "PUT",
      cookie,
      body: { inDailyRoutine: false },
    });
    const res = await jsonRequest(app, "/api/me/routine/complete", {
      method: "POST",
      cookie,
      body: { routineItemId: "chord-flashcards", completed: true },
    });
    expect(res.status).toBe(404);
  });

  it("adds, reorders, and completes the student's own exercises", async () => {
    const add = await jsonRequest(app, "/api/me/routine/custom", {
      method: "PUT",
      cookie,
      body: { items: [{ title: "Warm up" }, { title: "Scales", durationMin: 10 }] },
    });
    expect(add.status).toBe(200);
    const r1 = ((await add.json()) as any).data.items as Array<{ id: string; title: string }>;
    expect(r1).toHaveLength(2);
    expect(r1.every((i) => i.id.startsWith("custom-"))).toBe(true);
    expect(r1[0].title).toBe("Warm up");

    // They appear on the practice path.
    const sd = await jsonRequest(app, "/api/me/student-data", { cookie });
    const titles = ((await sd.json()) as any).data.routine.items.map((i: any) => i.title);
    expect(titles).toEqual(expect.arrayContaining(["Warm up", "Scales"]));

    // Completing one is accepted (custom ids are valid).
    const done = await jsonRequest(app, "/api/me/routine/complete", {
      method: "POST",
      cookie,
      body: { routineItemId: r1[0].id, completed: true },
    });
    expect(done.status).toBe(200);

    // Reorder keeps ids stable so completion history survives.
    const reorder = await jsonRequest(app, "/api/me/routine/custom", {
      method: "PUT",
      cookie,
      body: {
        items: [
          { id: r1[1].id, title: "Scales", durationMin: 10 },
          { id: r1[0].id, title: "Warm up" },
        ],
      },
    });
    const r2 = ((await reorder.json()) as any).data.items as Array<{ id: string }>;
    expect(r2[0].id).toBe(r1[1].id);
    expect(r2[1].id).toBe(r1[0].id);
  });

  it("rejects completing an item that isn't in the routine", async () => {
    const res = await jsonRequest(app, "/api/me/routine/complete", {
      method: "POST",
      cookie,
      body: { routineItemId: "custom-does-not-exist", completed: true },
    });
    expect(res.status).toBe(404);
  });
});
