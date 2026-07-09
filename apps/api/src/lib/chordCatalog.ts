// Static chord/level catalog for the Chord Flash Cards trainer.
//
// This is reference data, not user data — it lives on the server and is served
// through the /api/me/chords endpoints. Only a student's per-chord review
// schedule is persisted (see the ChordProgress model). Chord *tones* (note
// name + scale degree, shown by the front note-detector) are derived from the
// root + quality so they stay consistent and honour the notation preference;
// voicing diagrams are hand-authored fretboard shapes.

import type {
  ChordCardPublic,
  ChordCardStatus,
  ChordShape,
  ChordTone,
  ChordVoicingPublic,
} from "@sunbird/shared";

// ── note spelling ────────────────────────────────────────
const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteName(pitchClass: number, notation: "sharp" | "flat"): string {
  const i = ((pitchClass % 12) + 12) % 12;
  return (notation === "flat" ? FLAT : SHARP)[i];
}

// ── chord qualities ──────────────────────────────────────
// Each quality is an ordered list of [semitones-above-root, degree-label].
// The order is the order tones appear in the front detector (root → top).
type Quality =
  | "maj"
  | "min"
  | "maj7"
  | "dom7"
  | "min7"
  | "sus2"
  | "sus4"
  | "power"
  | "add9"
  | "dom9"
  | "maj9"
  | "min9";

const QUALITY: Record<Quality, { suffix: string; tones: [number, string][] }> = {
  maj: { suffix: "", tones: [[0, "1 · root"], [4, "3rd"], [7, "5th"]] },
  min: { suffix: "m", tones: [[0, "1 · root"], [3, "♭3rd"], [7, "5th"]] },
  maj7: { suffix: "maj7", tones: [[0, "1 · root"], [4, "3rd"], [7, "5th"], [11, "7th"]] },
  dom7: { suffix: "7", tones: [[0, "1 · root"], [4, "3rd"], [7, "5th"], [10, "♭7th"]] },
  min7: { suffix: "m7", tones: [[0, "1 · root"], [3, "♭3rd"], [7, "5th"], [10, "♭7th"]] },
  sus2: { suffix: "sus2", tones: [[0, "1 · root"], [2, "2nd"], [7, "5th"]] },
  sus4: { suffix: "sus4", tones: [[0, "1 · root"], [5, "4th"], [7, "5th"]] },
  power: { suffix: "5", tones: [[0, "1 · root"], [7, "5th"]] },
  add9: { suffix: "add9", tones: [[0, "1 · root"], [4, "3rd"], [7, "5th"], [2, "9th"]] },
  dom9: { suffix: "9", tones: [[0, "1 · root"], [4, "3rd"], [7, "5th"], [10, "♭7th"], [2, "9th"]] },
  maj9: { suffix: "maj9", tones: [[0, "1 · root"], [4, "3rd"], [7, "5th"], [11, "7th"], [2, "9th"]] },
  min9: { suffix: "m9", tones: [[0, "1 · root"], [3, "♭3rd"], [7, "5th"], [10, "♭7th"], [2, "9th"]] },
};

// ── catalog shape ────────────────────────────────────────
interface Voicing {
  label: string;
  shape: ChordShape;
  recommended?: boolean;
}
interface CatalogChord {
  id: string;
  name: string; // conventional display name (e.g. "Bb", "F#m")
  root: number; // pitch class 0-11 for tone spelling
  quality: Quality;
  voicings: Voicing[]; // first entry is the recommended one
}
export interface CatalogLevel {
  id: number;
  name: string;
  desc: string;
  chords: CatalogChord[];
}

// Terse constructors to keep the data table readable.
const s = (
  fingering: (number | "x")[],
  fingers?: (string | null)[],
  extra?: { baseFret?: number; barre?: ChordShape["barre"] },
): ChordShape => ({ fingering, ...(fingers ? { fingers } : {}), ...extra });

export const CATALOG: CatalogLevel[] = [
  {
    id: 1,
    name: "Open Chords",
    desc: "Cowboy chords: E A D G C, Em Am Dm",
    chords: [
      { id: "e", name: "E", root: 4, quality: "maj", voicings: [{ label: "Open", recommended: true, shape: s([0, 2, 2, 1, 0, 0], [null, "2", "3", "1", null, null]) }] },
      { id: "a", name: "A", root: 9, quality: "maj", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 2, 2, 0], [null, null, "1", "2", "3", null]) }] },
      { id: "d", name: "D", root: 2, quality: "maj", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 0, 2, 3, 2], [null, null, null, "1", "3", "2"]) }] },
      { id: "g", name: "G", root: 7, quality: "maj", voicings: [{ label: "Open", recommended: true, shape: s([3, 2, 0, 0, 0, 3], ["2", "1", null, null, null, "3"]) }] },
      { id: "c", name: "C", root: 0, quality: "maj", voicings: [{ label: "Open", recommended: true, shape: s(["x", 3, 2, 0, 1, 0], [null, "3", "2", null, "1", null]) }] },
      { id: "em", name: "Em", root: 4, quality: "min", voicings: [{ label: "Open", recommended: true, shape: s([0, 2, 2, 0, 0, 0], [null, "2", "3", null, null, null]) }] },
      { id: "am", name: "Am", root: 9, quality: "min", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 2, 1, 0], [null, null, "2", "3", "1", null]) }] },
      { id: "dm", name: "Dm", root: 2, quality: "min", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 0, 2, 3, 1], [null, null, null, "2", "3", "1"]) }] },
    ],
  },
  {
    id: 2,
    name: "Barre Chords",
    desc: "E-shape & A-shape movable shapes",
    chords: [
      { id: "f", name: "F", root: 5, quality: "maj", voicings: [{ label: "E-shape barre · 1st fr", recommended: true, shape: s([1, 3, 3, 2, 1, 1], [null, "3", "4", "2", null, null], { baseFret: 1, barre: { fret: 1, from: 0, to: 5 } }) }] },
      { id: "bb", name: "Bb", root: 10, quality: "maj", voicings: [{ label: "A-shape barre · 1st fr", recommended: true, shape: s(["x", 1, 3, 3, 3, 1], [null, "1", "2", "3", "4", null], { baseFret: 1, barre: { fret: 1, from: 1, to: 5 } }) }] },
      { id: "b", name: "B", root: 11, quality: "maj", voicings: [{ label: "A-shape barre · 2nd fr", recommended: true, shape: s(["x", 2, 4, 4, 4, 2], [null, "1", "2", "3", "4", null], { baseFret: 2, barre: { fret: 2, from: 1, to: 5 } }) }] },
      { id: "bm", name: "Bm", root: 11, quality: "min", voicings: [{ label: "A-shape barre · 2nd fr", recommended: true, shape: s(["x", 2, 4, 4, 3, 2], [null, "1", "3", "4", "2", null], { baseFret: 2, barre: { fret: 2, from: 1, to: 5 } }) }] },
      { id: "fsharpm", name: "F#m", root: 6, quality: "min", voicings: [{ label: "E-shape barre · 2nd fr", recommended: true, shape: s([2, 4, 4, 2, 2, 2], [null, "3", "4", null, null, null], { baseFret: 2, barre: { fret: 2, from: 0, to: 5 } }) }] },
      { id: "cm", name: "Cm", root: 0, quality: "min", voicings: [{ label: "A-shape barre · 3rd fr", recommended: true, shape: s(["x", 3, 5, 5, 4, 3], [null, "1", "3", "4", "2", null], { baseFret: 3, barre: { fret: 3, from: 1, to: 5 } }) }] },
    ],
  },
  {
    id: 3,
    name: "Power & Sus",
    desc: "5ths, sus2, sus4, add9",
    chords: [
      { id: "e5", name: "E5", root: 4, quality: "power", voicings: [{ label: "Power chord", recommended: true, shape: s([0, 2, 2, "x", "x", "x"], [null, "1", "2", null, null, null]) }] },
      { id: "a5", name: "A5", root: 9, quality: "power", voicings: [{ label: "Power chord", recommended: true, shape: s(["x", 0, 2, 2, "x", "x"], [null, null, "1", "2", null, null]) }] },
      { id: "dsus2", name: "Dsus2", root: 2, quality: "sus2", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 0, 2, 3, 0], [null, null, null, "1", "3", null]) }] },
      { id: "dsus4", name: "Dsus4", root: 2, quality: "sus4", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 0, 2, 3, 3], [null, null, null, "1", "2", "3"]) }] },
      { id: "asus2", name: "Asus2", root: 9, quality: "sus2", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 2, 0, 0], [null, null, "1", "2", null, null]) }] },
      { id: "asus4", name: "Asus4", root: 9, quality: "sus4", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 2, 3, 0], [null, null, "1", "2", "3", null]) }] },
      { id: "cadd9", name: "Cadd9", root: 0, quality: "add9", voicings: [{ label: "Open", recommended: true, shape: s(["x", 3, 2, 0, 3, 0], [null, "2", "1", null, "3", null]) }] },
    ],
  },
  {
    id: 4,
    name: "Seventh Chords",
    desc: "Dominant 7, maj7, min7",
    chords: [
      {
        id: "cmaj7",
        name: "Cmaj7",
        root: 0,
        quality: "maj7",
        voicings: [
          { label: "Open", recommended: true, shape: s(["x", 3, 2, 0, 0, 0], [null, "3", "2", null, null, null]) },
          { label: "A-shape barre · 3rd fr", shape: s(["x", 3, 5, 4, 5, 3], [null, "1", "3", "2", "4", null], { baseFret: 3, barre: { fret: 3, from: 1, to: 5 } }) },
          { label: "Drop-2 · mid strings", shape: s(["x", "x", 5, 5, 5, 7], [null, null, "1", "1", "1", "4"], { baseFret: 5 }) },
        ],
      },
      { id: "g7", name: "G7", root: 7, quality: "dom7", voicings: [{ label: "Open", recommended: true, shape: s([3, 2, 0, 0, 0, 1], ["3", "2", null, null, null, "1"]) }] },
      { id: "c7", name: "C7", root: 0, quality: "dom7", voicings: [{ label: "Open", recommended: true, shape: s(["x", 3, 2, 3, 1, 0], [null, "3", "2", "4", "1", null]) }] },
      { id: "d7", name: "D7", root: 2, quality: "dom7", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 0, 2, 1, 2], [null, null, null, "2", "1", "3"]) }] },
      { id: "e7", name: "E7", root: 4, quality: "dom7", voicings: [{ label: "Open", recommended: true, shape: s([0, 2, 0, 1, 0, 0], [null, "2", null, "1", null, null]) }] },
      { id: "a7", name: "A7", root: 9, quality: "dom7", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 0, 2, 0], [null, null, "2", null, "3", null]) }] },
      { id: "fmaj7", name: "Fmaj7", root: 5, quality: "maj7", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 3, 2, 1, 0], [null, null, "3", "2", "1", null]) }] },
      { id: "am7", name: "Am7", root: 9, quality: "min7", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 0, 1, 0], [null, null, "2", null, "1", null]) }] },
      { id: "em7", name: "Em7", root: 4, quality: "min7", voicings: [{ label: "Open", recommended: true, shape: s([0, 2, 0, 0, 0, 0], [null, "2", null, null, null, null]) }] },
      { id: "dm7", name: "Dm7", root: 2, quality: "min7", voicings: [{ label: "Open", recommended: true, shape: s(["x", "x", 0, 2, 1, 1], [null, null, null, "2", "1", "1"], { barre: { fret: 1, from: 4, to: 5 } }) }] },
    ],
  },
  {
    id: 5,
    name: "Extended",
    desc: "9ths, 11ths, 13ths",
    chords: [
      { id: "c9", name: "C9", root: 0, quality: "dom9", voicings: [{ label: "Barre · 3rd fr", recommended: true, shape: s(["x", 3, 2, 3, 3, 3], [null, "2", "1", "3", "3", "3"], { barre: { fret: 3, from: 3, to: 5 } }) }] },
      { id: "g9", name: "G9", root: 7, quality: "dom9", voicings: [{ label: "Open", recommended: true, shape: s([3, "x", 0, 2, 0, 1], ["3", null, null, "2", null, "1"]) }] },
      { id: "cmaj9", name: "Cmaj9", root: 0, quality: "maj9", voicings: [{ label: "Open", recommended: true, shape: s(["x", 3, 2, 4, 3, 0], [null, "2", "1", "4", "3", null]) }] },
      { id: "am9", name: "Am9", root: 9, quality: "min9", voicings: [{ label: "Open", recommended: true, shape: s(["x", 0, 2, 4, 1, 3], [null, null, "2", "4", "1", "3"]) }] },
      { id: "dm9", name: "Dm9", root: 2, quality: "min9", voicings: [{ label: "Barre · 3rd fr", recommended: true, shape: s(["x", 5, 3, 5, 5, "x"], [null, "3", "1", "3", "4", null], { baseFret: 3 }) }] },
    ],
  },
  {
    id: 6,
    name: "Jazz Voicings",
    desc: "Drop-2, drop-3, shell voicings",
    chords: [
      { id: "cmaj7-drop2", name: "Cmaj7", root: 0, quality: "maj7", voicings: [{ label: "Drop-2 · 5th fr", recommended: true, shape: s(["x", "x", 5, 7, 5, 6], [null, null, "1", "3", "1", "2"], { baseFret: 5 }) }] },
      { id: "dm7-shell", name: "Dm7", root: 2, quality: "min7", voicings: [{ label: "Shell · 5th fr", recommended: true, shape: s(["x", 5, "x", 5, 6, "x"], [null, "1", null, "2", "3", null], { baseFret: 5 }) }] },
      { id: "g7-drop2", name: "G7", root: 7, quality: "dom7", voicings: [{ label: "Drop-2 · 3rd fr", recommended: true, shape: s(["x", "x", 3, 4, 3, 5], [null, null, "1", "2", "1", "4"], { baseFret: 3 }) }] },
      { id: "am7-drop3", name: "Am7", root: 9, quality: "min7", voicings: [{ label: "Drop-3 · 5th fr", recommended: true, shape: s([5, "x", 5, 5, 5, "x"], ["1", null, "1", "1", "1", null], { baseFret: 5 }) }] },
      { id: "fmaj7-drop2", name: "Fmaj7", root: 5, quality: "maj7", voicings: [{ label: "Drop-2 · 5th fr", recommended: true, shape: s(["x", "x", 3, 5, 5, 5], [null, null, "1", "3", "3", "3"], { baseFret: 3 }) }] },
    ],
  },
];

// ── lookups ──────────────────────────────────────────────
const BY_ID = new Map<string, { chord: CatalogChord; levelId: number }>();
for (const level of CATALOG) {
  for (const chord of level.chords) BY_ID.set(chord.id, { chord, levelId: level.id });
}

export function getCatalogChord(id: string): { chord: CatalogChord; levelId: number } | undefined {
  return BY_ID.get(id);
}
export function levelById(id: number): CatalogLevel | undefined {
  return CATALOG.find((l) => l.id === id);
}
export function allChordIds(): string[] {
  return [...BY_ID.keys()];
}

// ── public projections ───────────────────────────────────
function toTones(chord: CatalogChord, notation: "sharp" | "flat"): ChordTone[] {
  return QUALITY[chord.quality].tones.map(([semi, degree]) => ({
    note: noteName(chord.root + semi, notation),
    degree,
  }));
}

function toVoicings(chord: CatalogChord): ChordVoicingPublic[] {
  return chord.voicings.map((v, i) => ({
    id: `${chord.id}-${i}`,
    label: v.label,
    shape: v.shape,
    recommended: v.recommended === true,
  }));
}

export function toCard(
  chord: CatalogChord,
  levelId: number,
  status: ChordCardStatus,
  notation: "sharp" | "flat",
): ChordCardPublic {
  return {
    id: chord.id,
    name: chord.name,
    levelId,
    tones: toTones(chord, notation),
    voicings: toVoicings(chord),
    status,
  };
}
