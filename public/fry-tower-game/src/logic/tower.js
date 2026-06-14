import { CONFIG } from './config.js';

// Pure, cannon-free helpers over an array of physics bodies. A "body" only needs
// `{ position: {y}, velocity: {length()}, angularVelocity: {length()} }`, so these
// are unit-testable with plain mock objects.

/**
 * Returns the half-extent of an oriented box along the world Y axis.
 *
 * For a box with half-extents (hx, hy, hz), the support along world-up is:
 *   |r10|*hx + |r11|*hy + |r12|*hz
 * where r1* is the middle row of the rotation matrix derived from quaternion q.
 *
 * Standard quaternion → rotation matrix y-row:
 *   r10 = 2*(x*y + z*w)
 *   r11 = 1 - 2*(x*x + z*z)
 *   r12 = 2*(y*z - x*w)
 *
 * Falls back to hy (identity quaternion behaviour) when q is absent.
 */
function upHalfExtent(q, hx, hy, hz) {
  if (!q) return hy; // no quaternion → treat as identity (flat fry)
  const { x, y, z, w } = q;
  const r10 = 2 * (x * y + z * w);
  const r11 = 1 - 2 * (x * x + z * z);
  const r12 = 2 * (y * z - x * w);
  return Math.abs(r10) * hx + Math.abs(r11) * hy + Math.abs(r12) * hz;
}

// Tower height = highest SETTLED fry top above the tray. Fries that fell off the tray
// or are still in motion (mid-air / tumbling) are excluded, so the height reflects the
// resting stack only — a fry dropped at the buzzer can't inflate the score while falling.
export function towerHeight(bodies, trayTopY = 0, fry = CONFIG.fry, cfg = CONFIG.stability) {
  const hx = fry.length / 2;
  const hy = fry.thickness / 2;
  const hz = fry.thickness / 2;
  let top = trayTopY;
  for (const b of bodies) {
    if (b.position.y < trayTopY - 1.5) continue;          // fell off the tray
    if (b.velocity.length() > cfg.settleSpeed) continue;   // still moving — not part of the resting stack
    const topY = b.position.y + upHalfExtent(b.quaternion, hx, hy, hz);
    if (topY > top) top = topY;
  }
  return Math.max(0, top - trayTopY);
}

// A body is "settled" when both its linear and angular speed are below the threshold.
export function isSettled(body, cfg = CONFIG.stability) {
  return body.velocity.length() < cfg.settleSpeed && body.angularVelocity.length() < cfg.settleSpeed;
}

// Count fries that have fallen below the tray (collapse signal).
export function fallenCount(bodies, trayTopY = 0) {
  let n = 0;
  for (const b of bodies) if (b.position.y < trayTopY - 1.5) n++;
  return n;
}
