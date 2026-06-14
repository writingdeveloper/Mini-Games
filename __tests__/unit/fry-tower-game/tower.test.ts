import { describe, it, expect } from "vitest";
import { towerHeight, isSettled, fallenCount } from "../../../public/fry-tower-game/src/logic/tower.js";

// Minimal mock of a cannon body: only what the helpers read.
// quaternion defaults to identity (fry lying flat, y-axis = world-up → half-thickness is the vertical extent).
const body = (
  y: number,
  v = 0,
  av = 0,
  q: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 },
) => ({
  position: { x: 0, y, z: 0 },
  velocity: { length: () => v },
  angularVelocity: { length: () => av },
  quaternion: q,
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

  // --- Orientation-aware height (QA#3) ---
  // A fry rotated 90° about the Z axis stands on its end: the long axis now points up,
  // so its vertical half-extent is length/2 = 0.8, NOT thickness/2 = 0.09.
  it("credits a 90°-Z-rotated (standing) fry as length/2 ≈ 0.8 above its center", () => {
    // quaternion for +90° about Z: (x=0, y=0, z=sin45°, w=cos45°)
    const q90z = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
    // fry center at y=0, trayTopY=0 → height = topY - 0 = 0 + 0.8 = 0.8
    const h = towerHeight([body(0, 0, 0, q90z)], 0);
    expect(h).toBeCloseTo(0.8, 2);   // length/2 = 1.6/2
    expect(h).toBeGreaterThan(0.5);  // clearly more than flat (0.09)
  });

  // A fry leaned 45° about Z: vertical extent = hx*|sin45°| + hy*|cos45°|
  //   = 0.8*(√2/2) + 0.09*(√2/2) ≈ 0.6293
  it("credits a 45°-Z-leaned fry between flat (0.09) and standing (0.8)", () => {
    const sin22 = Math.sin(Math.PI / 8);
    const cos22 = Math.cos(Math.PI / 8);
    const q45z = { x: 0, y: 0, z: sin22, w: cos22 };
    const h = towerHeight([body(0, 0, 0, q45z)], 0);
    expect(h).toBeGreaterThan(0.09);
    expect(h).toBeLessThan(0.8);
    expect(h).toBeCloseTo((1.6 / 2) * Math.SQRT1_2 + (0.18 / 2) * Math.SQRT1_2, 2);
  });

  // A fry with NO quaternion property should fall back to flat behaviour (backward compat).
  it("falls back to thickness/2 when quaternion is absent (identity fallback)", () => {
    const noQBody = {
      position: { x: 0, y: 0.09, z: 0 },
      velocity: { length: () => 0 },
      angularVelocity: { length: () => 0 },
      // no quaternion field
    };
    expect(towerHeight([noQBody], 0)).toBeCloseTo(0.18, 2);
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
