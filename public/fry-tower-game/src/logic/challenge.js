// Pure challenge math — no THREE / no physics. Unit tested.

// Per-body horizontal impulse magnitude for the height-scaled wobble (shear).
// Returns 0 while the tower is below the start height (calm early game);
// otherwise scales with the body's own height above the tray, capped.
export function wobbleImpulse(bodyHeight, towerHeight, cfg) {
  if (towerHeight < cfg.startHeight) return 0;
  const mag = Math.max(0, bodyHeight) * cfg.perMeter;
  return Math.min(mag, cfg.maxImpulse);
}
