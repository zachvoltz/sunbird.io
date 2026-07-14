import { describe, it, expect } from "vitest";
import { fullyCompleteDays, computeStreak } from "../../lib/streak";

const day = (s: string) => new Date(s + "T00:00:00.000Z");

describe("fullyCompleteDays", () => {
  it("counts only days where EVERY routine item was completed", () => {
    const completions = [
      { day: day("2026-07-01"), routineItemId: "a" },
      { day: day("2026-07-01"), routineItemId: "b" },
      { day: day("2026-07-02"), routineItemId: "a" }, // b missing
    ];
    expect(fullyCompleteDays(completions, ["a", "b"])).toEqual(["2026-07-01"]);
  });

  it("returns no days when the routine is empty (student items are bonus)", () => {
    const completions = [{ day: day("2026-07-01"), routineItemId: "sing-box-breathing" }];
    expect(fullyCompleteDays(completions, [])).toEqual([]);
  });
});

describe("computeStreak", () => {
  it("counts a run of consecutive days and the longest run", () => {
    const s = computeStreak(["2026-07-01", "2026-07-02", "2026-07-04"]);
    expect(s.longestDays).toBe(2);
    expect(s.lastDay).toBe("2026-07-04");
  });
});
