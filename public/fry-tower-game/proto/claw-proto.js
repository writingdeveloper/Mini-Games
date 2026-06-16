// Claw-feel prototype v2 — AUTHENTIC crane-game flow with a HAND as the claw.
// Position the hand over the cabinet at the top, press Space: it auto-plunges,
// grips, lifts, returns to the chute corner, and drops. The grip is weak — a
// poorly-centered / heavy grab SLIPS on the way (the classic "dropped it!" drama).
// Reuses HandRig, CameraRig, makeFryMesh, Fry, CONFIG.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../src/logic/config.js';
import { HandRig } from '../src/render/HandRig.js';
import { CameraRig } from '../src/render/CameraRig.js';
import { makeFryMesh } from '../src/render/fryMesh.js';
import { Fry } from '../src/entities/Fry.js';

// ---- Tunables (find the crane-game feel) ----
const GRAB_RADIUS = 0.95;   // how close the grip must be to grab a prize
const GRAB_MAXFORCE = 26;   // grip pull strength
const SLIP_DIST = 1.0;      // held prize lagging this far for SLIP_GRACE = slips
const SLIP_GRACE = 0.16;
const HOVER_Y = 5.0;        // claw rest / positioning height (top of cabinet)
const PLUNGE_Y = 2.75;      // how deep the claw plunges
const PLUNGE_SPEED = 3.4, LIFT_SPEED = 2.8, RETURN_SPEED = 3.0, MOVE_SPEED = 3.0;
const CAB = { x: 0, z: 0, half: 1.55, floorTop: 2.2 };
const CHUTE = { x: -1.05, z: -1.05, half: 0.55 }; // back-left corner of the cabinet
const ROUND_SEC = 80;

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
cameraRig.target.set(0, 2.6, 0);
const hand = new HandRig(scene);

// ---- Physics world ----
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
const fryMat = new CANNON.Material('fry');
const solidMat = new CANNON.Material('solid');
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, fryMat, { friction: 0.45, restitution: 0.03 }));
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, solidMat, { friction: 0.6, restitution: 0.02 }));

function staticBox(cx, cy, cz, hx, hy, hz, color, opacity = 1) {
  const body = new CANNON.Body({ mass: 0, material: solidMat, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
  body.position.set(cx, cy, cz);
  world.addBody(body);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: opacity < 1, opacity })
  );
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);
  return body;
}

// Cabinet — red base/frame + tall glassy walls (the enclosed crane-game box).
const RED = 0xd0322f;
staticBox(CAB.x, CAB.floorTop - 0.2, CAB.z, CAB.half + 0.18, 0.2, CAB.half + 0.18, RED);
const wallY = CAB.floorTop + 1.1, wallH = 1.3;
staticBox(CAB.x + CAB.half, wallY, CAB.z, 0.08, wallH, CAB.half, 0x8fd3e8, 0.22);
staticBox(CAB.x - CAB.half, wallY, CAB.z, 0.08, wallH, CAB.half, 0x8fd3e8, 0.22);
staticBox(CAB.x, wallY, CAB.z + CAB.half, CAB.half, wallH, 0.08, 0x8fd3e8, 0.22);
staticBox(CAB.x, wallY, CAB.z - CAB.half, CAB.half, wallH, 0.08, 0x8fd3e8, 0.22);
// Corner posts (red frame).
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  staticBox(CAB.x + sx * CAB.half, wallY, CAB.z + sz * CAB.half, 0.12, wallH, 0.12, RED);
}
// Chute — a green pad in the back-left corner (drop a held prize here to deliver).
const chutePad = new THREE.Mesh(
  new THREE.BoxGeometry(CHUTE.half * 2, 0.06, CHUTE.half * 2),
  new THREE.MeshStandardMaterial({ color: 0x36b24a, roughness: 0.7 })
);
chutePad.position.set(CHUTE.x, CAB.floorTop + 0.02, CHUTE.z);
scene.add(chutePad);

// Grip anchor — kinematic body teleported to the grip point each frame.
const anchor = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
world.addBody(anchor);

// ---- Prizes (fries) in the cabinet ----
function makeFryBody(mat) {
  const f = CONFIG.fry;
  const body = new CANNON.Body({
    mass: f.mass, material: mat,
    shape: new CANNON.Box(new CANNON.Vec3(f.length / 2, f.thickness / 2, f.thickness / 2)),
  });
  body.sleepSpeedLimit = 0.2; body.sleepTimeLimit = 0.4;
  return body;
}
const fries = [];
function spawnFries(n) {
  for (let i = 0; i < n; i++) {
    const mesh = makeFryMesh();
    const body = makeFryBody(fryMat);
    body.position.set(
      CAB.x + (Math.random() - 0.5) * 1.4,
      CAB.floorTop + 0.7 + Math.random() * 1.9,
      CAB.z + (Math.random() - 0.5) * 1.4
    );
    body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    world.addBody(body);
    scene.add(mesh);
    const fry = new Fry(body, mesh);
    const r = Math.random();
    fry.value = r < 0.1 ? 5 : r < 0.32 ? 3 : 1;
    fry.delivered = false;
    fries.push(fry);
  }
}
spawnFries(16);

// ---- Input ----
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); dropClaw(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---- State machine ----
// idle -> plunge -> grab -> lift -> return -> drop -> idle
let state = 'idle';
let stateT = 0;
const handPos = new THREE.Vector3(CAB.x, HOVER_Y, CAB.z);
let grip = 0.2;
let held = null, constraint = null, slipT = 0;
let score = 0, slips = 0, grabs = 0;
const gripPoint = new THREE.Vector3();

function dropClaw() { if (state === 'idle') { state = 'plunge'; stateT = 0; } }

function tryGrab() {
  grabs++;
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
function releaseHeld() {
  if (constraint) world.removeConstraint(constraint);
  constraint = null; held = null;
}
function slip() { releaseHeld(); slips++; }
function approach(cur, target, speed, dt) {
  const d = target - cur;
  const step = speed * dt;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
}

function checkDeliveries() {
  for (const f of fries) {
    if (f.delivered || f === held) continue;
    const p = f.body.position;
    const inChute =
      Math.abs(p.x - CHUTE.x) < CHUTE.half + 0.2 &&
      Math.abs(p.z - CHUTE.z) < CHUTE.half + 0.2 &&
      p.y < CAB.floorTop + 0.7;
    if (inChute && f.body.velocity.lengthSquared() < 0.8) {
      f.delivered = true; score += f.value;
      world.removeBody(f.body); f.mesh.visible = false;
    }
  }
}

// ---- Loop ----
const elScore = document.getElementById('r-score');
const elHeld = document.getElementById('r-held');
const elSlip = document.getElementById('r-slip');
const elTime = document.getElementById('r-time');
let timeLeft = ROUND_SEC, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  stateT += dt;

  if (timeLeft > 0) timeLeft = Math.max(0, timeLeft - dt);
  if (keys.BracketLeft) cameraRig.orbit(+CONFIG.camera.yawSpeed * dt);
  if (keys.BracketRight) cameraRig.orbit(-CONFIG.camera.yawSpeed * dt);

  // --- crane state machine ---
  if (state === 'idle') {
    if (timeLeft > 0) {
      if (keys.ArrowLeft) handPos.x -= MOVE_SPEED * dt;
      if (keys.ArrowRight) handPos.x += MOVE_SPEED * dt;
      if (keys.ArrowUp) handPos.z -= MOVE_SPEED * dt;
      if (keys.ArrowDown) handPos.z += MOVE_SPEED * dt;
      handPos.x = THREE.MathUtils.clamp(handPos.x, CAB.x - CAB.half + 0.3, CAB.x + CAB.half - 0.3);
      handPos.z = THREE.MathUtils.clamp(handPos.z, CAB.z - CAB.half + 0.3, CAB.z + CAB.half - 0.3);
    }
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
  } else if (state === 'plunge') {
    handPos.y = approach(handPos.y, PLUNGE_Y, PLUNGE_SPEED, dt);
    if (handPos.y <= PLUNGE_Y + 0.01) { state = 'grab'; stateT = 0; }
  } else if (state === 'grab') {
    if (stateT > 0.18 && !held) { tryGrab(); }
    if (stateT > 0.45) { state = 'lift'; stateT = 0; }
  } else if (state === 'lift') {
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
    if (handPos.y >= HOVER_Y - 0.01) { state = 'return'; stateT = 0; }
  } else if (state === 'return') {
    handPos.x = approach(handPos.x, CHUTE.x, RETURN_SPEED, dt);
    handPos.z = approach(handPos.z, CHUTE.z, RETURN_SPEED, dt);
    if (Math.abs(handPos.x - CHUTE.x) < 0.02 && Math.abs(handPos.z - CHUTE.z) < 0.02) { state = 'drop'; stateT = 0; }
  } else if (state === 'drop') {
    if (stateT > 0.25) { releaseHeld(); }
    if (stateT > 0.7) { state = 'idle'; stateT = 0; }
  }

  const grabbing = state === 'grab' || state === 'lift' || state === 'return';
  const azi = cameraRig.azimuth;
  hand.solve(handPos, azi);
  grip += ((grabbing ? 0.95 : 0.2) - grip) * (1 - Math.exp(-dt * 16));
  hand.setGrip(grip);
  hand.gripWorldPos(gripPoint);
  anchor.position.set(gripPoint.x, gripPoint.y, gripPoint.z);

  if (held) {
    const p = held.body.position;
    const d = Math.hypot(gripPoint.x - p.x, gripPoint.y - p.y, gripPoint.z - p.z);
    if (d > SLIP_DIST) { slipT += dt; if (slipT > SLIP_GRACE) slip(); }
    else slipT = Math.max(0, slipT - dt * 2);
  }

  world.step(1 / 60, dt, 3);
  for (const f of fries) if (!f.delivered) f.sync();
  checkDeliveries();
  cameraRig.update(dt);
  renderer.render(scene, camera);

  elScore.textContent = score;
  elHeld.textContent = held ? `${held.value}점짜리` : state === 'idle' ? '-' : `(${state})`;
  elSlip.textContent = slips;
  elTime.textContent = Math.ceil(timeLeft);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose for the verify script.
window.__claw = {
  get score() { return score; }, get slips() { return slips; }, get grabs() { return grabs; },
  get held() { return !!held; }, get state() { return state; }, get handPos() { return handPos; },
  drop: dropClaw, setHand(x, z) { handPos.x = x; handPos.z = z; },
};
