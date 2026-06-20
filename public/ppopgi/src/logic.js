// Pure, dependency-free game logic for /ppopgi (unit-testable; no three/cannon imports).

export const BREAK_BASE = 0.42, BREAK_SPAN = 0.5;

// Prize value from a 0..1 roll: rare golden (5), uncommon (3), common (1).
export function rollValue(r) { return r < 0.1 ? 5 : r < 0.32 ? 3 : 1; }

// Heavier prize = harder to hold. The gold (5) used to be 0.5 AND get the 0.6 weightPenalty —
// a double risk that made it slip so often it was never worth attempting; lightened to 0.4 so the
// weightPenalty is the single, fair risk axis (still the heaviest prize).
export function prizeMass(value) { return value === 5 ? 0.4 : value === 3 ? 0.32 : 0.2; }

// Weight penalty on grip strength (heavier = weaker hold). Tuned so the high-value golden
// prize genuinely slips more often — "safe 1pt vs risky 5pt" actually means something.
export function weightPenalty(value) { return value === 5 ? 0.6 : value === 3 ? 0.8 : 1; }

// Combo multiplier: consecutive deliveries ramp the payout. 1→×1, 2→×1.4, 3→×1.8 … 6+→×3 (capped).
// step 0.4 (was 0.5) so ×3 takes a longer streak (6) — a real "event", not reached by combo 5.
// A slip OR an empty grab resets the streak (see main.js), so it's the heart of the risk/reward loop.
export function comboMult(combo) { return Math.min(3, 1 + Math.max(0, combo - 1) * 0.4); }

// Deterministic grip snap-distance: centered + lighter + single grab = firmer hold.
// (main.js adds a small ± noise on top for machine variance.)
export function gripBreakDist(center, value, n) {
  return (BREAK_BASE + BREAK_SPAN * center) * weightPenalty(value) / Math.sqrt(n);
}

// Round timer never goes below 0.
export function tickTime(t, dt) { return Math.max(0, t - dt); }
