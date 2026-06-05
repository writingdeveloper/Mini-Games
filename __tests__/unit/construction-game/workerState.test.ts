import { describe, it, expect } from "vitest";
import { createWorker, deriveState, stepWorker, applySlackPressure } from "../../../public/construction-game/src/logic/workerState.js";

const HALF = () => 0.5;

describe("workerState", () => {
  it("createWorker starts working, calm, with archetype slack mean", () => {
    const wk = createWorker(1, "dozer", HALF);
    expect(wk.state).toBe("working");
    expect(wk.activity).toBe("working");
    expect(wk.rage).toBe(0);
    expect(wk.slackTimer).toBeCloseTo(10, 5);
    expect(wk.escaped).toBe(false);
  });
  it("deriveState lets rage override activity", () => {
    expect(deriveState({ rage: 0, activity: "working" })).toBe("working");
    expect(deriveState({ rage: 0, activity: "slacking" })).toBe("slacking");
    expect(deriveState({ rage: 65, activity: "working" })).toBe("sabotage");
    expect(deriveState({ rage: 85, activity: "working" })).toBe("fleeing");
    expect(deriveState({ rage: 99, activity: "slacking" })).toBe("riot");
  });
  it("stepWorker turns a working worker into slacking when slackTimer elapses", () => {
    const wk = createWorker(1, "dozer", HALF);
    stepWorker(wk, 11);
    expect(wk.activity).toBe("slacking");
    expect(wk.state).toBe("slacking");
  });
  it("stepWorker decays rage and boost over time", () => {
    const wk = createWorker(1, "phone", HALF);
    wk.rage = 50; wk.boostMul = 2; wk.boostTimer = 5;
    stepWorker(wk, 1);
    expect(wk.rage).toBe(46);
    expect(wk.boostMul).toBe(2);
    expect(wk.boostTimer).toBe(4);
    stepWorker(wk, 10);
    expect(wk.boostMul).toBe(1);
    expect(wk.boostTimer).toBe(0);
  });
  it("applySlackPressure shortens slackTimer (chatter spread)", () => {
    const wk = createWorker(1, "dozer", HALF);
    applySlackPressure(wk, 1, 2);
    expect(wk.slackTimer).toBeCloseTo(8, 5);
  });
});
