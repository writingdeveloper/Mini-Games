// Fryffel Tower — hand-control PROTOTYPE (spike).
// Validates the core feel: a natural, IK-driven chef hand reaches, grips a fry,
// and places it with momentum. Reuses the shipped game's render/physics so the
// look stays consistent. NOT wired into the real game — separate page on purpose.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Game } from '../src/core/Game.js';
import { Stage } from '../src/render/Stage.js';
import { toonMaterial, COLORS } from '../src/render/materials.js';
import { makeFryMesh } from '../src/render/fryMesh.js';
import { createPhysicsWorld, makeFryBody } from '../src/physics/world.js';
import { Fry } from '../src/entities/Fry.js';
import { CONFIG } from '../src/logic/config.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SKIN = 0xffc89b;     // toon skin tone (kept in the game's bright palette)
const SLEEVE = 0xe23434;   // chef sleeve (matches the tray red)
const OUTLINE = COLORS.outline;
const HALF_THK = CONFIG.fry.thickness / 2;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ---- Photo-based fry (shape + colour derived from the reference image) ----
// A long, slightly drooped, tapered rounded bar; vertex-coloured for a golden
// body, crisper top edge and pale "cut" ends. Toon + outline keeps it in the
// game's look, and being a real 3D mesh it reads from every camera angle.
let _fryVariants = null, _fryFill = null, _fryOutline = null, _grad = null;
function stepGrad() {
  if (_grad) return _grad;
  const data = new Uint8Array([60, 115, 175, 230]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.needsUpdate = true;
  return _grad;
}

// Build ONE irregular fry: randomized length/thickness/curve/taper + surface
// wobble, vertex-coloured with a varied golden body, crispy top/blotches and
// pale cut ends. Each variant is a distinct geometry so a pile looks natural.
function buildFryVariant(rng) {
  const L = 1.42 + rng() * 0.46, T = 0.22 + rng() * 0.06, r = Math.min(0.08, T * 0.34), half = L / 2;
  const geo = new RoundedBoxGeometry(L, T, T, 4, r);
  const pos = geo.attributes.position;
  const banana = (rng() - 0.5) * 0.40;            // up/down curve
  const side = (rng() - 0.5) * 0.34;              // sideways curve
  const sAmp = rng() < 0.45 ? (rng() - 0.5) * 0.16 : 0; // occasional S-bend
  const taper = 0.12 + rng() * 0.20;
  const wob = 0.010 + rng() * 0.014;
  const tone = new THREE.Color().lerpColors(new THREE.Color(0xdf9a22), new THREE.Color(0xb06c0d), rng());
  const pale = new THREE.Color(0xddb46a), crisp = new THREE.Color(0x8a4c08), deep = new THREE.Color(0x5d3304);
  const freq = 3.5 + rng() * 4, phase = rng() * 6.28;
  const v = new THREE.Vector3(), c = new THREE.Color();
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp(v.x / half, -1, 1);
    const tp = 1 - taper * t * t;
    let y = v.y * tp, z = v.z * tp;
    y += banana * (t * t - 0.33);
    z += side * (t * t) + sAmp * Math.sin(t * Math.PI);
    y += (rng() - 0.5) * wob; z += (rng() - 0.5) * wob;
    pos.setXYZ(i, v.x, y, z);
    c.copy(tone);
    c.lerp(pale, THREE.MathUtils.smoothstep(Math.abs(t), 0.60, 1.0) * 0.65);  // pale cut ends
    if (v.y > 0) c.lerp(crisp, 0.42 * (v.y / (T / 2)));                        // crispy top
    const blot = 0.5 + 0.5 * Math.sin(v.x * freq + phase) * Math.cos(v.z * 6 + phase);
    c.lerp(crisp, blot * 0.22);                                               // uneven frying
    if (rng() < 0.06) c.lerp(deep, 0.55);                                     // crispy speck
    colors.push(c.r, c.g, c.b);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

function fryAssets() {
  if (_fryVariants) return;
  let s = 0x9e3779b1 >>> 0;                         // tiny LCG: stable variety per load
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  _fryVariants = [];
  for (let i = 0; i < 7; i++) _fryVariants.push(buildFryVariant(rng));
  _fryFill = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: stepGrad() });
  _fryOutline = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
}

function makeProtoFry() {
  fryAssets();
  const geo = _fryVariants[(Math.random() * _fryVariants.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, _fryOutline);
  o.scale.multiplyScalar(1.07);
  g.add(o);
  g.add(new THREE.Mesh(geo, _fryFill));
  return g;
}

// A toon part = fill mesh + inverted-hull outline, matching the fry look.
function outlined(geo, color, scale = 1.1) {
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide }));
  o.scale.multiplyScalar(scale);
  g.add(o);
  g.add(new THREE.Mesh(geo, toonMaterial(color)));
  return g;
}

// A limb segment: a tapered cylinder modelled along +Y, centred at origin.
function makeLimb(len, rTop, rBot, color) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, 14);
  return outlined(geo, color, 1.18);
}

// Orient a +Y-modelled mesh so it spans from -> to, sitting at the midpoint.
function spanY(obj, from, to) {
  const dir = to.clone().sub(from);
  if (dir.lengthSq() > 1e-8) obj.quaternion.setFromUnitVectors(Y_AXIS, dir.clone().normalize());
  obj.position.copy(from).add(to).multiplyScalar(0.5);
}

// Analytic 2-bone IK: returns the elbow position so |S-elbow|=L1 and |elbow-T|=L2.
// `pole` biases which way the elbow bulges (keeps the bend looking natural).
function solveElbow(S, T, L1, L2, pole) {
  const to = T.clone().sub(S);
  let d = to.length();
  d = THREE.MathUtils.clamp(d, Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.05);
  const dir = to.lengthSq() > 1e-8 ? to.clone().normalize() : new THREE.Vector3(0, -1, 0);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y));
  perp.normalize();
  return S.clone().add(dir.multiplyScalar(a)).add(perp.multiplyScalar(h));
}

// Build a natural-proportion toon hand in a "reaching down" pose:
//   +Y = wrist (toward forearm),  -Y = fingers hang down,
//   +Z = back of hand (toward camera),  -Z = palm (toward tower).
// Fingers curl forward (+Z) via setGrip(0..1) to cup the fry on the camera side.
function buildHand() {
  const hand = new THREE.Group();
  hand.add(outlined(new THREE.BoxGeometry(0.95, 0.55, 0.34), SKIN, 1.14)); // palm
  const wristNub = outlined(new THREE.CylinderGeometry(0.24, 0.27, 0.32, 12), SKIN, 1.16);
  wristNub.position.set(0, 0.36, 0);
  hand.add(wristNub);

  const fingers = [];
  const xs = [-0.33, -0.11, 0.11, 0.33];
  const lens = [[0.40, 0.32], [0.46, 0.36], [0.42, 0.34], [0.34, 0.27]];
  xs.forEach((x, i) => {
    const [lp, ld] = lens[i];
    const prox = new THREE.Object3D();
    prox.position.set(x, -0.27, 0.02);
    const pm = outlined(new THREE.BoxGeometry(0.17, lp, 0.17), SKIN, 1.16);
    pm.position.set(0, -lp / 2, 0);
    prox.add(pm);
    const dist = new THREE.Object3D();
    dist.position.set(0, -lp, 0);
    const dm = outlined(new THREE.BoxGeometry(0.15, ld, 0.15), SKIN, 1.16);
    dm.position.set(0, -ld / 2, 0);
    dist.add(dm);
    prox.add(dist);
    hand.add(prox);
    fingers.push({ prox, dist });
  });

  // Thumb on the -X side, angled across the palm.
  const tprox = new THREE.Object3D();
  tprox.position.set(-0.47, -0.04, 0.07);
  tprox.rotation.z = -0.7;
  const tpm = outlined(new THREE.BoxGeometry(0.18, 0.34, 0.18), SKIN, 1.16);
  tpm.position.set(0, -0.17, 0);
  tprox.add(tpm);
  const tdist = new THREE.Object3D();
  tdist.position.set(0, -0.34, 0);
  const tdm = outlined(new THREE.BoxGeometry(0.16, 0.27, 0.16), SKIN, 1.16);
  tdm.position.set(0, -0.135, 0);
  tdist.add(tdm);
  tprox.add(tdist);
  hand.add(tprox);

  function setGrip(g) {
    // Negative X-rotation swings the -Y fingers toward +Z (cupping the fry).
    for (const f of fingers) { f.prox.rotation.x = -(0.15 + g * 0.95); f.dist.rotation.x = -(0.10 + g * 0.95); }
    tprox.rotation.x = -(0.10 + g * 0.7);
    tdist.rotation.x = -(0.05 + g * 0.7);
  }
  setGrip(0.8);
  return { group: hand, setGrip };
}

class HandProto {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const phys = createPhysicsWorld();
    this.world = phys.world;
    this.fryMat = phys.fryMat;
    this.trayTopY = phys.trayTopY;

    // Arm anchor (shoulder) — comes in from upper front-right, like a chef reaching
    // over. Stored as a base offset that gets rotated by the camera azimuth each
    // frame, so the arm follows the camera instead of staying world-locked.
    this.baseShoulder = new THREE.Vector3(3.0, 8.8, 1.2);
    this.basePole = new THREE.Vector3(0.25, 1, 0.35).normalize();
    this.S = this.baseShoulder.clone();
    this.pole = this.basePole.clone();
    this.L1 = 4.4; this.L2 = 4.3;
    this.maxReach = this.L1 + this.L2 - 0.05;

    // Limbs + joints.
    this.upper = makeLimb(this.L1, 0.30, 0.25, SLEEVE);
    this.fore = makeLimb(this.L2, 0.25, 0.21, SKIN);
    this.shoulder = outlined(new THREE.SphereGeometry(0.46, 16, 12), SLEEVE, 1.18);
    this.elbowJoint = outlined(new THREE.SphereGeometry(0.29, 14, 10), SKIN, 1.18);
    this.wristJoint = outlined(new THREE.SphereGeometry(0.24, 14, 10), SKIN, 1.18);
    this.shoulder.position.copy(this.S);
    const h = buildHand();
    this.hand = h.group;
    this.setGrip = h.setGrip;
    scene.add(this.upper, this.fore, this.shoulder, this.elbowJoint, this.wristJoint, this.hand);

    // Aim / control state.
    this.aimX = 0;
    this.aimZ = 0;          // depth (front/back) placement
    this.heightOff = 0;
    this.yaw = 0;           // fry spin around vertical axis (crisscross)
    this.tilt = 0;          // fry lean (pitch)
    this.assist = false;
    this.smooth = new THREE.Vector3(0, 3, 0); // smoothed wrist target
    this.grip = 0.85;

    // Camera orbit — lets you read the 3D structure from different sides.
    this.camYaw = 0.16;
    this.camTarget = new THREE.Vector3(0, 2.5, 0);

    // Held fry + placed fries.
    this.held = null;
    this.placed = [];
    this.gripPos = new THREE.Vector3();
    this.prevGrip = new THREE.Vector3();
    this.handVel = new THREE.Vector3();
    this.lastSpeed = 0;
    this.respawn = 0;
    this._primed = false;

    this._spawnHeld();
    this._initInput();
    this._readout();
  }

  _spawnHeld() {
    this.held = makeProtoFry();
    this.scene.add(this.held);
  }

  // World position of the grip (in front of the fingers) given the hand transform.
  _computeGrip(out) {
    out.set(0, -0.52, 0.30).applyQuaternion(this.hand.quaternion).add(this.hand.position);
    return out;
  }

  _initInput() {
    this.keys = {};
    const set = (e, down) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      if (k === ' ' && down && !this._spaceLatch) { this._release(); this._spaceLatch = true; }
      if (k === ' ' && !down) this._spaceLatch = false;
      if (k === 'a' && down) { this.assist = !this.assist; this._readout(); }
      if (k === 'r' && down) this._reset();
      this.keys[k] = down;
    };
    window.addEventListener('keydown', (e) => set(e, true));
    window.addEventListener('keyup', (e) => set(e, false));

    // Pointer: horizontal drag -> X, vertical drag -> Z (depth), tap -> place.
    const canvas = document.getElementById('game');
    let active = false, sx = 0, sy = 0, t0 = 0, moved = 0;
    canvas.addEventListener('pointerdown', (e) => { active = true; sx = e.clientX; sy = e.clientY; t0 = Date.now(); moved = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      moved += Math.abs(dx) + Math.abs(dy);
      this.aimX = THREE.MathUtils.clamp(this.aimX + dx * 0.012, -2.2, 2.2);
      this.aimZ = THREE.MathUtils.clamp(this.aimZ + dy * 0.012, -2.2, 2.2);
      sx = e.clientX; sy = e.clientY;
    });
    const up = () => { if (!active) return; active = false; if (moved < 10 && Date.now() - t0 < 250) this._release(); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { active = false; });
  }

  _release() {
    if (!this.held) return;
    const body = makeFryBody(this.fryMat);
    body.position.set(this.gripPos.x, this.gripPos.y, this.gripPos.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.tilt, this.yaw + this.camYaw, 0, 'YXZ'));
    body.quaternion.set(q.x, q.y, q.z, q.w);
    const v = this.handVel.clone();
    if (this.assist) v.multiplyScalar(0.18);
    v.clampLength(0, 7);
    v.y = Math.min(v.y, 0.5);
    body.velocity.set(v.x, v.y, v.z);
    this.world.addBody(body);
    this.placed.push(new Fry(body, this.held));
    this.lastSpeed = v.length();
    this.held = null;
    this.respawn = 0.55;
    this._readout();
  }

  _reset() {
    for (const f of this.placed) { this.scene.remove(f.mesh); this.world.removeBody(f.body); }
    this.placed = [];
    if (this.held) { this.scene.remove(this.held); this.held = null; }
    this.aimX = 0; this.aimZ = 0; this.heightOff = 0; this.yaw = 0; this.tilt = 0; this.respawn = 0;
    this._spawnHeld();
    this._readout();
  }

  _towerTop() {
    let top = this.trayTopY;
    for (const f of this.placed) top = Math.max(top, f.body.position.y + HALF_THK);
    return top;
  }

  _readout() {
    const c = document.getElementById('r-count');
    const s = document.getElementById('r-speed');
    const a = document.getElementById('r-assist');
    if (c) c.textContent = String(this.placed.length);
    if (s) s.textContent = this.lastSpeed.toFixed(1);
    if (a) a.textContent = this.assist ? 'ON' : 'OFF';
  }

  update(dt) {
    if (dt <= 0) return;
    // Input -> aim (hand glides over the tray in X and Z; rotates in 3D).
    const mv = 3.2 * dt;
    if (this.keys['arrowleft']) this.aimX -= mv;
    if (this.keys['arrowright']) this.aimX += mv;
    if (this.keys['arrowup']) this.aimZ -= mv;     // away, into the screen
    if (this.keys['arrowdown']) this.aimZ += mv;   // toward the camera
    this.aimX = THREE.MathUtils.clamp(this.aimX, -2.2, 2.2);
    this.aimZ = THREE.MathUtils.clamp(this.aimZ, -2.2, 2.2);
    if (this.keys['w']) this.heightOff += 2.4 * dt;
    if (this.keys['s']) this.heightOff -= 2.4 * dt;
    this.heightOff = THREE.MathUtils.clamp(this.heightOff, -0.6, 3.5);
    if (this.keys['q']) this.yaw += 2.4 * dt;       // spin long axis (crisscross)
    if (this.keys['e']) this.yaw -= 2.4 * dt;
    if (this.keys['z']) this.tilt += 1.8 * dt;      // lean forward
    if (this.keys['x']) this.tilt -= 1.8 * dt;      // lean back
    this.tilt = THREE.MathUtils.clamp(this.tilt, -0.9, 0.9);
    if (this.keys['[']) this.camYaw += 1.2 * dt;    // orbit camera
    if (this.keys[']']) this.camYaw -= 1.2 * dt;
    this.camYaw = THREE.MathUtils.clamp(this.camYaw, -0.7, 0.9);

    // The arm rig + placement frame share the camera azimuth, so the arm always
    // reaches in from the same on-screen side as you orbit.
    const azi = this.camYaw;
    this.S.copy(this.baseShoulder).applyAxisAngle(Y_AXIS, azi);
    this.pole.copy(this.basePole).applyAxisAngle(Y_AXIS, azi);
    this.shoulder.position.copy(this.S);

    // Desired wrist target above the current tower, clamped to arm reach.
    const hoverY = THREE.MathUtils.clamp(this._towerTop() + 1.4 + this.heightOff, 1.2, 7.8);
    const local = new THREE.Vector3(this.aimX, 0, this.aimZ).applyAxisAngle(Y_AXIS, azi);
    const desired = new THREE.Vector3(local.x, hoverY, local.z);
    const k = 1 - Math.exp(-dt * 9);
    this.smooth.lerp(desired, k);
    const to = this.smooth.clone().sub(this.S);
    const wrist = to.length() > this.maxReach ? this.S.clone().add(to.normalize().multiplyScalar(this.maxReach)) : this.smooth.clone();

    // IK + place limbs.
    const elbow = solveElbow(this.S, wrist, this.L1, this.L2, this.pole);
    spanY(this.upper, this.S, elbow);
    spanY(this.fore, elbow, wrist);
    this.elbowJoint.position.copy(elbow);
    this.wristJoint.position.copy(wrist);
    this.hand.position.copy(wrist);
    // Hand hangs off the forearm: its +Y axis points back up toward the elbow.
    const armUp = elbow.clone().sub(wrist);
    if (armUp.lengthSq() > 1e-6) this.hand.quaternion.setFromUnitVectors(Y_AXIS, armUp.normalize());

    // Grip transform + momentum (velocity the released fry inherits).
    this._computeGrip(this.gripPos);
    if (!this._primed) { this.prevGrip.copy(this.gripPos); this._primed = true; }
    // Don't count camera-orbit motion as a throw — only real hand motion is momentum.
    const orbiting = this.keys['['] || this.keys[']'];
    const inst = orbiting ? new THREE.Vector3() : this.gripPos.clone().sub(this.prevGrip).multiplyScalar(1 / dt);
    this.handVel.lerp(inst, 0.5);
    this.prevGrip.copy(this.gripPos);

    // Held fry follows the grip; fingers grip/open.
    if (this.held) {
      this.held.position.copy(this.gripPos);
      this.held.quaternion.setFromEuler(new THREE.Euler(this.tilt, this.yaw + azi, 0, 'YXZ'));
    }
    const gripTarget = this.held ? 0.85 : (this.respawn > 0 ? 0.2 : 0.85);
    this.grip += (gripTarget - this.grip) * (1 - Math.exp(-dt * 14));
    this.setGrip(this.grip);

    // Respawn next fry after a release beat.
    if (this.respawn > 0) { this.respawn -= dt; if (this.respawn <= 0 && !this.held) this._spawnHeld(); }

    // Physics + sync + cull.
    this.world.step(1 / 60, dt, 3);
    for (const f of this.placed) f.sync();
    for (let i = this.placed.length - 1; i >= 0; i--) {
      if (this.placed[i].body.position.y < -4) {
        this.scene.remove(this.placed[i].mesh);
        this.world.removeBody(this.placed[i].body);
        this.placed.splice(i, 1);
        this._readout();
      }
    }
    // Live speed readout while holding (so you can feel the whip before releasing).
    if (this.held) { const c = document.getElementById('r-speed'); if (c) c.textContent = this.handVel.length().toFixed(1); }
    const rr = document.getElementById('r-rot');
    if (rr) rr.textContent = Math.round(THREE.MathUtils.radToDeg(this.yaw)) + '° / ' + Math.round(THREE.MathUtils.radToDeg(this.tilt)) + '°';

    // Orbit camera so the depth / 3D structure reads on screen.
    const R = 10.4, Hc = 6.7;
    this.camera.position.set(Math.sin(this.camYaw) * R, Hc, Math.cos(this.camYaw) * R);
    this.camera.lookAt(this.camTarget);
  }
}

function main() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  game.add(new Stage(game.scene));
  game.add(new HandProto(game.scene, game.camera));
  game.start();
}

main();
