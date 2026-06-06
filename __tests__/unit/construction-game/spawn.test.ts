import { describe, it, expect } from "vitest";
import { mulberry32, spawnWorkers, spawnProps, spawnSkyline } from "../../../public/construction-game/src/logic/spawn.js";
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
  it("workers cluster around the build zone (not scattered to the far corners)", () => {
    for (const w of spawnWorkers(7777, 10)) {
      expect(Math.abs(w.x)).toBeLessThanOrEqual(11); // ±halfX
      expect(w.z).toBeGreaterThanOrEqual(-13); // centerZ -6 ± halfZ 7
      expect(w.z).toBeLessThanOrEqual(1);
    }
  });
  it("different seeds give different layouts", () => {
    expect(spawnWorkers(1, 8)).not.toEqual(spawnWorkers(2, 8));
  });
  it("spawnProps is deterministic", () => {
    expect(spawnProps(7777, 12)).toEqual(spawnProps(7777, 12));
    expect(spawnProps(7777, 12)).toHaveLength(12);
  });
  it("spawnSkyline is deterministic and rings the lot well outside the fence", () => {
    expect(spawnSkyline(7777, 64)).toEqual(spawnSkyline(7777, 64));
    const sky = spawnSkyline(7777, 64);
    expect(sky).toHaveLength(64);
    for (const b of sky) {
      const r = Math.hypot(b.x, b.z);
      expect(r).toBeGreaterThan(CONFIG.site.width / 2); // beyond the 44-wide lot
      expect(r).toBeLessThan(140);
      expect(b.h).toBeGreaterThan(0);
    }
  });
});
