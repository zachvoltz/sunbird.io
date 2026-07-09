// Chord Flash Cards — spaced-repetition chord trainer endpoints.
// Mounted at /api/me/chords; every route is per-authenticated-student.
//
//   GET  /decks             deck-picker overview (levels + mastery + due)
//   GET  /levels/:levelId   one level's chords with per-student status
//   GET  /session           the ordered review queue (?deck=due | ?level=N)
//   POST /grade             grade one card → advance the SRS schedule
//   GET  /settings          the student's trainer preferences
//   PUT  /settings          update preferences
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../lib/db";
import { gradeChordSchema, updateChordSettingsSchema } from "@sunbird/shared";
import type {
  ChordDeckOverviewPublic,
  ChordLevelDetailPublic,
  ChordLevelSummaryPublic,
  ChordSessionPublic,
  ChordSettingsPublic,
} from "@sunbird/shared";
import { CATALOG, getCatalogChord, levelById, toCard } from "../lib/chordCatalog";
import { isDue, masteryPct, schedule, statusOf, type ProgressRow } from "../lib/chordSrs";

type ChordsEnv = {
  Variables: {
    user: { id: string; email: string; name: string; avatarUrl: string | null; bio: string | null; role: string; roleChosen: boolean } | null;
    sessionId: string | null;
  };
};

const chords = new Hono<ChordsEnv>();

// A level below this mastery gates the next level (only when levelGating is on).
const GATING_THRESHOLD = 60;
const SESSION_LIMIT = 30;

const DEFAULT_SETTINGS: ChordSettingsPublic = {
  handedness: "right",
  notation: "sharp",
  theme: "light",
  newPerDay: 10,
  levelGating: false,
  micCheck: true,
};

type SettingsRow = {
  handedness: string;
  notation: string;
  theme: string;
  newPerDay: number;
  levelGating: boolean;
  micCheck: boolean;
} | null;

function toSettings(row: SettingsRow): ChordSettingsPublic {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    handedness: row.handedness === "left" ? "left" : "right",
    notation: row.notation === "flat" ? "flat" : "sharp",
    theme: row.theme === "dark" ? "dark" : row.theme === "auto" ? "auto" : "light",
    newPerDay: row.newPerDay,
    levelGating: row.levelGating,
    micCheck: row.micCheck,
  };
}

async function loadContext(userId: string) {
  const db = getDb();
  const [settingsRow, progressRows] = await Promise.all([
    db.chordSettings.findUnique({ where: { userId } }),
    db.chordProgress.findMany({
      where: { userId },
      select: { chordId: true, status: true, intervalDays: true, dueAt: true },
    }),
  ]);
  const settings = toSettings(settingsRow as SettingsRow);
  const byId = new Map<string, ProgressRow>();
  for (const r of progressRows) byId.set(r.chordId, r as ProgressRow);
  return { settings, byId };
}

// Per-level summaries + which levels are locked (gating). `prevMastery`
// carries the previous level's mastery so gating can look one level back.
function summarizeLevels(
  byId: Map<string, ProgressRow>,
  levelGating: boolean,
  now: Date,
): ChordLevelSummaryPublic[] {
  const out: ChordLevelSummaryPublic[] = [];
  let prevMastery = 100; // level 1 is always reachable
  for (const level of CATALOG) {
    const chordIds = level.chords.map((c) => c.id);
    const mastery = masteryPct(chordIds, byId);
    const dueNow = chordIds.filter((id) => {
      const r = byId.get(id);
      return r ? isDue(r, now) : false;
    }).length;
    const newCount = chordIds.filter((id) => !byId.has(id)).length;
    const locked = levelGating && level.id > 1 && prevMastery < GATING_THRESHOLD;
    out.push({
      id: level.id,
      name: level.name,
      desc: level.desc,
      masteryPct: mastery,
      dueCount: dueNow + newCount,
      chordCount: chordIds.length,
      locked,
    });
    prevMastery = mastery;
  }
  return out;
}

// GET /decks — the home / deck-picker screen.
chords.get("/decks", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { settings, byId } = await loadContext(user.id);
  const now = new Date();
  const levels = summarizeLevels(byId, settings.levelGating, now);

  // The top "Due for review" badge is scheduled reviews only (weak cards
  // that have come due), across unlocked levels — new cards aren't "due".
  const lockedIds = new Set(levels.filter((l) => l.locked).map((l) => l.id));
  let dueCount = 0;
  for (const level of CATALOG) {
    if (lockedIds.has(level.id)) continue;
    for (const chord of level.chords) {
      const r = byId.get(chord.id);
      if (r && isDue(r, now)) dueCount += 1;
    }
  }

  const payload: ChordDeckOverviewPublic = { dueCount, levels };
  return c.json({ data: payload });
});

// GET /levels/:levelId — one level's chord list with per-student status.
chords.get("/levels/:levelId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const levelId = Number(c.req.param("levelId"));
  const level = levelById(levelId);
  if (!level) return c.json({ error: "Level not found" }, 404);

  const { byId } = await loadContext(user.id);
  const now = new Date();
  const chordIds = level.chords.map((ch) => ch.id);
  const dueCount =
    chordIds.filter((id) => {
      const r = byId.get(id);
      return r ? isDue(r, now) : false;
    }).length + chordIds.filter((id) => !byId.has(id)).length;

  const payload: ChordLevelDetailPublic = {
    id: level.id,
    name: level.name,
    desc: level.desc,
    masteryPct: masteryPct(chordIds, byId),
    dueCount,
    chords: level.chords.map((ch) => ({
      id: ch.id,
      name: ch.name,
      status: statusOf(byId.get(ch.id)),
    })),
  };
  return c.json({ data: payload });
});

// GET /session?deck=due  |  /session?level=N — the ordered review queue.
chords.get("/session", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { settings, byId } = await loadContext(user.id);
  const now = new Date();
  const notation = settings.notation;

  const levelParam = c.req.query("level");
  const wantLevel = levelParam ? Number(levelParam) : null;

  type Pick = { chordId: string; levelId: number; order: number };
  const picks: Pick[] = [];

  if (wantLevel && Number.isFinite(wantLevel)) {
    // ── level session: due cards first, then a capped set of new cards,
    // falling back to the whole level if nothing is outstanding. ──
    const level = levelById(wantLevel);
    if (!level) return c.json({ error: "Level not found" }, 404);

    const due: Pick[] = [];
    const fresh: Pick[] = [];
    for (const chord of level.chords) {
      const r = byId.get(chord.id);
      if (!r) fresh.push({ chordId: chord.id, levelId: level.id, order: 1 });
      else if (isDue(r, now)) due.push({ chordId: chord.id, levelId: level.id, order: 0 });
    }
    due.sort((a, b) => sortByDue(byId, a.chordId, b.chordId));
    picks.push(...due, ...fresh.slice(0, settings.newPerDay));
    // Nothing outstanding → let the student drill the whole level anyway.
    if (picks.length === 0) {
      picks.push(...level.chords.map((ch) => ({ chordId: ch.id, levelId: level.id, order: 0 })));
    }
    const cards = picks
      .slice(0, SESSION_LIMIT)
      .map((p) => makeCard(p, byId, notation))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const payload: ChordSessionPublic = { source: "level", levelId: level.id, cards };
    return c.json({ data: payload });
  }

  // ── due deck: every scheduled card that has come due, across unlocked
  // levels, soonest first. ──
  const lockedIds = lockedLevelIds(byId, settings.levelGating, now);
  for (const level of CATALOG) {
    if (lockedIds.has(level.id)) continue;
    for (const chord of level.chords) {
      const r = byId.get(chord.id);
      if (r && isDue(r, now)) picks.push({ chordId: chord.id, levelId: level.id, order: 0 });
    }
  }
  picks.sort((a, b) => sortByDue(byId, a.chordId, b.chordId));
  const cards = picks
    .slice(0, SESSION_LIMIT)
    .map((p) => makeCard(p, byId, notation))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const payload: ChordSessionPublic = { source: "due", levelId: null, cards };
  return c.json({ data: payload });
});

// POST /grade — grade one card and advance its schedule.
chords.post("/grade", requireAuth, async (c) => {
  const user = c.get("user")!;
  const parsed = gradeChordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid grade" }, 400);
  }
  const { chordId, grade } = parsed.data;
  if (!getCatalogChord(chordId)) return c.json({ error: "Unknown chord" }, 404);

  const db = getDb();
  const now = new Date();
  const prev = await db.chordProgress.findUnique({
    where: { userId_chordId: { userId: user.id, chordId } },
    select: { reps: true, lapses: true, ease: true, intervalDays: true },
  });
  const next = schedule(prev, grade, now);

  await db.chordProgress.upsert({
    where: { userId_chordId: { userId: user.id, chordId } },
    update: {
      status: next.status,
      reps: next.reps,
      lapses: next.lapses,
      ease: next.ease,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt,
      lastGrade: next.lastGrade,
      lastReviewedAt: next.lastReviewedAt,
    },
    create: {
      userId: user.id,
      chordId,
      status: next.status,
      reps: next.reps,
      lapses: next.lapses,
      ease: next.ease,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt,
      lastGrade: next.lastGrade,
      lastReviewedAt: next.lastReviewedAt,
    },
  });

  return c.json({
    data: {
      chordId,
      status: next.status,
      intervalDays: next.intervalDays,
      dueAt: next.dueAt.toISOString(),
    },
  });
});

// GET /settings
chords.get("/settings", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const row = await db.chordSettings.findUnique({ where: { userId: user.id } });
  return c.json({ data: toSettings(row as SettingsRow) });
});

// PUT /settings
chords.put("/settings", requireAuth, async (c) => {
  const user = c.get("user")!;
  const parsed = updateChordSettingsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, 400);
  }
  const db = getDb();
  const patch = parsed.data;
  const row = await db.chordSettings.upsert({
    where: { userId: user.id },
    update: patch,
    create: { userId: user.id, ...DEFAULT_SETTINGS, ...patch },
  });
  return c.json({ data: toSettings(row as SettingsRow) });
});

// ── helpers ──────────────────────────────────────────────
function sortByDue(byId: Map<string, ProgressRow>, a: string, b: string): number {
  const da = byId.get(a)?.dueAt?.getTime() ?? 0;
  const db = byId.get(b)?.dueAt?.getTime() ?? 0;
  return da - db;
}

function lockedLevelIds(
  byId: Map<string, ProgressRow>,
  levelGating: boolean,
  now: Date,
): Set<number> {
  return new Set(
    summarizeLevels(byId, levelGating, now)
      .filter((l) => l.locked)
      .map((l) => l.id),
  );
}

function makeCard(
  pick: { chordId: string; levelId: number },
  byId: Map<string, ProgressRow>,
  notation: "sharp" | "flat",
) {
  const found = getCatalogChord(pick.chordId);
  if (!found) return null;
  return toCard(found.chord, found.levelId, statusOf(byId.get(pick.chordId)), notation);
}

export { chords as chordRoutes };
