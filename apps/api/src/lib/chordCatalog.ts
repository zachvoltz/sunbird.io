// Chord/level catalog for the Chord Flash Cards trainer, backed by the
// generated chord library (see scripts/build-chord-library.mjs, which ingests
// tombatossals/chords-db against chord-library.schema.json). This is static
// reference data served through the /api/me/chords endpoints; only a student's
// per-chord review schedule is persisted (the ChordProgress model).
//
// The difficulty *tiers* become the deck-picker "levels"; each chord's
// difficultyTier decides which level it belongs to. Voicings are projected to
// the frontend ChordShape (absolute frets + a single barre) for rendering.

import type {
  ChordCardPublic,
  ChordCardStatus,
  ChordDifficulty,
  ChordLibraryDetailPublic,
  ChordLibraryItemPublic,
  ChordLibraryListPublic,
  ChordLibraryVoicingPublic,
  ChordShape,
  ChordTone,
  ChordVoicingPublic,
} from "@sunbird/shared";
import libraryJson from "./chordLibrary.json";

// ── library shapes (subset of the schema we consume) ──────
interface LibBarre {
  fret: number;
  fromString: number;
  toString: number;
}
interface LibVoicing {
  id: string;
  label?: string;
  frets: number[]; // low E → high E; -1 muted, 0 open, N = Nth fret in window (1 = baseFret)
  fingers: number[];
  baseFret: number;
  barres?: LibBarre[];
  category: string;
  cagedShape?: string | null;
  difficultyTier?: number;
  recommendedForTier?: boolean;
}
interface LibChord {
  id: string;
  canonicalName: string;
  displayAliases?: string[];
  root: string;
  quality: string;
  formula: string[];
  spelling: string[];
  difficultyTier: number;
  voicings: LibVoicing[];
}
interface LibTier {
  order: number;
  name: string;
  description?: string;
}
interface LibQuality {
  id: string;
  symbol: string;
  fullName: string;
  family: string;
}
interface Library {
  tiers: LibTier[];
  qualities: LibQuality[];
  chords: LibChord[];
}

const LIB = libraryJson as unknown as Library;

// ── public catalog surface (same shape the routes/SRS expect) ──
export interface CatalogLevel {
  id: number;
  name: string;
  desc: string;
  chords: { id: string; name: string }[];
}

const BY_ID = new Map<string, { chord: LibChord; levelId: number }>();
for (const c of LIB.chords) BY_ID.set(c.id, { chord: c, levelId: c.difficultyTier });

export const CATALOG: CatalogLevel[] = LIB.tiers.map((t) => ({
  id: t.order,
  name: t.name,
  desc: t.description ?? "",
  chords: LIB.chords
    .filter((c) => c.difficultyTier === t.order)
    .map((c) => ({ id: c.id, name: c.canonicalName })),
}));

export function getCatalogChord(id: string): { chord: LibChord; levelId: number } | undefined {
  return BY_ID.get(id);
}
export function levelById(id: number): CatalogLevel | undefined {
  return CATALOG.find((l) => l.id === id);
}
export function allChordIds(): string[] {
  return [...BY_ID.keys()];
}

// ── projections ──────────────────────────────────────────
// Interval token (e.g. "b7", "#11", "bb7") → the degree label shown by the
// front note-detector.
const DEGREE: Record<string, string> = {
  "1": "1 · root", "2": "2nd", "b2": "♭2nd", "3": "3rd", "b3": "♭3rd",
  "4": "4th", "#4": "♯4th", "5": "5th", "b5": "♭5th", "#5": "♯5th",
  "6": "6th", "b6": "♭6th", "7": "7th", "b7": "♭7th", "bb7": "°7th",
  "9": "9th", "b9": "♭9th", "#9": "♯9th", "11": "11th", "#11": "♯11th",
  "13": "13th", "b13": "♭13th",
};

function toTones(chord: LibChord): ChordTone[] {
  return chord.spelling.map((note, i) => ({
    note,
    degree: DEGREE[chord.formula[i]] ?? chord.formula[i] ?? "",
  }));
}

// Convert a library voicing (window-relative frets, barres[]) to the frontend
// ChordShape (absolute frets, at most one barre — what ChordChart renders).
function toShape(v: LibVoicing): ChordShape {
  const base = v.baseFret;
  const fingering: (number | "x")[] = v.frets.map((f) =>
    f === -1 ? "x" : f === 0 ? 0 : base + f - 1,
  );
  const fingers = v.fingers.map((x) => (x === 0 ? null : String(x)));
  const shape: ChordShape = { fingering, fingers, baseFret: base };
  const barre = v.barres?.[0];
  if (barre) {
    shape.barre = { fret: base + barre.fret - 1, from: barre.fromString, to: barre.toString };
  }
  return shape;
}

function toVoicings(chord: LibChord): ChordVoicingPublic[] {
  return chord.voicings.map((v) => ({
    id: v.id,
    label: v.label ?? "",
    shape: toShape(v),
    recommended: v.recommendedForTier === true,
  }));
}

export function toCard(
  chord: LibChord,
  levelId: number,
  status: ChordCardStatus,
): ChordCardPublic {
  return {
    id: chord.id,
    name: chord.canonicalName,
    levelId,
    tones: toTones(chord),
    voicings: toVoicings(chord),
    status,
  };
}

// ── chord library (browse / search reference) ────────────
const QUALITY_BY_ID = new Map<string, LibQuality>();
for (const q of (LIB.qualities ?? [])) QUALITY_BY_ID.set(q.id, q);

const ROOT_ORDER = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const STRING_NAMES = ["6th", "5th", "4th", "3rd", "2nd", "1st"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
function norm(s: string): string {
  return s.toLowerCase().replace(/♯/g, "#").replace(/♭/g, "b").replace(/\s+/g, "");
}
function qualityLabel(chord: LibChord): string {
  return QUALITY_BY_ID.get(chord.quality)?.fullName ?? chord.quality;
}
function recommendedVoicing(chord: LibChord): LibVoicing {
  return chord.voicings.find((v) => v.recommendedForTier) ?? chord.voicings[0];
}
function difficultyOf(v: LibVoicing, chord: LibChord): ChordDifficulty {
  const tier = v.difficultyTier ?? chord.difficultyTier;
  return tier <= 2 ? "beginner" : tier <= 4 ? "intermediate" : "advanced";
}
function fingersLabel(v: LibVoicing): string {
  const hasBarre = (v.barres?.length ?? 0) > 0;
  const used = [...new Set(v.fingers.filter((f) => f > 0))].sort((a, b) => a - b);
  const parts = used.map((f) => (hasBarre && f === 1 ? "1 barre" : String(f)));
  return parts.length ? parts.join(" · ") : "open strings";
}
function rootStringLabel(v: LibVoicing): string {
  const idx = v.frets.findIndex((f) => f !== -1);
  const name = STRING_NAMES[idx] ?? "6th";
  const shape = v.cagedShape ? ` (${v.cagedShape}-shape)` : "";
  return `${name} string${shape}`;
}
function positionLabel(v: LibVoicing): string {
  const hasBarre = (v.barres?.length ?? 0) > 0;
  const isOpen = v.baseFret === 1 && !hasBarre && v.frets.some((f) => f === 0);
  if (isOpen) return "Open position";
  return `${ordinal(v.baseFret)} fret${hasBarre ? " (barre)" : ""}`;
}

function toLibraryVoicing(v: LibVoicing, chord: LibChord): ChordLibraryVoicingPublic {
  return {
    id: v.id,
    label: v.label ?? "",
    shape: toShape(v),
    recommended: v.recommendedForTier === true,
    position: positionLabel(v),
    fingersLabel: fingersLabel(v),
    rootString: rootStringLabel(v),
    difficulty: difficultyOf(v, chord),
    notes: chord.spelling,
  };
}

function toLibraryItem(chord: LibChord): ChordLibraryItemPublic {
  return {
    id: chord.id,
    name: chord.canonicalName,
    qualityLabel: qualityLabel(chord),
    shapeCount: chord.voicings.length,
    root: chord.root,
    shape: toShape(recommendedVoicing(chord)),
  };
}

// The chord-type quick filters (matches the wireframe's chip row).
const TYPE_MATCH: Record<string, (chord: LibChord) => boolean> = {
  maj: (c) => c.quality === "major",
  min: (c) => c.quality === "minor",
  "7": (c) => c.quality === "7",
  maj7: (c) => c.quality === "maj7",
  m7: (c) => c.quality === "m7",
  sus: (c) => QUALITY_BY_ID.get(c.quality)?.family === "suspended",
  dim: (c) => ["dim", "dim7", "m7b5"].includes(c.quality),
};

export function libraryList(opts: { q?: string; root?: string; type?: string }): ChordLibraryListPublic {
  const nq = opts.q ? norm(opts.q) : "";
  const typeFn = opts.type && opts.type !== "All" ? TYPE_MATCH[opts.type] : undefined;
  const wantRoot = opts.root && opts.root !== "All" ? opts.root : undefined;

  const matched = LIB.chords.filter((c) => {
    if (wantRoot && c.root !== wantRoot) return false;
    if (typeFn && !typeFn(c)) return false;
    if (nq) {
      const hay = [c.canonicalName, ...(c.displayAliases ?? [])].map(norm);
      if (!hay.some((h) => h.includes(nq))) return false;
    }
    return true;
  });

  const byRoot = new Map<string, ChordLibraryItemPublic[]>();
  for (const c of matched) {
    if (!byRoot.has(c.root)) byRoot.set(c.root, []);
    byRoot.get(c.root)!.push(toLibraryItem(c));
  }
  const groups = [...byRoot.entries()]
    .sort((a, b) => ROOT_ORDER.indexOf(a[0]) - ROOT_ORDER.indexOf(b[0]))
    .map(([root, items]) => ({
      root,
      items: items.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)),
    }));
  return { groups, total: matched.length };
}

export function libraryDetail(chordId: string): ChordLibraryDetailPublic | undefined {
  const found = BY_ID.get(chordId);
  if (!found) return undefined;
  const chord = found.chord;
  return {
    id: chord.id,
    name: chord.canonicalName,
    fullName: `${chord.root} ${qualityLabel(chord).toLowerCase()}`,
    notes: chord.spelling,
    voicings: chord.voicings.map((v) => toLibraryVoicing(v, chord)),
  };
}
