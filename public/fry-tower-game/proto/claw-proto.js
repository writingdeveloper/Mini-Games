// Claw-feel prototype — validates grab / carry / slip / deliver with the existing IK hand.
// Reuses HandRig, CameraRig, makeFryMesh, Fry, CONFIG; adds a basket of physics fries,
// a constraint-based grip that SLIPS when carried too roughly, and a delivery tray.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../src/logic/config.js';
import { HandRig } from '../src/render/HandRig.js';
import { CameraRig } from '../src/render/CameraRig.js';
import { makeFryMesh } from '../src/render/fryMesh.js';
import { Fry } from '../src/entities/Fry.js';

// ---- Tunables (the point of the proto: find the right grab feel) ----
const GRAB_RADIUS = 0.9;    // how close the grip must be to a fry to grab it
const GRAB_MAXFORCE = 30;   // constraint pull strength (muscles the fry out of the pile + holds firm)
const SLIP_DIST = 1.2;      // sustained lag this far from the grip = slip (forgiving: only rough handling drops it)
const SLIP_GRACE = 0.18;    // must lag past SLIP_DIST for this long before it actually slips
const MOVE_SPEED = 3.2, LIFT_SPEED = 3.0;
const PIT = { x: 0, z: 0, half: 1.55, floorTop: 2.2 };
const TRAY = { x: 4.6, z: 0, half: 1.15, top: 2.2 };
const ROUND_SEC = 70;

// ---- Scene ----
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2c879);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9a6b33, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 1.25);
sun.position.set(6, 13, 7);
scene.add(sun);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const cameraRig = new CameraRig(camera);
cameraRig.target.set(2.1, 2.2, 0); // frame the pit (x0) + tray (x4.6)
const hand = new HandRig(scene);

// ---- Physics world ----
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
const fryMat = new CANNON.Material('fry');
const solidMat = new CANNON.Material('solid');
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, fryMat, { friction: 0.45, restitution: 0.03 }));
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, solidMat, { friction: 0.6, restitution: 0.02 }));

function staticBox(cx, cy, cz, hx, hy, hz, color) {
  const body = new CANNON.Body({ mass: 0, material: solidMat, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
  body.position.set(cx, cy, cz);
  world.addBody(body);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);
  return body;
}

// Basket (red) — floor + 4 low walls.
const R = 0xd0322f;
staticBox(PIT.x, PIT.floorTop - 0.2, PIT.z, PIT.half + 0.15, 0.2, PIT.half + 0.15, R);
staticBox(PIT.x + PIT.half, PIT.floorTop + 0.5, PIT.z, 0.12, 0.55, PIT.half, R);
staticBox(PIT.x - PIT.half, PIT.floorTop + 0.5, PIT.z, 0.12, 0.55, PIT.half, R);
staticBox(PIT.x, PIT.floorTop + 0.5, PIT.z + PIT.half, PIT.half, 0.55, 0.12, R);
staticBox(PIT.x, PIT.floorTop + 0.5, PIT.z - PIT.half, PIT.half, 0.55, 0.12, R);

// Delivery tray (green) — floor + low rims.
const G = 0x3fa14a;
staticBox(TRAY.x, TRAY.top - 0.2, TRAY.z, TRAY.half + 0.1, 0.2, TRAY.half + 0.1, G);
staticBox(TRAY.x + TRAY.half, TRAY.top + 0.18, TRAY.z, 0.1, 0.28, TRAY.half, G);
staticBox(TRAY.x - TRAY.half, TRAY.top + 0.18, TRAY.z, 0.1, 0.28, TRAY.half, G);
staticBox(TRAY.x, TRAY.top + 0.18, TRAY.z + TRAY.half, TRAY.half, 0.28, 0.1, G);
staticBox(TRAY.x, TRAY.top + 0.18, TRAY.z - TRAY.half, TRAY.half, 0.28, 0.1, G);

// Grip anchor — a kinematic body teleported to the hand's grip point each frame.
const anchor = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
world.addBody(anchor);

// ---- Fries in the basket ----
const fries = [];
function spawnFries(n) {
  for (let i = 0; i < n; i++) {
    const mesh = makeFryMesh();
    const body = makeFryBody(fryMat);
    body.position.set(
      PIT.x + (Math.random() - 0.5) * 1.8,
      PIT.floorTop + 0.6 + Math.random() * 2.4,
      PIT.z + (Math.random() - 0.5) * 1.8
    );
    body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    world.addBody(body);
    scene.add(mesh);
    const fry = new Fry(body, mesh);
    const r = Math.random();
    fry.value = r < 0.1 ? 5 : r < 0.32 ? 3 : 1; // special / golden / regular
    fry.delivered = false;
    fries.push(fry);
  }
}
function makeFryBody(mat) {
  const f = CONFIG.fry;
  const body = new CANNON.Body({
    mass: f.mass,
    material: mat,
    shape: new CANNON.Box(new CANNON.Vec3(f.length / 2, f.thickness / 2, f.thickness / 2)),
  });
  body.sleepSpeedLimit = 0.2;
  body.sleepTimeLimit = 0.4;
  return body;
}
spawnFries(20);

// ---- Input (inline) ----
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); act(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---- State ----
const handPos = new THREE.Vector3(PIT.x, 4.4, PIT.z); // wrist target (world space)
let grip = 0.2, gripClosed = false;
let held = null, constraint = null;
let slipT = 0; // how long the held fry has been lagging past SLIP_DIST
let score = 0, slips = 0;
let timeLeft = ROUND_SEC;
const gripPoint = new THREE.Vector3();

function act() {
  if (held) { release(); return; }
  // close grip + try to grab the nearest fry in range
  gripClosed = true;
  let best = null, bestD = GRAB_RADIUS;
  for (const f of fries) {
    if (f.delivered) continue;
    const p = f.body.position;
    const d = Math.hypot(gripPoint.x - p.x, gripPoint.y - p.y, gripPoint.z - p.z);
    if (d < bestD) { bestD = d; best = f; }
  }
  if (best) {
    best.body.wakeUp();
    const c = new CANNON.PointToPointConstraint(
      anchor, new CANNON.Vec3(0, 0, 0), best.body, new CANNON.Vec3(0, 0, 0), GRAB_MAXFORCE
    );
    world.addConstraint(c);
    held = best; constraint = c; slipT = 0;
  }
}
function release() {
  if (constraint) world.removeConstraint(constraint);
  constraint = null; held = null; gripClosed = false;
}
function slip() {
  if (constraint) world.removeConstraint(constraint);
  constraint = null; held = null; gripClosed = false; slips++;
}

function checkDeliveries() {
  for (const f of fries) {
    if (f.delivered || f === held) continue;
    const p = f.body.position;
    const inTray =
      Math.abs(p.x - TRAY.x) < TRAY.half &&
      Math.abs(p.z - TRAY.z) < TRAY.half &&
      p.y < TRAY.top + 0.7 && p.y > TRAY.top - 0.2;
    const settled = f.body.velocity.lengthSquared() < 0.6;
    if (inTray && settled) {
      f.delivered = true;
      score += f.value;
      world.removeBody(f.body);
      f.mesh.visible = false;
    }
  }
}

// ---- Loop ----
const elScore = document.getElementById('r-score');
const elHeld = document.getElementById('r-held');
const elSlip = document.getElementById('r-slip');
const elTime = document.getElementById('r-time');
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (timeLeft > 0) {
    // steer hand (world space)
    if (keys.ArrowLeft) handPos.x -= MOVE_SPEED * dt;
    if (keys.ArrowRight) handPos.x += MOVE_SPEED * dt;
    if (keys.ArrowUp) handPos.z -= MOVE_SPEED * dt;
    if (keys.ArrowDown) handPos.z += MOVE_SPEED * dt;
    if (keys.KeyW) handPos.y -= LIFT_SPEED * dt; // lower into the basket
    if (keys.KeyS) handPos.y += LIFT_SPEED * dt; // lift out
    handPos.x = THREE.MathUtils.clamp(handPos.x, -1.6, TRAY.x + 1.0);
    handPos.z = THREE.MathUtils.clamp(handPos.z, -1.8, 1.8);
    handPos.y = THREE.MathUtils.clamp(handPos.y, 2.5, 5.0);
    if (keys.BracketLeft) cameraRig.orbit(+CONFIG.camera.yawSpeed * dt);
    if (keys.BracketRight) cameraRig.orbit(-CONFIG.camera.yawSpeed * dt);
    timeLeft = Math.max(0, timeLeft - dt);
  }

  const azi = cameraRig.azimuth;
  hand.solve(handPos, azi);
  const gripTarget = gripClosed || held ? 0.92 : 0.2;
  grip += (gripTarget - grip) * (1 - Math.exp(-dt * 16));
  hand.setGrip(grip);
  hand.gripWorldPos(gripPoint);
  anchor.position.set(gripPoint.x, gripPoint.y, gripPoint.z);

  // slip check: a held fry that lags too far from the grip falls
  if (held) {
    const p = held.body.position;
    const d = Math.hypot(gripPoint.x - p.x, gripPoint.y - p.y, gripPoint.z - p.z);
    if (d > SLIP_DIST) { slipT += dt; if (slipT > SLIP_GRACE) slip(); }
    else slipT = Math.max(0, slipT - dt * 2); // recover quickly once back in the grip
  }

  world.step(1 / 60, dt, 3);
  for (const f of fries) if (!f.delivered) f.sync();
  checkDeliveries();
  cameraRig.update(dt);
  renderer.render(scene, camera);

  elScore.textContent = score;
  elHeld.textContent = held ? `${held.value}점짜리` : '-';
  elSlip.textContent = slips;
  elTime.textContent = Math.ceil(timeLeft);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose for the verify script.
window.__claw = {
  get score() { return score; },
  get slips() { return slips; },
  get held() { return !!held; },
  get fries() { return fries; },
  get handPos() { return handPos; },
  act,
  setHand(x, y, z) { handPos.set(x, y, z); },
};
