import { describe, it, expect } from "vitest";
import { workerOutput, crewOutputPerSecond, advanceProgress } from "../../../public/construction-game/src/logic/production.js";

const wk = (over: Record<string, unknown>) => ({ archetypeId: "phone", state: "working", boostMul: 1, ...over });

describe("production", () => {
  it("working worker outputs baseRate*workRate*boost", () => {
    expect(workerOutput(wk({ archetypeId: "phone" }))).toBeCloseTo(1.0, 5);
    expect(workerOutput(wk({ archetypeId: "dozer" }))).toBeCloseTo(0.9, 5);
    expect(workerOutput(wk({ archetypeId: "hothead", boostMul: 2 }))).toBeCloseTo(2.2, 5);
  });
  it("slacking/fleeing/riot output nothing; sabotage outputs reduced", () => {
    expect(workerOutput(wk({ state: "slacking" }))).toBe(0);
    expect(workerOutput(wk({ state: "fleeing" }))).toBe(0);
    expect(workerOutput(wk({ state: "riot" }))).toBe(0);
    expect(workerOutput(wk({ archetypeId: "phone", state: "sabotage" }))).toBeCloseTo(0.2, 5);
  });
  it("crewOutputPerSecond sums outputs", () => {
    const out = crewOutputPerSecond([wk({}), wk({}), wk({ state: "slacking" })]);
    expect(out).toBeCloseTo(2.0, 5);
  });
  it("advanceProgress completes a floor when progress crosses floorProgress", () => {
    const r = advanceProgress({ progress: 90, floorsBuilt: 0 }, 20, 1);
    expect(r.floorsBuilt).toBe(1);
    expect(r.progress).toBeCloseTo(10, 5);
    expect(r.floorsCompletedThisStep).toBe(1);
  });
  it("advanceProgress can complete multiple floors in one step", () => {
    const r = advanceProgress({ progress: 50, floorsBuilt: 1 }, 250, 1);
    expect(r.floorsCompletedThisStep).toBe(3);
    expect(r.floorsBuilt).toBe(4);
    expect(r.progress).toBeCloseTo(0, 5);
  });
});
