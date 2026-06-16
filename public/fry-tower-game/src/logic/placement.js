// Pure vector math for the hand rig — no THREE / no physics dependency.
// Inputs/outputs are plain {x,y,z} objects so this stays unit-testable.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => {
  const l = length(a) || 1;
  return scale(a, 1 / l);
};
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Two-bone analytic IK (law of cosines). Returns the elbow position such that
// |S-elbow| == L1 and |elbow-T| == L2, bent toward the pole hint. When the
// target is out of reach the chain is clamped, keeping the upper bone length.
export function solveElbow(S, T, L1, L2, pole) {
  const to = sub(T, S);
  const d = clampNum(length(to), Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.05);
  const dir = length(to) > 1e-6 ? norm(to) : { x: 0, y: -1, z: 0 };
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let perp = sub(pole, scale(dir, dot(pole, dir)));
  if (length(perp) < 1e-6) perp = sub({ x: 0, y: 1, z: 0 }, scale(dir, dir.y));
  perp = norm(perp);
  return add(add(S, scale(dir, a)), scale(perp, h));
}

// Pull a target onto the reach sphere around S if it lies beyond maxReach.
export function clampToReach(S, T, maxReach) {
  const to = sub(T, S);
  if (length(to) <= maxReach) return { x: T.x, y: T.y, z: T.z };
  return add(S, scale(norm(to), maxReach));
}

// Map the hand's recent velocity to the velocity a released fry inherits.
// assist damps it for precision; magnitude is capped; upward speed is clamped
// so fries are placed, not launched.
export function releaseVelocity(handVel, assist, cfg) {
  let v = { x: handVel.x, y: handVel.y, z: handVel.z };
  if (assist) v = scale(v, cfg.assistScale);
  const l = length(v);
  if (l > cfg.max) v = scale(v, cfg.max / l);
  v.y = Math.min(v.y, cfg.upClamp);
  return v;
}
