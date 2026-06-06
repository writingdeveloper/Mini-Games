import { describe, it, expect } from "vitest";
import { DIFFICULTY_MODES, applyDifficulty } from "../../../public/construction-game/src/logic/difficulty.js";

const baseConfig = () => ({ workerCount: 0, shiftSeconds: 0, targetFloors: 0, targetBuildings: 0, slackMult: 1, rage: { decayPerSec: 0 }, production: { floorsPerBuilding: 3 }, economy: { startFunds: 0, floorReward: 0 }, events: { badMult: 1, goodMult: 1 } });

describe("difficulty", () => {
  it("exposes easy/normal/hard modes", () => {
    expect(Object.keys(DIFFICULTY_MODES).sort()).toEqual(["easy", "hard", "normal"]);
  });
  it("applyDifficulty('easy') sets values + derives targetFloors", () => {
    const c = applyDifficulty(baseConfig(), "easy");
    expect(c.workerCount).toBe(6);
    expect(c.shiftSeconds).toBe(280);
    expect(c.targetBuildings).toBe(2);
    expect(c.targetFloors).toBe(6); // 2 * 3
    expect(c.rage.decayPerSec).toBeCloseTo(2.6, 5);
    expect(c.slackMult).toBeCloseTo(1.2, 5);
    expect(c.economy.startFunds).toBe(6000);
    expect(c.economy.floorReward).toBe(1000);
    expect(c.events.badMult).toBeCloseTo(0.6, 5);
    expect(c.events.goodMult).toBeCloseTo(1.2, 5);
  });
  it("applyDifficulty('normal') writes neutral (1.0) event multipliers", () => {
    const c = applyDifficulty(baseConfig(), "normal");
    expect(c.events.badMult).toBeCloseTo(1.0, 5);
    expect(c.events.goodMult).toBeCloseTo(1.0, 5);
  });
  it("applyDifficulty('hard') derives targetFloors = 4*3 = 12", () => {
    const c = applyDifficulty(baseConfig(), "hard");
    expect(c.workerCount).toBe(10);
    expect(c.targetBuildings).toBe(4);
    expect(c.targetFloors).toBe(12);
    expect(c.slackMult).toBeCloseTo(0.95, 5);
    expect(c.events.badMult).toBeCloseTo(1.3, 5);
    expect(c.events.goodMult).toBeCloseTo(0.9, 5);
  });
  it("throws on unknown mode", () => {
    expect(() => applyDifficulty(baseConfig(), "nope")).toThrow();
  });
});
