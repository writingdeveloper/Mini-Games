import { describe, it, expect } from "vitest";
import { ARCHETYPES, ARCHETYPE_LIST, getArchetype } from "../../../public/construction-game/src/logic/archetypes.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

describe("archetypes & config", () => {
  it("has exactly four archetypes with required fields", () => {
    expect(ARCHETYPE_LIST).toHaveLength(4);
    for (const a of ARCHETYPE_LIST) {
      expect(typeof a.slackMeanSeconds).toBe("number");
      expect(typeof a.rageSensitivity).toBe("number");
      expect(typeof a.workRate).toBe("number");
    }
  });
  it("getArchetype returns by id and throws on unknown", () => {
    expect(getArchetype("hothead").rageSensitivity).toBe(2.0);
    expect(() => getArchetype("nope")).toThrow();
  });
  it("config rage thresholds are ordered", () => {
    const { sabotage, flee, riot, max } = CONFIG.rage;
    expect(sabotage).toBeLessThan(flee);
    expect(flee).toBeLessThan(riot);
    expect(riot).toBeLessThan(max);
  });
});
