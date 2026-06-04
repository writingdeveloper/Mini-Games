import { describe, it, expect } from "vitest";
import { TACTICS, tacticByKey, applyTactic } from "../../../public/construction-game/src/logic/tactics.js";

const w = (over = {}) => ({ rage: 10, activity: "slacking", boostMul: 1, boostTimer: 0, slackTimer: 0, ...over });

describe("tactics", () => {
  it("maps number keys 1/2/3 to bark/taunt/soothe", () => {
    expect(tacticByKey(1)).toBe("bark");
    expect(tacticByKey(2)).toBe("taunt");
    expect(tacticByKey(3)).toBe("soothe");
    expect(tacticByKey(9)).toBeNull();
  });
  it("bark returns worker to work, raises rage, applies boost", () => {
    const r = applyTactic(w(), "bark", 1);
    expect(r.activity).toBe("working");
    expect(r.rage).toBe(38);
    expect(r.boostMul).toBe(TACTICS.bark.boost);
    expect(r.boostTimer).toBe(TACTICS.bark.boostSeconds);
  });
  it("soothe lowers rage", () => {
    expect(applyTactic(w({ rage: 30 }), "soothe", 1).rage).toBe(5);
  });
  it("sensitivity amplifies the rage gain (hothead bark)", () => {
    expect(applyTactic(w(), "bark", 2).rage).toBe(66);
  });
  it("throws on unknown tactic", () => {
    expect(() => applyTactic(w(), "nope", 1)).toThrow();
  });
});
