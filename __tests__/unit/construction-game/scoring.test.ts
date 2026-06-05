import { describe, it, expect } from "vitest";
import { isWin, isDefeat, evaluate, scoreMultiplier, computeScore } from "../../../public/construction-game/src/logic/scoring.js";

const base = {
  elapsed: 30, shiftSeconds: 180, floorsBuilt: 2, targetFloors: 5,
  crewRemaining: 8, crewCollapseThreshold: 2, combo: 0, incidents: 1,
};

describe("scoring", () => {
  it("win when target floors reached", () => {
    expect(isWin({ ...base, floorsBuilt: 5 })).toBe(true);
    expect(isWin({ ...base, floorsBuilt: 4 })).toBe(false);
  });
  it("defeat on time-out (not won) or crew collapse", () => {
    expect(isDefeat({ ...base, elapsed: 180, floorsBuilt: 4 })).toBe(true);
    expect(isDefeat({ ...base, crewRemaining: 1 })).toBe(true);
    expect(isDefeat(base)).toBe(false);
  });
  it("evaluate prioritises win over defeat over playing", () => {
    expect(evaluate({ ...base, floorsBuilt: 5, elapsed: 200 })).toBe("win");
    expect(evaluate({ ...base, elapsed: 200 })).toBe("defeat");
    expect(evaluate(base)).toBe("playing");
  });
  it("scoreMultiplier grows 0.1 per combo", () => {
    expect(scoreMultiplier(0)).toBeCloseTo(1.0, 5);
    expect(scoreMultiplier(3)).toBeCloseTo(1.3, 5);
  });
  it("computeScore = (floors*pts + remaining*bonus) * comboMul + noIncidentBonus", () => {
    expect(computeScore({ ...base, floorsBuilt: 5, combo: 0, incidents: 1 })).toBe(6500);
    expect(computeScore({ ...base, floorsBuilt: 5, combo: 2, incidents: 1 })).toBe(Math.round(6500 * 1.2));
    expect(computeScore({ ...base, floorsBuilt: 5, combo: 0, incidents: 0 })).toBe(6500 + 2000);
  });
});
