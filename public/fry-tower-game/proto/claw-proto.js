// Claw-feel prototype v3 — authentic crane game with the HAND as the claw.
// Commit aiming (lock X, then lock Z, then drop), a WEAK grip that drops off-center
// grabs on the way to a real CHUTE HOLE, an aim reticle, and juice (shake/pop/flash
// /sound). Reuses HandRig, CameraRig, makeFryMesh, Fry, CONFIG, AudioManager.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../src/logic/config.js';
import { HandRig } from '../src/render/HandRig.js';
import { CameraRig } from '../src/render/CameraRig.js';
import { makeFryMesh } from '../src/render/fryMesh.js';
import { Fry } from '../src/entities/Fry.js';
import { AudioManager } from '../src/audio/AudioManager.js';

// ---- Tunables (the crane feel) ----
const GRAB_RADIUS = 0.95;   // grip must be this close to grab
const GRAB_MAXFORCE = 15;   // base grip strength (scaled DOWN for off-center grabs)
const SLIP_DIST = 0.6;      // held prize lagging this far for SLIP_GRACE = drops
const SLIP_GRACE = 0.07;
const HOVER_Y = 5.0, PLUNGE_Y = 2.75;
const PLUNGE_SPEED = 3.4, LIFT_SPEED = 2.3, RETURN_SPEED = 2.4, AIM_SPEED = 2.6;
const CAB = { x: 0, z: 0, half: 1.55, floorTop: 2.2 };
const HOLE = { x: -1.0, z: -1.0, half: 0.62 }; // back-left chute hole
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
cameraRig.target.set(0, 2.5, 0);
const hand = new HandRig(scene);
const audio = new AudioManager();

// ---- Physics ----
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

// Cabinet base (red) under everything except the hole.
const RED = 0xd0322f;
staticBox(CAB.x, CAB.floorTop - 0.3, CAB.z, CAB.half + 0.18, 0.1, CAB.half + 0.18, 0x9a2420);
// Floor = two boxes leaving the back-left hole open (x<-0.4 & z<-0.4 uncovered).
staticBox(0.6, CAB.floorTop - 0.1, 0, 0.95, 0.1, CAB.half + 0.05, RED);          // right strip
staticBox(-0.93, CAB.floorTop - 0.1, 0.6, 0.62, 0.1, 0.95, RED);                 // left-front strip
// Glass walls + corner posts.
const wallY = CAB.floorTop + 1.1, wallH = 1.3;
staticBox(CAB.x + CAB.half, wallY, CAB.z, 0.08, wallH, CAB.half, 0x8fd3e8, 0.2);
staticBox(CAB.x - CAB.half, wallY, CAB.z, 0.08, wallH, CAB.half, 0x8fd3e8, 0.2);
staticBox(CAB.x, wallY, CAB.z + CAB.half, CAB.half, wallH, 0.08, 0x8fd3e8, 0.2);
staticBox(CAB.x, wallY, CAB.z - CAB.half, CAB.half, wallH, 0.08, 0x8fd3e8, 0.2);
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  staticBox(CAB.x + sx * CAB.half, wallY, CAB.z + sz * CAB.half, 0.1, wallH, 0.1, RED);
}
// Collection bin under the hole (delivered prizes drop through into it).
staticBox(HOLE.x, 0.5, HOLE.z, HOLE.half + 0.25, 0.1, HOLE.half + 0.25, 0x2a2a2a);
// Hole rim marker (dark ring at floor level).
const rim = new THREE.Mesh(
  new THREE.RingGeometry(HOLE.half * 0.7, HOLE.half + 0.18, 24),
  new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.DoubleSide })
);
rim.rotation.x = -Math.PI / 2;
rim.position.set(HOLE.x, CAB.floorTop + 0.02, HOLE.z);
scene.add(rim);

// Aim reticle — a ring on the floor under the claw.
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.28, 0.42, 24),
  new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
reticle.rotation.x = -Math.PI / 2;
scene.add(reticle);

const anchor = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
world.addBody(anchor);

// ---- Prizes ----
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
      CAB.z + (Math.random() - 0.5) * 1.4 + 0.3 // bias away from the hole corner
    );
    body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    world.addBody(body);
    scene.add(mesh);
    const fry = new Fry(body, mesh);
    const r = Math.random();
    fry.value = r < 0.1 ? 5 : r < 0.32 ? 3 : 1;
    fry.delivered = false;
    // High-value prizes glow so you can target them.
    if (fry.value > 1) {
      mesh.traverse((o) => {
        if (o.material && o.material.emissive) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(fry.value === 5 ? 0xffcc33 : 0xff7a1f);
          o.material.emissiveIntensity = fry.value === 5 ? 0.5 : 0.28;
        }
      });
    }
    fries.push(fry);
  }
}
spawnFries(16);

// ---- Juice (DOM + audio + shake) ----
const elFlash = document.getElementById('flash');
const elPop = document.getElementById('pop');
function flash() { if (!elFlash) return; elFlash.style.opacity = '1'; setTimeout(() => (elFlash.style.opacity = '0'), 120); }
function popScore(n) {
  if (!elPop) return;
  elPop.textContent = '+' + n;
  elPop.classList.remove('show'); void elPop.offsetWidth; elPop.classList.add('show');
}

// ---- Input: commit aiming ----
const keys = {};
let audioReady = false;
addEventListener('keydown', (e) => {
  if (!audioReady) { audio.init(); audio.resume(); audioReady = true; }
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); commitAim(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---- State ----
// aim_x -> aim_z -> plunge -> grab -> lift -> return -> drop -> aim_x
let state = 'aim_x', stateT = 0;
const handPos = new THREE.Vector3(HOLE.x, HOVER_Y, HOLE.z); // start at the chute/home corner
let grip = 0.2;
let held = null, constraint = null, slipT = 0;
let grabbedThisCycle = false; // one grab attempt per plunge
let score = 0, slips = 0, grabs = 0, attached = 0, deliveredCount = 0;
const gripPoint = new THREE.Vector3();

function commitAim() {
  if (state === 'aim_x') { state = 'aim_z'; stateT = 0; }
  else if (state === 'aim_z') { state = 'plunge'; stateT = 0; }
}
function startPlunge() { if (state === 'aim_x' || state === 'aim_z') { state = 'plunge'; stateT = 0; } }

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
    // Off-center grabs hold WEAKLY -> slip on the way. Centered = strong.
    const force = GRAB_MAXFORCE * (1 - 0.72 * (bestD / GRAB_RADIUS));
    const c = new CANNON.PointToPointConstraint(
      anchor, new CANNON.Vec3(0, 0, 0), best.body, new CANNON.Vec3(0, 0, 0), force
    );
    world.addConstraint(c);
    held = best; constraint = c; slipT = 0; attached++;
    if (audioReady) audio.grab();
  }
}
function releaseHeld() { if (constraint) world.removeConstraint(constraint); constraint = null; held = null; }
function slip() {
  releaseHeld(); slips++; slipT = 0;
  cameraRig.shake(0.32); flash();
  if (audioReady) audio.collapse();
}
// Delivered when the claw opens over the chute while still holding (slip already nulled held).
function deliverHeld() {
  if (!held) return;
  const f = held; releaseHeld();
  f.delivered = true; score += f.value; deliveredCount++;
  popScore(f.value); if (audioReady) audio.combo();
  world.removeBody(f.body); f.mesh.visible = false;
}
function approach(cur, target, speed, dt) {
  const d = target - cur, step = speed * dt;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
}

// ---- Loop ----
const elScore = document.getElementById('r-score');
const elHeld = document.getElementById('r-held');
const elSlip = document.getElementById('r-slip');
const elTime = document.getElementById('r-time');
const PHASE = { aim_x: '좌우 조준 ←→', aim_z: '앞뒤 조준 ↑↓', plunge: '내려가는 중', grab: '집는 중', lift: '올리는 중', return: '배출구로', drop: '떨굼' };
let timeLeft = ROUND_SEC, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  stateT += dt;
  if (timeLeft > 0) timeLeft = Math.max(0, timeLeft - dt);
  if (keys.BracketLeft) cameraRig.orbit(+CONFIG.camera.yawSpeed * dt);
  if (keys.BracketRight) cameraRig.orbit(-CONFIG.camera.yawSpeed * dt);

  if (state === 'aim_x') {
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
    if (timeLeft > 0) {
      if (keys.ArrowLeft) handPos.x -= AIM_SPEED * dt;
      if (keys.ArrowRight) handPos.x += AIM_SPEED * dt;
      handPos.x = THREE.MathUtils.clamp(handPos.x, CAB.x - CAB.half + 0.3, CAB.x + CAB.half - 0.3);
    }
  } else if (state === 'aim_z') {
    if (timeLeft > 0) {
      if (keys.ArrowUp) handPos.z -= AIM_SPEED * dt;
      if (keys.ArrowDown) handPos.z += AIM_SPEED * dt;
      handPos.z = THREE.MathUtils.clamp(handPos.z, CAB.z - CAB.half + 0.3, CAB.z + CAB.half - 0.3);
    }
  } else if (state === 'plunge') {
    handPos.y = approach(handPos.y, PLUNGE_Y, PLUNGE_SPEED, dt);
    if (handPos.y <= PLUNGE_Y + 0.01) { state = 'grab'; stateT = 0; grabbedThisCycle = false; if (audioReady) audio.place(); }
  } else if (state === 'grab') {
    if (stateT > 0.16 && !grabbedThisCycle) { tryGrab(); grabbedThisCycle = true; }
    if (stateT > 0.45) { state = 'lift'; stateT = 0; }
  } else if (state === 'lift') {
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
    if (handPos.y >= HOVER_Y - 0.01) { state = 'return'; stateT = 0; }
  } else if (state === 'return') {
    handPos.x = approach(handPos.x, HOLE.x, RETURN_SPEED, dt);
    handPos.z = approach(handPos.z, HOLE.z, RETURN_SPEED, dt);
    if (Math.abs(handPos.x - HOLE.x) < 0.02 && Math.abs(handPos.z - HOLE.z) < 0.02) { state = 'drop'; stateT = 0; }
  } else if (state === 'drop') {
    if (stateT > 0.2) deliverHeld(); // over the hole: if still held, it's delivered
    if (stateT > 0.7) { state = 'aim_x'; stateT = 0; }
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

  reticle.position.set(handPos.x, CAB.floorTop + 0.04, handPos.z);
  reticle.material.color.setHex(state === 'aim_x' ? 0xffe14a : state === 'aim_z' ? 0x4ad0ff : 0xaaaaaa);
  reticle.visible = state === 'aim_x' || state === 'aim_z';

  world.step(1 / 60, dt, 3);
  for (const f of fries) if (!f.delivered) f.sync();
  cameraRig.update(dt);
  renderer.render(scene, camera);

  elScore.textContent = score;
  elHeld.textContent = held ? `${held.value}점!` : PHASE[state] || '-';
  elSlip.textContent = slips;
  elTime.textContent = Math.ceil(timeLeft);
  if (elTime.parentElement) elTime.style.color = timeLeft <= 10 ? '#ff5a4a' : '#ffd479';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose for the verify script (bypasses the commit-aim keys).
window.__claw = {
  get score() { return score; }, get slips() { return slips; }, get grabs() { return grabs; },
  get held() { return !!held; }, get state() { return state; }, get handPos() { return handPos; },
  get attached() { return attached; }, get deliveredCount() { return deliveredCount; },
  drop() { startPlunge(); }, setHand(x, z) { handPos.x = x; handPos.z = z; },
};
