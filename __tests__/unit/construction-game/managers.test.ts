import { describe, it, expect } from "vitest";
import {
  MANAGER_LIST,
  getManagerArchetype,
  scoreManagerTarget,
  pickManagerTarget,
  managerTargetScore,
  chooseTactic,
  separation,
} from "../../../public/construction-game/src/logic/managers.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

const RAGE = CONFIG.rage;
const ctx = { tactics: CONFIG.tactics, rage: CONFIG.rage };
// worker view the pure picker understands
const wk = (over: Record<string, unknown> = {}) => ({ x: 0, z: 0, state: "slacking", rage: 10, escaped: false, sensitivity: 1, ...over });
const at = (x: number, z = 0) => ({ x, z });

describe("managers", () => {
  it("has 4 archetypes; veteran notices farther than the intern", () => {
    expect(MANAGER_LIST).toHaveLength(4);
    expect(getManagerArchetype("drill").tactic).toBe("bark");
    expect(getManagerArchetype("drill").hireCost).toBe(1400);
    expect(getManagerArchetype("drill").salary).toBe(8);
    expect(getManagerArchetype("vibe").passive).toBe(true);
    expect(getManagerArchetype("veteran").awareness).toBeGreaterThan(getManagerArchetype("intern").awareness);
    expect(() => getManagerArchetype("nope")).toThrow();
  });

  describe("pickManagerTarget — danger-first triage", () => {
    const vet = getManagerArchetype("veteran");
    it("ignores working / escaped / out-of-awareness workers", () => {
      expect(pickManagerTarget(at(0), vet, [wk({ state: "working", rage: 0 })], ctx)).toBe(-1);
      expect(pickManagerTarget(at(0), vet, [wk({ escaped: true })], ctx)).toBe(-1);
      expect(pickManagerTarget(at(0), vet, [wk({ x: 99 })], ctx)).toBe(-1);
    });
    it("prefers the more dangerous worker even when it is farther (riot > slacking)", () => {
      const ws = [wk({ x: 1, state: "slacking", rage: 10 }), wk({ x: 10, state: "riot", rage: 96 })];
      expect(pickManagerTarget(at(0), vet, ws, ctx)).toBe(1);
    });
    it("sabotage outranks slacking", () => {
      const ws = [wk({ x: 1, state: "slacking" }), wk({ x: 3, state: "sabotage" })];
      expect(pickManagerTarget(at(0), vet, ws, ctx)).toBe(1);
    });
    it("within the same danger band, picks the closer worker", () => {
      const ws = [wk({ x: 5, state: "slacking" }), wk({ x: 2, state: "slacking" })];
      expect(pickManagerTarget(at(0), vet, ws, ctx)).toBe(1);
    });
    it("a soothe manager pre-empts a still-working worker rising toward flee", () => {
      const ws = [wk({ x: 1, state: "working", rage: RAGE.flee - 4 })];
      expect(pickManagerTarget(at(0), vet, ws, ctx)).toBe(0);
    });
  });

  describe("chooseTactic never pushes a worker across flee", () => {
    it("a soothe manager always soothes (safe at any rage)", () => {
      expect(chooseTactic(getManagerArchetype("veteran"), wk({ rage: 70 }), CONFIG.tactics, RAGE)).toBe("soothe");
    });
    it("drill barks a calm slacker", () => {
      expect(chooseTactic(getManagerArchetype("drill"), wk({ rage: 10 }), CONFIG.tactics, RAGE)).toBe("bark");
    });
    it("drill falls back to taunt when a bark would cross flee", () => {
      // sens 0.8 at rage 60: bark +28*0.8=22.4 -> 82.4 (cross); taunt +15*0.8=12 -> 72 (safe)
      expect(chooseTactic(getManagerArchetype("drill"), wk({ rage: 60, sensitivity: 0.8 }), CONFIG.tactics, RAGE)).toBe("taunt");
    });
    it("drill declines (null) when even a taunt would cross flee", () => {
      // hothead sens 2.0 at rage 58: bark +56 and taunt +30 both cross flee 80
      expect(chooseTactic(getManagerArchetype("drill"), wk({ rage: 58, sensitivity: 2.0 }), CONFIG.tactics, RAGE)).toBeNull();
    });
    it("the passive vibe manager has no walk-up tactic", () => {
      expect(chooseTactic(getManagerArchetype("vibe"), wk(), CONFIG.tactics, RAGE)).toBeNull();
    });
  });

  it("an aggressive manager won't target a worker it could only push across flee, but a soother will", () => {
    const hot = wk({ x: 1, state: "slacking", rage: 58, sensitivity: 2.0 });
    expect(managerTargetScore(at(0), getManagerArchetype("drill"), hot, ctx)).toBe(-Infinity);
    expect(managerTargetScore(at(0), getManagerArchetype("veteran"), hot, ctx)).toBeGreaterThan(-Infinity);
  });

  it("scoreManagerTarget returns -Infinity for a calm working worker (nothing to do)", () => {
    expect(scoreManagerTarget(at(0), getManagerArchetype("veteran"), wk({ state: "working", rage: 0 }), RAGE)).toBe(-Infinity);
  });

  it("separation pushes near peers apart and ignores far ones", () => {
    const push = separation(at(0), [at(0.5), at(50)], 1.4);
    expect(push.x).toBeLessThan(0); // shoved away from the +x neighbor
    expect(Math.abs(push.z)).toBeLessThan(1e-9);
    const clear = separation(at(0), [at(50)], 1.4);
    expect(clear.x).toBe(0);
    expect(clear.z).toBe(0);
  });
});
