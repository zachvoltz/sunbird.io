// Derive a practice streak from the set of days a student completed at least
// one exercise. RoutineCompletion is the source of truth, so the streak
// self-corrects when completions are added or removed — no stale counter.

const DAY_MS = 86_400_000;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Days (UTC `YYYY-MM-DD`) on which the student completed EVERY exercise in
 * their current routine — the only days that count toward the streak.
 *
 * @param completions  raw RoutineCompletion rows (day + routineItemId)
 * @param routineItemIds the ids of the student's current routine items
 */
export function fullyCompleteDays(
  completions: Array<{ day: Date; routineItemId: string }>,
  routineItemIds: string[],
): string[] {
  if (routineItemIds.length === 0) return [];
  const required = new Set(routineItemIds);
  const byDay = new Map<string, Set<string>>();
  for (const c of completions) {
    const key = c.day.toISOString().slice(0, 10);
    let set = byDay.get(key);
    if (!set) byDay.set(key, (set = new Set()));
    set.add(c.routineItemId);
  }
  const out: string[] = [];
  for (const [key, done] of byDay) {
    let all = true;
    for (const id of required) {
      if (!done.has(id)) {
        all = false;
        break;
      }
    }
    if (all) out.push(key);
  }
  return out.sort();
}

/**
 * Streak-eligible days for a student, accounting for an optional student-added
 * "chord flashcards" routine item. Coach items gate the streak as usual; if the
 * student has NO coach routine, the chord item gates it instead (so self-practice
 * can build a streak). When both exist, the chord item is required only from the
 * day it was added (`chord.sinceKey`), so enabling it never breaks past days.
 */
export function streakDays(
  completions: Array<{ day: Date; routineItemId: string }>,
  coachItemIds: string[],
  chord: { enabled: boolean; itemId: string; sinceKey: string | null },
): string[] {
  const base = coachItemIds.length > 0 ? coachItemIds : chord.enabled ? [chord.itemId] : [];
  let days = fullyCompleteDays(completions, base);
  if (chord.enabled && coachItemIds.length > 0) {
    const chordDays = new Set(
      completions
        .filter((c) => c.routineItemId === chord.itemId)
        .map((c) => c.day.toISOString().slice(0, 10)),
    );
    days = days.filter((d) => !chord.sinceKey || d < chord.sinceKey || chordDays.has(d));
  }
  return days;
}

/**
 * @param dayKeys distinct UTC `YYYY-MM-DD` strings (any order)
 */
export function computeStreak(dayKeys: string[]): {
  currentDays: number;
  longestDays: number;
  lastDay: string | null;
} {
  const set = new Set(dayKeys);
  if (set.size === 0) return { currentDays: 0, longestDays: 0, lastDay: null };

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Current run: anchored to today if practiced today, otherwise yesterday
  // (today is still pending, streak not yet broken). Older → broken (0).
  let anchor: number | null = null;
  if (set.has(dayKey(todayMs))) anchor = todayMs;
  else if (set.has(dayKey(todayMs - DAY_MS))) anchor = todayMs - DAY_MS;

  let currentDays = 0;
  if (anchor !== null) {
    for (let d = anchor; set.has(dayKey(d)); d -= DAY_MS) currentDays++;
  }

  // Longest run anywhere in history.
  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1] + "T00:00:00Z");
    const cur = Date.parse(sorted[i] + "T00:00:00Z");
    run = cur - prev === DAY_MS ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return {
    currentDays,
    longestDays: Math.max(longest, currentDays),
    lastDay: sorted[sorted.length - 1] ?? null,
  };
}
