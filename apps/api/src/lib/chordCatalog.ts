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
  recommendedForTier?: boolean;
}
interface LibChord {
  id: string;
  canonicalName: string;
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
interface Library {
  tiers: LibTier[];
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
