import { describe, it, expect } from "vitest";
import { MANAGER_ARCHETYPES, MANAGER_LIST, getManagerArchetype, pickManagerTarget } from "../../../public/construction-game/src/logic/managers.js";

const wk = (x: number, z: number, state: string, escaped = false) => ({ x, z, state, escaped });

describe("managers", () => {
  it("has 4 archetypes with required fields", () => {
    expect(MANAGER_LIST).toHaveLength(4);
    expect(getManagerArchetype("drill").tactic).toBe("bark");
    expect(getManagerArchetype("drill").hireCost).toBe(1400);
    expect(getManagerArchetype("drill").salary).toBe(8);
    expect(getManagerArchetype("vibe").passive).toBe(true);
    expect(() => getManagerArchetype("nope")).toThrow();
  });
  it("pickManagerTarget returns nearest slacking/sabotage worker in radius", () => {
    const arche = getManagerArchetype("veteran");
    const workers = [wk(0, 0, "working"), wk(2, 0, "slacking"), wk(1, 0, "slacking")];
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, workers)).toBe(2);
  });
  it("pickManagerTarget ignores working/escaped and out-of-range", () => {
    const arche = getManagerArchetype("intern");
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, [wk(0, 0, "working"), wk(1, 0, "slacking", true)])).toBe(-1);
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, [wk(99, 0, "slacking")])).toBe(-1);
  });
  it("sabotage workers are eligible targets", () => {
    const arche = getManagerArchetype("veteran");
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, [wk(1, 0, "sabotage")])).toBe(0);
  });
});
