import { describe, it, expect } from "vitest";
import { createCombo, onStablePlacement, onCollapse } from "../../../public/fry-tower-game/src/logic/combo.js";

describe("combo", () => {
  it("starts at zero", () => {
    const c = createCombo();
    expect(c.count).toBe(0);
    expect(c.charge).toBe(0);
  });
  it("increments count and charge on a stable placement", () => {
    const c = onStablePlacement(createCombo());
    expect(c.count).toBe(1);
    expect(c.charge).toBe(1);
  });
  it("caps count and charge at the configured max", () => {
    let c = createCombo();
    for (let i = 0; i < 50; i++) c = onStablePlacement(c);
    expect(c.count).toBeLessThanOrEqual(10);
    expect(c.charge).toBeLessThanOrEqual(10);
  });
  it("resets the streak on collapse but keeps charge", () => {
    let c = onStablePlacement(onStablePlacement(createCombo())); // count 2, charge 2
    c = onCollapse(c);
    expect(c.count).toBe(0);
    expect(c.charge).toBe(2);
  });
  it("does not mutate the input state", () => {
    const c0 = createCombo();
    onStablePlacement(c0);
    expect(c0.count).toBe(0);
  });
});
