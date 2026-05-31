import { describe, it, expect } from "vitest";
import { nearestUndiscovered, withinRadius } from "../../../public/desert-game/src/logic/discovery.js";

const lm = (x: number, z: number, discovered = false) => ({ x, z, discovered });

describe("discovery", () => {
  it("returns the nearest UNdiscovered item with distance", () => {
    const items = [lm(0, 0, true), lm(10, 0), lm(3, 4)];
    const r = nearestUndiscovered({ x: 0, z: 0 }, items);
    expect(r).not.toBeNull();
    expect(r?.index).toBe(2);
    expect(r?.distance).toBeCloseTo(5, 5);
  });
  it("returns null when all discovered", () => {
    expect(nearestUndiscovered({ x: 0, z: 0 }, [lm(1, 1, true)])).toBeNull();
  });
  it("withinRadius lists indices inside the radius and not yet flagged", () => {
    const items = [lm(0, 0), lm(100, 0), lm(2, 0, true)];
    expect(withinRadius({ x: 0, z: 0 }, items, 5)).toEqual([0]);
  });
  it("withinRadius is exclusive of already-flagged items", () => {
    const items = [lm(1, 0, true)];
    expect(withinRadius({ x: 0, z: 0 }, items, 5)).toEqual([]);
  });
});
