import { describe, it, expect } from "vitest";
import { createRound, tickRound, isOver } from "../../../public/fry-tower-game/src/logic/round.js";

describe("round", () => {
  it("starts in the playing phase with the configured duration", () => {
    const r = createRound({ duration: 90 });
    expect(r.phase).toBe("playing");
    expect(r.timeLeft).toBe(90);
    expect(isOver(r)).toBe(false);
  });
  it("counts down by dt", () => {
    let r = createRound({ duration: 10 });
    r = tickRound(r, 1);
    expect(r.timeLeft).toBeCloseTo(9, 5);
    expect(r.phase).toBe("playing");
  });
  it("ends when time reaches zero", () => {
    let r = createRound({ duration: 1 });
    r = tickRound(r, 1.5);
    expect(r.phase).toBe("ended");
    expect(r.timeLeft).toBe(0);
    expect(isOver(r)).toBe(true);
  });
  it("does not change after it has ended", () => {
    let r = createRound({ duration: 1 });
    r = tickRound(r, 2);
    const ended = r;
    r = tickRound(r, 5);
    expect(r).toEqual(ended);
  });
});
