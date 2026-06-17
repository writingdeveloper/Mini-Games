// Pure, dependency-free game logic for /ppopgi (unit-testable; no three/cannon imports).

export const BREAK_BASE = 0.42, BREAK_SPAN = 0.5;

// Prize value from a 0..1 roll: rare golden (5), uncommon (3), common (1).
export function rollValue(r) { return r < 0.1 ? 5 : r < 0.32 ? 3 : 1; }

// Heavier prize = harder to hold.
export function prizeMass(value) { return value === 5 ? 0.5 : value === 3 ? 0.32 : 0.2; }

// Weight penalty on grip strength (heavier = weaker hold).
export function weightPenalty(value) { return value === 5 ? 0.72 : value === 3 ? 0.85 : 1; }

// Deterministic grip snap-distance: centered + lighter + single grab = firmer hold.
// (main.js adds a small ± noise on top for machine variance.)
export function gripBreakDist(center, value, n) {
  return (BREAK_BASE + BREAK_SPAN * center) * weightPenalty(value) / Math.sqrt(n);
}

// Round timer never goes below 0.
export function tickTime(t, dt) { return Math.max(0, t - dt); }
