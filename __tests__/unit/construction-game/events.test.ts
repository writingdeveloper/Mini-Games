import { describe, it, expect } from "vitest";
import { SITE_EVENTS, pickEvent } from "../../../public/construction-game/src/logic/events.js";
import { mulberry32 } from "../../../public/construction-game/src/logic/spawn.js";

describe("events", () => {
  it("SITE_EVENTS is a non-empty, well-formed catalog with unique ids", () => {
    expect(Array.isArray(SITE_EVENTS)).toBe(true);
    expect(SITE_EVENTS.length).toBeGreaterThan(0);
    const kinds = new Set(["good", "neutral", "bad"]);
    for (const e of SITE_EVENTS) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.label).toBe("string");
      expect(typeof e.icon).toBe("string");
      expect(typeof e.weight).toBe("number");
      expect(e.weight).toBeGreaterThan(0);
      expect(kinds.has(e.kind)).toBe(true);
    }
    const ids = SITE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("catalog leans good: total good weight strictly exceeds total bad weight", () => {
    const sum = (kind: string) =>
      SITE_EVENTS.filter((e) => e.kind === kind).reduce((s, e) => s + e.weight, 0);
    expect(sum("good")).toBeGreaterThan(sum("bad"));
  });

  it("pickEvent returns an element of SITE_EVENTS with boundary rng stubs", () => {
    const first = pickEvent(() => 0);
    expect(first).toBe(SITE_EVENTS[0]);
    const last = pickEvent(() => 0.999);
    expect(last).toBe(SITE_EVENTS[SITE_EVENTS.length - 1]);
    expect(SITE_EVENTS).toContain(pickEvent(() => 0.5));
  });

  it("pickEvent with seeded mulberry32 is reproducible", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 50 }, () => pickEvent(a).id);
    const seqB = Array.from({ length: 50 }, () => pickEvent(b).id);
    expect(seqA).toEqual(seqB);
  });

  it("every event id appears at least once over many seeded samples", () => {
    const rng = mulberry32(999);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pickEvent(rng).id);
    for (const e of SITE_EVENTS) expect(seen.has(e.id)).toBe(true);
  });
});
