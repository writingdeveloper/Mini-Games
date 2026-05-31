export const CAR = {
  maxSpeed: 40, maxReverse: 12, accel: 26, rollFriction: 7, brakeFriction: 26,
  steerRate: 2.2, gripNormal: 7, gripHandbrake: 1.6, gravity: 32, launchMin: 10,
};

export function createCarState(x = 0, z = 0) {
  return { x, z, y: 0, heading: 0, velHeading: 0, speed: 0, vy: 0, airborne: false };
}

const approach = (val, target, rate, dt) => {
  if (val < target) return Math.min(target, val + rate * dt);
  return Math.max(target, val - rate * dt);
};
function rotateToward(a, target, maxStep) {
  let d = target - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

export function stepCar(state, input, dt, getGroundHeight) {
  const s = { ...state };
  const throttle = Math.max(-1, Math.min(1, input.throttle || 0));
  const steer = Math.max(-1, Math.min(1, input.steer || 0));

  if (s.airborne) {
    s.vy -= CAR.gravity * dt;
    s.y += s.vy * dt;
    s.x += Math.cos(s.velHeading) * s.speed * dt;
    s.z += Math.sin(s.velHeading) * s.speed * dt;
    const g = getGroundHeight(s.x, s.z);
    if (s.y <= g) { s.y = g; s.vy = 0; s.airborne = false; }
    return s;
  }

  // longitudinal
  if (throttle !== 0) s.speed += throttle * CAR.accel * dt;
  else s.speed = approach(s.speed, 0, CAR.rollFriction, dt);
  if (input.handbrake) s.speed = approach(s.speed, 0, CAR.brakeFriction, dt);
  s.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, s.speed));

  // steering scales with speed (sign-aware)
  const speedFactor = Math.min(1, Math.abs(s.speed) / 12);
  s.heading += steer * CAR.steerRate * speedFactor * dt * Math.sign(s.speed || 1);

  // grip: velocity direction chases facing; handbrake loosens it -> drift
  const grip = input.handbrake ? CAR.gripHandbrake : CAR.gripNormal;
  s.velHeading = rotateToward(s.velHeading, s.heading, grip * dt);

  // integrate position along motion direction
  s.x += Math.cos(s.velHeading) * s.speed * dt;
  s.z += Math.sin(s.velHeading) * s.speed * dt;

  // ground follow / launch
  const prevGround = state.y;
  const g = getGroundHeight(s.x, s.z);
  const dropRate = (prevGround - g) / dt; // how fast ground falls away
  if (Math.abs(s.speed) > CAR.launchMin && dropRate > CAR.launchMin) {
    s.airborne = true;
    s.vy = Math.min(dropRate, 22);
    s.y = prevGround;
  } else {
    s.y = g;
    s.vy = 0;
  }
  return s;
}
