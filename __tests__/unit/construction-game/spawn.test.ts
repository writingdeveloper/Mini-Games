import { describe, it, expect } from "vitest";
import { mulberry32, spawnWorkers, spawnProps } from "../../../public/construction-game/src/logic/spawn.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

describe("spawn", () => {
  it("mulberry32 is deterministic for a seed", () => {
    const a = mulberry32(123), b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA[0]).toBeGreaterThanOrEqual(0);
    expect(seqA[0]).toBeLessThan(1);
  });
  it("spawnWorkers is deterministic and produces the requested count", () => {
    const r1 = spawnWorkers(7777, 8);
    const r2 = spawnWorkers(7777, 8);
    expect(r1).toHaveLength(8);
    expect(r1).toEqual(r2);
    for (const w of r1) {
      expect(["dozer", "phone", "chatter", "hothead"]).toContain(w.archetypeId);
      expect(Math.abs(w.x)).toBeLessThanOrEqual(CONFIG.site.width / 2 - 2);
      expect(Math.abs(w.z)).toBeLessThanOrEqual(CONFIG.site.depth / 2 - 2);
    }
  });
  it("different seeds give different layouts", () => {
    expect(spawnWorkers(1, 8)).not.toEqual(spawnWorkers(2, 8));
  });
  it("spawnProps is deterministic", () => {
    expect(spawnProps(7777, 12)).toEqual(spawnProps(7777, 12));
    expect(spawnProps(7777, 12)).toHaveLength(12);
  });
});
