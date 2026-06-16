export const CONFIG = {
  round: { duration: 90 },                  // seconds per round
  fry: { length: 1.6, thickness: 0.18, mass: 0.2, variants: 7 },
  spawn: { y: 9, xRange: 2.4 },             // active fry hover height + max horizontal travel
  scoring: { perMeter: 100, stableBonus: 25, comboStep: 10, timeBonus: 2 },
  combo: { chargePerStable: 1, max: 10 },
  sabotage: { grantCost: 3 },
  stability: { settleSpeed: 0.25, settleTime: 0.6 }, // body considered "stable" below this speed for this long

  // ---- hand-overhaul (Phase A) ----
  // Chef-arm rig: shoulder anchor + two-bone lengths + IK pole hint (see render/HandRig.js).
  hand: { shoulder: { x: 3.0, y: 8.8, z: 1.2 }, upperLen: 4.4, foreLen: 4.3, pole: { x: 0.25, y: 1, z: 0.35 } },
  // 3D placement envelope + steering/smoothing speeds for the hand-controlled fry.
  placement: {
    xRange: 2.2, zRange: 2.2, hoverGap: 1.4,
    heightOffMin: -0.6, heightOffMax: 3.5, hoverYMin: 1.2, hoverYMax: 7.8,
    moveSpeed: 3.2, yawSpeed: 2.4, tiltSpeed: 1.8, tiltMax: 0.9, heightSpeed: 2.4, smoothK: 9,
    respawnBeat: 0.5, // pause after release while the hand opens + grabs a fresh fry
  },
  // Released fry inherits the hand's recent velocity (skill); assist damps it for precision.
  momentum: { smooth: 0.5, max: 7, assistScale: 0.18, upClamp: 0.5 },
  // Orbit camera: radius/height, look target, and yaw orbit limits/speed.
  camera: { radius: 10.4, height: 6.7, targetY: 2.5, yawSpeed: 1.2, yawMin: -0.7, yawMax: 0.9, startYaw: 0.16 },
};
