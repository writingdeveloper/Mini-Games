import { describe, it, expect } from "vitest";
import { clampRage, addRage, decayRage, rageStage } from "../../../public/construction-game/src/logic/rage.js";

describe("rage", () => {
  it("clamps to 0..100", () => {
    expect(clampRage(120)).toBe(100);
    expect(clampRage(-5)).toBe(0);
    expect(clampRage(42)).toBe(42);
  });
  it("addRage scales positive deltas by sensitivity, not negatives", () => {
    expect(addRage({ rage: 10 }, 28, 1).rage).toBe(38);
    expect(addRage({ rage: 10 }, 28, 2).rage).toBe(66);
    expect(addRage({ rage: 10 }, -25, 2).rage).toBe(0);
  });
  it("decayRage subtracts decayPerSec*dt, floored at 0", () => {
    expect(decayRage({ rage: 50 }, 1).rage).toBe(46);
    expect(decayRage({ rage: 50 }, 0.5).rage).toBe(48);
    expect(decayRage({ rage: 1 }, 1).rage).toBe(0);
  });
  it("rageStage maps thresholds 60/80/95", () => {
    expect(rageStage(59)).toBe("calm");
    expect(rageStage(60)).toBe("sabotage");
    expect(rageStage(79)).toBe("sabotage");
    expect(rageStage(80)).toBe("fleeing");
    expect(rageStage(94)).toBe("fleeing");
    expect(rageStage(95)).toBe("riot");
    expect(rageStage(100)).toBe("riot");
  });
});
