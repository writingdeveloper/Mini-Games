import * as CANNON from 'cannon-es';
import { CONFIG } from '../logic/config.js';

// Pure height/stability helpers live in logic/tower.js (cannon-free, unit-tested).
// Re-exported here so existing callers can keep importing them from the physics module.
export { towerHeight, isSettled, fallenCount } from '../logic/tower.js';

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

  return { world, fryMat, trayMat, trayBody: tray, trayTopY: 0 };
}

export function makeFryBody(fryMat, fry = CONFIG.fry) {
  const half = new CANNON.Vec3(fry.length / 2, fry.thickness / 2, fry.thickness / 2);
  const body = new CANNON.Body({ mass: fry.mass, material: fryMat, shape: new CANNON.Box(half) });
  body.sleepSpeedLimit = CONFIG.stability.settleSpeed;
  body.sleepTimeLimit = CONFIG.stability.settleTime;
  return body;
}
