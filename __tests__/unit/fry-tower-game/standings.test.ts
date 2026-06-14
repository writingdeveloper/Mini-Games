import { describe, it, expect } from "vitest";
import { rankPlayers, matchLeader } from "../../../public/fry-tower-game/src/logic/standings.js";

const players = {
  a: { name: "A", height: 1.2, roundWins: 2 },
  b: { name: "B", height: 2.5, roundWins: 1 },
  c: { name: "C", height: 0.4, roundWins: 0 },
};

describe("standings", () => {
  it("ranks players by height descending (current round)", () => {
    const r = rankPlayers(players, "height");
    expect(r.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
  it("ranks by roundWins for the match leaderboard", () => {
    const r = rankPlayers(players, "roundWins");
    expect(r[0].id).toBe("a");
  });
  it("matchLeader returns the id with the most round wins", () => {
    expect(matchLeader(players)).toBe("a");
  });
  it("handles an empty map", () => {
    expect(rankPlayers({}, "height")).toEqual([]);
    expect(matchLeader({})).toBe(null);
  });
});
