import { describe, it, expect } from "vitest";
import { createEconomy, earn, canAfford, spend, payrollPerSec, tickEconomy } from "../../../public/construction-game/src/logic/economy.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

describe("economy", () => {
  it("createEconomy starts with funds and no fire cooldown", () => {
    const e = createEconomy(4000);
    expect(e.funds).toBe(4000);
    expect(e.fireCooldown).toBe(0);
  });
  it("earn / canAfford / spend", () => {
    const e = createEconomy(4000);
    earn(e, 1000);
    expect(e.funds).toBe(5000);
    expect(canAfford(e, 1200)).toBe(true);
    expect(canAfford(e, 6000)).toBe(false);
    expect(spend(e, 1200)).toBe(true);
    expect(e.funds).toBe(3800);
    expect(spend(e, 9999)).toBe(false);
    expect(e.funds).toBe(3800);
    expect(spend(createEconomy(100), 100)).toBe(true); // exact-funds boundary
  });
  it("payrollPerSec sums manager salaries", () => {
    expect(payrollPerSec([{ salary: 6 }, { salary: 12 }, { salary: 3 }])).toBe(21);
    expect(payrollPerSec([])).toBe(0);
  });
  it("tickEconomy deducts payroll; no fire while solvent", () => {
    const e = createEconomy(100);
    const fi = tickEconomy(e, [{ salary: 6 }], 1);
    expect(e.funds).toBeCloseTo(94, 5);
    expect(fi).toBe(-1);
  });
  it("tickEconomy fires the highest-salary manager when insolvent, then respects cooldown", () => {
    const e = { funds: -5, fireCooldown: 0 };
    const fi = tickEconomy(e, [{ salary: 6 }, { salary: 12 }, { salary: 3 }], 1);
    expect(e.funds).toBeCloseTo(-26, 5); // payroll (21) deducted even while insolvent
    expect(fi).toBe(1);
    expect(e.fireCooldown).toBeCloseTo(CONFIG.economy.fireCooldownSec, 5);
    const fi2 = tickEconomy(e, [{ salary: 6 }, { salary: 3 }], 1);
    expect(fi2).toBe(-1);
  });
});
