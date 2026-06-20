import { describe, it, expect } from "vitest";
import {
  DIRS, mulberry32, reactionWindow, rezeChance, comboMult, scoreFor,
  nextCommand, judge,
} from "../../../public/makima-says/src/logic.js";

describe("makima-says logic", () => {
  it("reactionWindow shrinks with round, floored at 0.55", () => {
    expect(reactionWindow(0)).toBeCloseTo(1.4);
    expect(reactionWindow(5)).toBeLessThan(reactionWindow(2));
    expect(reactionWindow(100)).toBeCloseTo(0.55);
  });

  it("rezeChance rises with round, capped at 0.45", () => {
    expect(rezeChance(0)).toBeCloseTo(0.25);
    expect(rezeChance(100)).toBeCloseTo(0.45);
    expect(rezeChance(10)).toBeGreaterThan(rezeChance(2));
  });

  it("comboMult ramps from 1 and caps at 4", () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(1)).toBe(1);
    expect(comboMult(3)).toBeCloseTo(2);
    expect(comboMult(100)).toBe(4);
  });

  it("scoreFor multiplies base 100 by comboMult", () => {
    expect(scoreFor(1)).toBe(100);
    expect(scoreFor(3)).toBe(200);
  });

  it("judge: makima → must input the shown direction", () => {
    expect(judge({ speaker: "makima", dir: "left" }, "left")).toBe("hit");
    expect(judge({ speaker: "makima", dir: "left" }, "right")).toBe("miss");
    expect(judge({ speaker: "makima", dir: "left" }, null)).toBe("miss");
  });

  it("judge: reze → must NOT input anything", () => {
    expect(judge({ speaker: "reze", dir: "up" }, null)).toBe("hit");
    expect(judge({ speaker: "reze", dir: "up" }, "up")).toBe("miss");
    expect(judge({ speaker: "reze", dir: "up" }, "down")).toBe("miss");
  });

  it("nextCommand is deterministic for a given seed and emits valid shape", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c1 = nextCommand(0, a);
    const c2 = nextCommand(0, b);
    expect(c1).toEqual(c2);
    expect(["makima", "reze"]).toContain(c1.speaker);
    expect(DIRS).toContain(c1.dir);
  });
});
