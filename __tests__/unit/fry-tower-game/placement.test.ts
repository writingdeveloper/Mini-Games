import { describe, it, expect } from "vitest";
import {
  solveElbow,
  clampToReach,
  releaseVelocity,
} from "../../../public/fry-tower-game/src/logic/placement.js";

type Vec = { x: number; y: number; z: number };
const len = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("solveElbow", () => {
  it("places the elbow so both bone lengths are preserved when reachable", () => {
    const S = { x: 0, y: 5, z: 0 },
      T = { x: 0, y: 0, z: 0 };
    const L1 = 3,
      L2 = 3,
      pole = { x: 0, y: 1, z: 0.3 };
    const e = solveElbow(S, T, L1, L2, pole);
    expect(len(S, e)).toBeCloseTo(L1, 4);
    expect(len(e, T)).toBeCloseTo(L2, 4);
  });
  it("keeps the upper-bone length even when the target is out of reach", () => {
    const S = { x: 0, y: 5, z: 0 },
      T = { x: 0, y: -50, z: 0 };
    const e = solveElbow(S, T, 3, 3, { x: 0, y: 1, z: 0.3 });
    expect(len(S, e)).toBeCloseTo(3, 4);
    expect(Number.isFinite(e.x + e.y + e.z)).toBe(true);
  });
});

describe("clampToReach", () => {
  it("returns the target unchanged when within reach", () => {
    const S = { x: 0, y: 5, z: 0 };
    const out = clampToReach(S, { x: 0, y: 2, z: 0 }, 8);
    expect(out).toEqual({ x: 0, y: 2, z: 0 });
  });
  it("pulls the target onto the reach sphere when too far", () => {
    const S = { x: 0, y: 0, z: 0 };
    const out = clampToReach(S, { x: 100, y: 0, z: 0 }, 8);
    expect(len(S, out)).toBeCloseTo(8, 4);
    expect(out.y).toBeCloseTo(0, 4);
  });
});

describe("releaseVelocity", () => {
  const cfg = { max: 7, assistScale: 0.18, upClamp: 0.5 };
  it("passes hand velocity through, clamped to max magnitude", () => {
    const v = releaseVelocity({ x: 20, y: 0, z: 0 }, false, cfg);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(7, 4);
  });
  it("damps strongly when assist is on", () => {
    const v = releaseVelocity({ x: 5, y: 0, z: 0 }, true, cfg);
    expect(v.x).toBeCloseTo(0.9, 4); // 5 * 0.18
  });
  it("clamps upward velocity so fries are not flung up", () => {
    const v = releaseVelocity({ x: 0, y: 5, z: 0 }, false, cfg);
    expect(v.y).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});
