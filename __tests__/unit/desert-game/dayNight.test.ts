import { describe, it, expect } from "vitest";
import { sunDirection, skyPalette, timeLabel, isNight } from "../../../public/desert-game/src/logic/dayNight.js";

describe("dayNight", () => {
  it("sun is highest at noon (t=0.25) and below horizon at midnight (t=0.75)", () => {
    expect(sunDirection(0.25).y).toBeGreaterThan(0.8);
    expect(sunDirection(0.75).y).toBeLessThan(0);
  });
  it("sun direction is a unit vector", () => {
    const d = sunDirection(0.4);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 5);
  });
  it("is periodic in t", () => {
    expect(sunDirection(0.1).y).toBeCloseTo(sunDirection(1.1).y, 6);
  });
  it("skyPalette returns finite rgb in [0,1] for top/bottom/fog", () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const p = skyPalette(t);
      for (const c of [p.top, p.bottom, p.fog]) {
        for (const ch of [c.r, c.g, c.b]) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it("flags night correctly", () => {
    expect(isNight(0.75)).toBe(true);
    expect(isNight(0.25)).toBe(false);
    expect(typeof timeLabel(0.5)).toBe("string");
  });
});
