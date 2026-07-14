// Built-in guided singing/vocal-warmup exercises. A student or coach can add
// any of these to a daily routine; each one launches a guided player. Like the
// chord catalog this is static reference data — a singing routine item is
// identified purely by its id ("sing-<type>"), since serializeRoutine only
// keeps the standard RoutineItem fields.

export type SingingExerciseType =
  | "box-breathing"
  | "sustained-hiss"
  | "quick-catch"
  | "five-tone-scale"
  | "octave-sirens"
  | "cooldown-hum";

export type SingingKind = "breath" | "scale";

export interface SingingExercise {
  type: SingingExerciseType;
  name: string;
  meta: string; // short subtitle, e.g. "4·4·4·4 · 2 min"
  kind: SingingKind;
  durationMin: number;
  // ── type-specific params ──
  box?: { inhale: number; hold: number; exhale: number; cycles: number };
  hiss?: { goalSec: number };
  quickCatch?: { reps: number; bpm: number };
  // scale / siren / hum drills all sing an ordered set of target notes
  scale?: { refNote: string; solfege: string[]; notes: string[]; tempo: number };
  siren?: { low: string; high: string };
  hum?: { notes: string[] };
}

export const SINGING_EXERCISES: SingingExercise[] = [
  {
    type: "box-breathing",
    name: "Box breathing",
    meta: "4·4·4·4 · 2 min",
    kind: "breath",
    durationMin: 2,
    box: { inhale: 4, hold: 4, exhale: 4, cycles: 4 },
  },
  {
    type: "sustained-hiss",
    name: "Sustained hiss “sss”",
    meta: "goal 20s · 2 min",
    kind: "breath",
    durationMin: 2,
    hiss: { goalSec: 20 },
  },
  {
    type: "quick-catch",
    name: "Quick-catch breaths",
    meta: "staggered · 1 min",
    kind: "breath",
    durationMin: 1,
    quickCatch: { reps: 8, bpm: 84 },
  },
  {
    type: "five-tone-scale",
    name: "5-tone scale · “ee”",
    meta: "C→G · pitch · 3 min",
    kind: "scale",
    durationMin: 3,
    scale: {
      refNote: "C4",
      solfege: ["do", "re", "mi", "fa", "sol"],
      notes: ["C4", "D4", "E4", "F4", "G4"],
      tempo: 76,
    },
  },
  {
    type: "octave-sirens",
    name: "Octave sirens",
    meta: "D4 ↔ A5 · 3 min",
    kind: "scale",
    durationMin: 3,
    siren: { low: "D4", high: "A5" },
  },
  {
    type: "cooldown-hum",
    name: "Cool-down hum",
    meta: "gentle · 1 min",
    kind: "scale",
    durationMin: 1,
    hum: { notes: ["G4", "F4", "E4", "D4", "C4"] },
  },
];

// ── routine-item id helpers ──────────────────────────────
export const SINGING_ID_PREFIX = "sing-";

export function singingRoutineId(type: SingingExerciseType): string {
  return SINGING_ID_PREFIX + type;
}
export function singingTypeFromId(id: string): SingingExerciseType | null {
  if (!id.startsWith(SINGING_ID_PREFIX)) return null;
  const t = id.slice(SINGING_ID_PREFIX.length) as SingingExerciseType;
  return SINGING_EXERCISES.some((e) => e.type === t) ? t : null;
}
export function singingExercise(type: SingingExerciseType): SingingExercise | undefined {
  return SINGING_EXERCISES.find((e) => e.type === type);
}
// A breath drill is a warmup; a pitch/scale drill is an exercise.
export function singingRoutineKind(e: SingingExercise): "warmup" | "exercise" {
  return e.kind === "breath" ? "warmup" : "exercise";
}

// ── note ↔ frequency helpers (for the live pitch drills) ──
const A4 = 440;
const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteToMidi(name: string): number | null {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  const semi = LETTER_SEMITONE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const octave = Number(m[3]);
  return (octave + 1) * 12 + semi;
}
export function noteToFreq(name: string): number | null {
  const midi = noteToMidi(name);
  return midi == null ? null : A4 * Math.pow(2, (midi - 69) / 12);
}
export function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return SHARP_NAMES[((midi % 12) + 12) % 12] + octave;
}
// Nearest tempered note to a frequency, plus its cents deviation (−50..+50).
export function nearestNote(hz: number): { name: string; cents: number; midi: number } {
  const midiFloat = 69 + 12 * Math.log2(hz / A4);
  const midi = Math.round(midiFloat);
  return { name: midiToName(midi), midi, cents: Math.round((midiFloat - midi) * 100) };
}
// Cents deviation of `hz` from a specific target frequency.
export function centsOff(hz: number, targetHz: number): number {
  return Math.round(1200 * Math.log2(hz / targetHz));
}
