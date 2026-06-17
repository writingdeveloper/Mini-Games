import { describe, it, expect } from "vitest";
import {
  rollValue,
  prizeMass,
  weightPenalty,
  gripBreakDist,
  tickTime,
} from "../../../public/ppopgi/src/logic.js";

describe("rollValue", () => {
  it("maps the 0..1 roll to rare/uncommon/common values", () => {
    expect(rollValue(0.0)).toBe(5); // rare golden (<0.10)
    expect(rollValue(0.09)).toBe(5);
    expect(rollValue(0.1)).toBe(3); // uncommon (<0.32)
    expect(rollValue(0.31)).toBe(3);
    expect(rollValue(0.32)).toBe(1); // common
    expect(rollValue(0.99)).toBe(1);
  });
  it("is dominated by common prizes across the range", () => {
    let common = 0;
    for (let i = 0; i < 1000; i++) if (rollValue(i / 1000) === 1) common++;
    expect(common).toBeGreaterThan(600); // 68% common by design
  });
});

describe("prizeMass", () => {
  it("makes higher-value prizes heavier (harder to hold)", () => {
    expect(prizeMass(1)).toBeLessThan(prizeMass(3));
    expect(prizeMass(3)).toBeLessThan(prizeMass(5));
    expect(prizeMass(5)).toBeCloseTo(0.5);
  });
});

describe("weightPenalty", () => {
  it("weakens the grip more for heavier prizes", () => {
    expect(weightPenalty(1)).toBe(1);
    expect(weightPenalty(3)).toBeLessThan(1);
    expect(weightPenalty(5)).toBeLessThan(weightPenalty(3));
  });
});

describe("gripBreakDist", () => {
  it("is firmer (larger) for a centered grab", () => {
    expect(gripBreakDist(1, 1, 1)).toBeGreaterThan(gripBreakDist(0.5, 1, 1));
  });
  it("is weaker for heavier prizes", () => {
    expect(gripBreakDist(1, 5, 1)).toBeLessThan(gripBreakDist(1, 1, 1));
  });
  it("splits grip budget across a multi-grab (smaller per prize)", () => {
    expect(gripBreakDist(1, 1, 2)).toBeLessThan(gripBreakDist(1, 1, 1));
    expect(gripBreakDist(1, 1, 2)).toBeCloseTo(gripBreakDist(1, 1, 1) / Math.sqrt(2));
  });
});

describe("tickTime", () => {
  it("counts down and never goes below zero", () => {
    expect(tickTime(2, 0.5)).toBeCloseTo(1.5);
    expect(tickTime(0.2, 0.5)).toBe(0);
  });
});
