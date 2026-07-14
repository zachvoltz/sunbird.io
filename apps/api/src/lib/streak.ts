// Derive a practice streak from the set of days a student practiced.
// RoutineCompletion is the source of truth, so the streak self-corrects when
// completions are added or removed — no stale counter.

const DAY_MS = 86_400_000;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Days (UTC `YYYY-MM-DD`) on which the student practiced — i.e. completed at
 * least one routine item, whether coach-assigned or self-added. Any practice
 * keeps the streak alive, so a student's own exercises count just like assigned
 * work, and a student with no coach routine still builds a streak. This is
 * non-retroactive by construction: adding a new exercise never un-counts a
 * past day.
 *
 * @param completions  raw RoutineCompletion rows (day + routineItemId)
 */
export function practicedDays(
  completions: Array<{ day: Date; routineItemId: string }>,
): string[] {
  const days = new Set<string>();
  for (const c of completions) days.add(c.day.toISOString().slice(0, 10));
  return [...days].sort();
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
