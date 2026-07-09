// Spaced-repetition scheduler for the Chord Flash Cards trainer.
//
// A compact SM-2 variant working in whole days. A card with no ChordProgress
// row is "new"; once graded it becomes "learning" and, once its interval
// grows past a week, "known". Grading "again" (Missed) resurfaces the card
// immediately (dueAt = now) so weak cards come back within the session.

import type { ChordCardStatus, ChordGrade } from "@sunbird/shared";

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const KNOWN_INTERVAL = 7; // days — an interval this long means "mastered"
const MAX_INTERVAL = 365;
const DAY_MS = 86_400_000;

export interface SrsState {
  status: Exclude<ChordCardStatus, "new">;
  reps: number;
  lapses: number;
  ease: number;
  intervalDays: number;
  dueAt: Date;
  lastGrade: ChordGrade;
  lastReviewedAt: Date;
}

export interface PrevState {
  reps: number;
  lapses: number;
  ease: number;
  intervalDays: number;
}

const clampEase = (e: number) => Math.max(MIN_EASE, Math.min(MAX_EASE, e));
const round = (n: number) => Math.round(n);

export function schedule(prev: PrevState | null, grade: ChordGrade, now: Date): SrsState {
  const reps = prev?.reps ?? 0;
  const lapses = prev?.lapses ?? 0;
  const ease = prev?.ease ?? 2.5;
  const interval = prev?.intervalDays ?? 0;
  const firstPass = reps === 0;

  let nextReps = reps;
  let nextLapses = lapses;
  let nextEase = ease;
  let nextInterval = interval;

  switch (grade) {
    case "again":
      nextReps = 0;
      nextLapses = lapses + 1;
      nextEase = clampEase(ease - 0.2);
      nextInterval = 0; // due again right away
      break;
    case "hard":
      nextReps = reps + 1;
      nextEase = clampEase(ease - 0.15);
      nextInterval = interval < 1 ? 1 : round(interval * 1.2);
      break;
    case "good":
      nextReps = reps + 1;
      nextInterval = firstPass ? 1 : interval < 1 ? 2 : round(interval * ease);
      break;
    case "easy":
      nextReps = reps + 1;
      nextEase = clampEase(ease + 0.15);
      nextInterval = firstPass ? 4 : round(Math.max(interval, 1) * ease * 1.3);
      break;
  }

  nextInterval = Math.min(MAX_INTERVAL, nextInterval);
  const status: SrsState["status"] = nextInterval >= KNOWN_INTERVAL ? "known" : "learning";
  const dueAt = new Date(now.getTime() + nextInterval * DAY_MS);

  return {
    status,
    reps: nextReps,
    lapses: nextLapses,
    ease: nextEase,
    intervalDays: nextInterval,
    dueAt,
    lastGrade: grade,
    lastReviewedAt: now,
  };
}

// ── status + mastery projections (used by the read endpoints) ──

export interface ProgressRow {
  chordId: string;
  status: string;
  intervalDays: number;
  dueAt: Date | null;
}

export function statusOf(row: ProgressRow | undefined): ChordCardStatus {
  if (!row) return "new";
  return row.status === "known" ? "known" : "learning";
}

// A row is due when its scheduled time has arrived. New (un-seen) chords are
// not "due" — they're introduced separately, capped by newPerDay.
export function isDue(row: ProgressRow, now: Date): boolean {
  return row.dueAt !== null && row.dueAt.getTime() <= now.getTime();
}

// Mastery of a set of chord ids: known = full credit, learning = partial,
// new = none. Returns 0-100.
export function masteryPct(chordIds: string[], byId: Map<string, ProgressRow>): number {
  if (chordIds.length === 0) return 0;
  let score = 0;
  for (const id of chordIds) {
    const st = statusOf(byId.get(id));
    score += st === "known" ? 1 : st === "learning" ? 0.4 : 0;
  }
  return Math.round((score / chordIds.length) * 100);
}
