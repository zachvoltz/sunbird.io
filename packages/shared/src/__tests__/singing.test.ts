import { describe, it, expect } from "vitest";
import {
  SINGING_EXERCISES,
  centsOff,
  nearestNote,
  noteToFreq,
  singingExercise,
  singingRoutineId,
  singingRoutineKind,
  singingTypeFromId,
} from "../singing";

describe("singing catalog + helpers", () => {
  it("has exercises, all with a valid kind and duration", () => {
    expect(SINGING_EXERCISES.length).toBeGreaterThanOrEqual(6);
    for (const ex of SINGING_EXERCISES) {
      expect(["breath", "scale"]).toContain(ex.kind);
      expect(ex.durationMin).toBeGreaterThan(0);
    }
  });

  it("round-trips routine ids", () => {
    expect(singingRoutineId("box-breathing")).toBe("sing-box-breathing");
    expect(singingTypeFromId("sing-box-breathing")).toBe("box-breathing");
    expect(singingTypeFromId("sing-not-real")).toBeNull();
    expect(singingTypeFromId("custom-abc")).toBeNull();
  });

  it("maps kind to a RoutineItem kind", () => {
    expect(singingRoutineKind(singingExercise("box-breathing")!)).toBe("warmup");
    expect(singingRoutineKind(singingExercise("five-tone-scale")!)).toBe("exercise");
  });

  it("converts notes to frequency (A4 = 440)", () => {
    expect(Math.round(noteToFreq("A4")!)).toBe(440);
    expect(Math.round(noteToFreq("C4")!)).toBe(262); // 261.63
    expect(noteToFreq("bad")).toBeNull();
  });

  it("finds the nearest note + cents deviation", () => {
    expect(nearestNote(440).name).toBe("A4");
    expect(nearestNote(440).cents).toBe(0);
    // ~30 cents sharp of A4
    const sharp = 440 * Math.pow(2, 30 / 1200);
    expect(nearestNote(sharp).cents).toBeGreaterThan(25);
    expect(centsOff(sharp, 440)).toBe(30);
  });
});
