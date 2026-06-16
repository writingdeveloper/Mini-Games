import { describe, it, expect } from "vitest";
import { wobbleImpulse } from "../../../public/fry-tower-game/src/logic/challenge.js";

const cfg = { interval: 5, startHeight: 1.5, perMeter: 0.6, maxImpulse: 2.5 };

describe("wobbleImpulse", () => {
  it("is zero while the tower is below the start height", () => {
    expect(wobbleImpulse(3, 1.0, cfg)).toBe(0);
  });
  it("scales with the body's height above the tray once the tower is tall enough", () => {
    expect(wobbleImpulse(2, 4, cfg)).toBeCloseTo(1.2, 6); // 2 * 0.6
  });
  it("floors negative body heights at zero", () => {
    expect(wobbleImpulse(-1, 4, cfg)).toBe(0);
  });
  it("caps the impulse at maxImpulse", () => {
    expect(wobbleImpulse(100, 4, cfg)).toBe(2.5);
  });
});
