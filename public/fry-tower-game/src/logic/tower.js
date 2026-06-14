import { CONFIG } from './config.js';

// Pure, cannon-free helpers over an array of physics bodies. A "body" only needs
// `{ position: {y}, velocity: {length()}, angularVelocity: {length()} }`, so these
// are unit-testable with plain mock objects.

// Tower height = highest SETTLED fry top above the tray. Fries that fell off the tray
// or are still in motion (mid-air / tumbling) are excluded, so the height reflects the
// resting stack only — a fry dropped at the buzzer can't inflate the score while falling.
export function towerHeight(bodies, trayTopY = 0, fry = CONFIG.fry, cfg = CONFIG.stability) {
  let top = trayTopY;
  for (const b of bodies) {
    if (b.position.y < trayTopY - 1.5) continue;          // fell off the tray
    if (b.velocity.length() > cfg.settleSpeed) continue;   // still moving — not part of the resting stack
    const topY = b.position.y + fry.thickness / 2;
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
