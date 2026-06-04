import { describe, it, expect } from "vitest";
import { DIFFICULTY_MODES, applyDifficulty } from "../../../public/construction-game/src/logic/difficulty.js";

const baseConfig = () => ({ workerCount: 0, shiftSeconds: 0, targetFloors: 0, slackMult: 1, rage: { decayPerSec: 0 }, economy: { startFunds: 0, floorReward: 0 } });

describe("difficulty", () => {
  it("exposes easy/normal/hard modes", () => {
    expect(Object.keys(DIFFICULTY_MODES).sort()).toEqual(["easy", "hard", "normal"]);
  });
  it("applyDifficulty('easy') sets the easy values", () => {
    const c = applyDifficulty(baseConfig(), "easy");
    expect(c.workerCount).toBe(6);
    expect(c.shiftSeconds).toBe(240);
    expect(c.targetFloors).toBe(4);
    expect(c.rage.decayPerSec).toBeCloseTo(5.2, 5);
    expect(c.slackMult).toBeCloseTo(1.25, 5);
    expect(c.economy.startFunds).toBe(6000);
    expect(c.economy.floorReward).toBe(1500);
  });
  it("applyDifficulty('hard') sets the hard values", () => {
    const c = applyDifficulty(baseConfig(), "hard");
    expect(c.workerCount).toBe(10);
    expect(c.shiftSeconds).toBe(150);
    expect(c.targetFloors).toBe(6);
    expect(c.slackMult).toBeCloseTo(0.8, 5);
    expect(c.economy.startFunds).toBe(2500);
  });
  it("throws on unknown mode", () => {
    expect(() => applyDifficulty(baseConfig(), "nope")).toThrow();
  });
});
