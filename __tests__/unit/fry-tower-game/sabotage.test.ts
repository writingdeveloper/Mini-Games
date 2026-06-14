import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../public/fry-tower-game/src/logic/rng.js";
import {
  SABOTAGE,
  grantSabotage,
  shouldGrant,
  sabotageByKey,
} from "../../../public/fry-tower-game/src/logic/sabotage.js";
import { CONFIG } from "../../../public/fry-tower-game/src/logic/config.js";

// ── rng ──────────────────────────────────────────────────────────────────────
describe("mulberry32", () => {
  it("returns a function that produces floats in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic: same seed → same sequence", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});

// ── SABOTAGE constant ─────────────────────────────────────────────────────────
describe("SABOTAGE", () => {
  it("has exactly 4 entries", () => {
    expect(SABOTAGE).toHaveLength(4);
  });

  it("contains all four expected keys", () => {
    const keys = SABOTAGE.map((s) => s.key);
    expect(keys).toContain("gust");
    expect(keys).toContain("grease");
    expect(keys).toContain("seagull");
    expect(keys).toContain("ketchup");
  });

  it("each entry has key, name, and emoji", () => {
    for (const s of SABOTAGE) {
      expect(s).toHaveProperty("key");
      expect(s).toHaveProperty("name");
      expect(s).toHaveProperty("emoji");
    }
  });
});

// ── grantSabotage ─────────────────────────────────────────────────────────────
describe("grantSabotage", () => {
  it("returns a valid sabotage key", () => {
    const rng = mulberry32(99);
    const validKeys = SABOTAGE.map((s) => s.key);
    for (let i = 0; i < 20; i++) {
      expect(validKeys).toContain(grantSabotage(rng));
    }
  });

  it("is deterministic for a fixed seed", () => {
    const validKeys = SABOTAGE.map((s) => s.key);
    const results1: string[] = [];
    const results2: string[] = [];
    const rng1 = mulberry32(7);
    const rng2 = mulberry32(7);
    for (let i = 0; i < 12; i++) {
      results1.push(grantSabotage(rng1));
      results2.push(grantSabotage(rng2));
    }
    expect(results1).toEqual(results2);
    // every result is a valid key
    for (const k of results1) expect(validKeys).toContain(k);
  });

  it("can return all four keys over many draws", () => {
    const rng = mulberry32(1337);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(grantSabotage(rng));
    expect(seen.size).toBe(4);
  });
});

// ── shouldGrant ───────────────────────────────────────────────────────────────
describe("shouldGrant", () => {
  const cost = CONFIG.sabotage.grantCost; // 3

  it("is true when charge >= cost and held is null", () => {
    expect(shouldGrant(cost, null)).toBe(true);
    expect(shouldGrant(cost + 2, null)).toBe(true);
  });

  it("is false when charge < cost", () => {
    expect(shouldGrant(cost - 1, null)).toBe(false);
    expect(shouldGrant(0, null)).toBe(false);
  });

  it("is false when a sabotage is already held (even with enough charge)", () => {
    expect(shouldGrant(cost, "gust")).toBe(false);
    expect(shouldGrant(cost + 5, "ketchup")).toBe(false);
  });

  it("respects a custom cost override", () => {
    expect(shouldGrant(5, null, 5)).toBe(true);
    expect(shouldGrant(4, null, 5)).toBe(false);
  });
});

// ── sabotageByKey ─────────────────────────────────────────────────────────────
describe("sabotageByKey", () => {
  it("returns the correct entry for each valid key", () => {
    for (const s of SABOTAGE) {
      const result = sabotageByKey(s.key);
      expect(result).not.toBeNull();
      expect(result!.key).toBe(s.key);
      expect(result!.name).toBe(s.name);
      expect(result!.emoji).toBe(s.emoji);
    }
  });

  it("returns null for an unknown key", () => {
    expect(sabotageByKey("unknown")).toBeNull();
    expect(sabotageByKey("")).toBeNull();
    expect(sabotageByKey("GUST")).toBeNull();
  });
});
