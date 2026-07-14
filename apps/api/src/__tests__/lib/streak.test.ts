import { describe, it, expect } from "vitest";
import { practicedDays, computeStreak } from "../../lib/streak";

const day = (s: string) => new Date(s + "T00:00:00.000Z");

describe("practicedDays", () => {
  it("counts any day with at least one completion (coach OR self-added)", () => {
    const completions = [
      { day: day("2026-07-01"), routineItemId: "coach-a" },
      { day: day("2026-07-01"), routineItemId: "coach-b" }, // same day, still one
      { day: day("2026-07-02"), routineItemId: "sing-box-breathing" }, // self-practice
    ];
    expect(practicedDays(completions)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("lets self-practice alone keep the streak alive (no coach routine)", () => {
    const completions = [
      { day: day("2026-07-01"), routineItemId: "chord-flashcards" },
      { day: day("2026-07-02"), routineItemId: "custom-abc" },
    ];
    expect(practicedDays(completions)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("returns nothing when the student never practiced", () => {
    expect(practicedDays([])).toEqual([]);
  });
});

describe("computeStreak", () => {
  it("counts a run of consecutive days and the longest run", () => {
    const s = computeStreak(["2026-07-01", "2026-07-02", "2026-07-04"]);
    expect(s.longestDays).toBe(2);
    expect(s.lastDay).toBe("2026-07-04");
  });
});
