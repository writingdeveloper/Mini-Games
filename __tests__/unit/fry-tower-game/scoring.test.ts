import { describe, it, expect } from "vitest";
import { roundScore } from "../../../public/fry-tower-game/src/logic/scoring.js";

describe("roundScore", () => {
  it("is zero for an empty tower", () => {
    expect(roundScore({ height: 0, combo: 0, stableCount: 0, secondsLeft: 0 })).toBe(0);
  });
  it("increases with height", () => {
    const lo = roundScore({ height: 1, combo: 0, stableCount: 0, secondsLeft: 0 });
    const hi = roundScore({ height: 3, combo: 0, stableCount: 0, secondsLeft: 0 });
    expect(hi).toBeGreaterThan(lo);
  });
  it("adds stable, combo, and time bonuses", () => {
    const base = roundScore({ height: 2, combo: 0, stableCount: 0, secondsLeft: 0 });
    expect(roundScore({ height: 2, combo: 0, stableCount: 4, secondsLeft: 0 })).toBeGreaterThan(base);
    expect(roundScore({ height: 2, combo: 5, stableCount: 0, secondsLeft: 0 })).toBeGreaterThan(base);
    expect(roundScore({ height: 2, combo: 0, stableCount: 0, secondsLeft: 10 })).toBeGreaterThan(base);
  });
  it("clamps negative inputs to zero", () => {
    expect(roundScore({ height: -5, combo: -3, stableCount: -2, secondsLeft: -9 })).toBe(0);
  });
  it("returns an integer", () => {
    expect(Number.isInteger(roundScore({ height: 1.234, combo: 1, stableCount: 1, secondsLeft: 1 }))).toBe(true);
  });
});
