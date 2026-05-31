import { describe, it, expect } from "vitest";
import { makeValueNoise, terrainHeight } from "../../../public/desert-game/src/logic/noise.js";

describe("noise", () => {
  it("is deterministic for a given seed", () => {
    const a = makeValueNoise(42);
    const b = makeValueNoise(42);
    expect(a(1.5, 2.5)).toBeCloseTo(b(1.5, 2.5), 10);
  });
  it("returns values within [-1, 1]", () => {
    const n = makeValueNoise(7);
    for (let i = 0; i < 200; i++) {
      const v = n(i * 0.37, i * 0.91);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("different seeds usually differ", () => {
    expect(makeValueNoise(1)(3, 3)).not.toBeCloseTo(makeValueNoise(2)(3, 3), 5);
  });
  it("terrainHeight is deterministic and finite", () => {
    expect(terrainHeight(10, 20, 99)).toBeCloseTo(terrainHeight(10, 20, 99), 10);
    expect(Number.isFinite(terrainHeight(0, 0, 1))).toBe(true);
  });
  it("terrainHeight near origin is flattened (spawn pad)", () => {
    expect(Math.abs(terrainHeight(0, 0, 1))).toBeLessThan(0.5);
  });
});
