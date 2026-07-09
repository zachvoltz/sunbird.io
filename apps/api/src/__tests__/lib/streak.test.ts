import { describe, it, expect } from "vitest";
import { streakDays } from "../../lib/streak";

const day = (s: string) => new Date(s + "T00:00:00.000Z");
const CHORD = "chord-flashcards";

describe("streakDays — chord flashcards routine gating", () => {
  it("uses coach items alone when chords are disabled", () => {
    const completions = [{ day: day("2026-07-01"), routineItemId: "a" }];
    const days = streakDays(completions, ["a"], { enabled: false, itemId: CHORD, sinceKey: null });
    expect(days).toEqual(["2026-07-01"]);
  });

  it("lets chords gate the streak when there is no coach routine", () => {
    const completions = [{ day: day("2026-07-01"), routineItemId: CHORD }];
    const days = streakDays(completions, [], { enabled: true, itemId: CHORD, sinceKey: "2026-07-01" });
    expect(days).toEqual(["2026-07-01"]);
  });

  it("does NOT retroactively break days before chords were added", () => {
    // Coach item 'a' done both days; chords added 07-02 and done only 07-02.
    const completions = [
      { day: day("2026-07-01"), routineItemId: "a" },
      { day: day("2026-07-02"), routineItemId: "a" },
      { day: day("2026-07-02"), routineItemId: CHORD },
    ];
    const days = streakDays(completions, ["a"], { enabled: true, itemId: CHORD, sinceKey: "2026-07-02" });
    expect(days.sort()).toEqual(["2026-07-01", "2026-07-02"]); // both still count
  });

  it("requires chords from the day they were added onward", () => {
    // Coach item done both days; chords added 07-01 but skipped on 07-02.
    const completions = [
      { day: day("2026-07-01"), routineItemId: "a" },
      { day: day("2026-07-01"), routineItemId: CHORD },
      { day: day("2026-07-02"), routineItemId: "a" },
    ];
    const days = streakDays(completions, ["a"], { enabled: true, itemId: CHORD, sinceKey: "2026-07-01" });
    expect(days).toEqual(["2026-07-01"]); // 07-02 excluded (chord missing)
  });
});
