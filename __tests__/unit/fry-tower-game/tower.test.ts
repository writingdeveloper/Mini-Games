import { describe, it, expect } from "vitest";
import { towerHeight, isSettled, fallenCount } from "../../../public/fry-tower-game/src/logic/tower.js";

// Minimal mock of a cannon body: only what the helpers read.
const body = (y: number, v = 0, av = 0) => ({
  position: { x: 0, y, z: 0 },
  velocity: { length: () => v },
  angularVelocity: { length: () => av },
});

describe("towerHeight", () => {
  it("measures the top of a settled stack above the tray (center + half-thickness)", () => {
    // two resting fries; top fry center at 0.27, half-thickness 0.09 -> top 0.36
    expect(towerHeight([body(0.09), body(0.27)], 0)).toBeCloseTo(0.36, 2);
  });
  it("ignores fries that fell off the tray", () => {
    expect(towerHeight([body(0.09), body(-3)], 0)).toBeCloseTo(0.18, 2);
  });
  it("ignores in-flight (still-moving) fries so a buzzer-beater drop can't inflate height", () => {
    // a settled fry at the bottom and a fry mid-fall at y=6 moving fast -> only the settled one counts
    const h = towerHeight([body(0.09, 0), body(6, 8)], 0);
    expect(h).toBeLessThan(1);
    expect(h).toBeCloseTo(0.18, 2);
  });
  it("is zero when the only fry is still falling", () => {
    expect(towerHeight([body(6, 8)], 0)).toBe(0);
  });
});

describe("isSettled", () => {
  it("is true when linear and angular speed are below threshold", () => {
    expect(isSettled(body(0.09, 0.1, 0.1))).toBe(true);
  });
  it("is false while moving fast", () => {
    expect(isSettled(body(6, 8, 0))).toBe(false);
  });
  it("is false while spinning fast", () => {
    expect(isSettled(body(0.09, 0, 8))).toBe(false);
  });
});

describe("fallenCount", () => {
  it("counts only fries below the tray", () => {
    expect(fallenCount([body(0.09), body(-3), body(-2)], 0)).toBe(2);
  });
});
