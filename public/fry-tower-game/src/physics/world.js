import * as CANNON from 'cannon-es';
import { CONFIG } from '../logic/config.js';

export function createPhysicsWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const fryMat = new CANNON.Material('fry');
  const trayMat = new CANNON.Material('tray');
  world.addContactMaterial(new CANNON.ContactMaterial(fryMat, fryMat, { friction: 0.5, restitution: 0.02 }));
  world.addContactMaterial(new CANNON.ContactMaterial(fryMat, trayMat, { friction: 0.7, restitution: 0.0 }));

  // Static tray (top surface at y = 0).
  const trayHalf = new CANNON.Vec3(3, 0.2, 3);
  const tray = new CANNON.Body({ mass: 0, material: trayMat, shape: new CANNON.Box(trayHalf) });
  tray.position.set(0, -0.2, 0);
  world.addBody(tray);

  return { world, fryMat, trayMat, trayTopY: 0 };
}

export function makeFryBody(fryMat, fry = CONFIG.fry) {
  const half = new CANNON.Vec3(fry.length / 2, fry.thickness / 2, fry.thickness / 2);
  const body = new CANNON.Body({ mass: fry.mass, material: fryMat, shape: new CANNON.Box(half) });
  body.sleepSpeedLimit = CONFIG.stability.settleSpeed;
  body.sleepTimeLimit = CONFIG.stability.settleTime;
  return body;
}

// Tower height = highest fry top above the tray, ignoring fries that fell off.
export function towerHeight(bodies, trayTopY = 0, fry = CONFIG.fry) {
  let top = trayTopY;
  for (const b of bodies) {
    if (b.position.y < trayTopY - 1.5) continue; // fell off the tray
    const topY = b.position.y + fry.thickness / 2;
    if (topY > top) top = topY;
  }
  return Math.max(0, top - trayTopY);
}

// A body is "settled" when its speed is below the stability threshold.
export function isSettled(body, cfg = CONFIG.stability) {
  return body.velocity.length() < cfg.settleSpeed && body.angularVelocity.length() < cfg.settleSpeed;
}

// Count fries that have fallen below the tray (collapse signal).
export function fallenCount(bodies, trayTopY = 0) {
  let n = 0;
  for (const b of bodies) if (b.position.y < trayTopY - 1.5) n++;
  return n;
}
