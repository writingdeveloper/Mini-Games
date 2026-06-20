// Pure, dependency-free logic for /makima-says (unit-testable; no DOM/audio).

export const DIRS = ["up", "down", "left", "right"];

// Deterministic RNG so round sequences are reproducible in tests/QA.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reaction window (seconds): starts forgiving, tightens each round, never below 0.55.
export function reactionWindow(round) {
  return Math.max(0.55, 1.4 - round * 0.06);
}

// Probability the temptress 레제 (not 마키마) gives this round's command.
export function rezeChance(round) {
  return Math.min(0.45, 0.25 + round * 0.01);
}

// Consecutive-success multiplier: 1 → ×1, then +0.5 per streak step, capped ×4.
export function comboMult(combo) {
  return Math.min(4, 1 + Math.max(0, combo - 1) * 0.5);
}

// Points for landing a round at the given (post-increment) combo.
export function scoreFor(combo) {
  return Math.round(100 * comboMult(combo));
}

// Build the next command from the round index and an RNG.
export function nextCommand(round, rng) {
  const speaker = rng() < rezeChance(round) ? "reze" : "makima";
  const dir = DIRS[Math.floor(rng() * DIRS.length) % DIRS.length];
  return { speaker, dir };
}

// Verdict for a finished round. input = direction string, or null if nothing was pressed.
//   마키마 → obey: press the shown direction.
//   레제   → resist: press nothing.
export function judge(command, input) {
  if (command.speaker === "makima") return input === command.dir ? "hit" : "miss";
  return input === null ? "hit" : "miss";
}
