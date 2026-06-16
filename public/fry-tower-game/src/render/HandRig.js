// HandRig — IK-driven articulated chef arm + toon hand.
// Port of public/fry-tower-game/proto/hand-proto.js, restructured into a
// reusable class. IK math delegated to logic/placement.js (pure functions).
// Mesh sizes, colors, and hand pose match the validated prototype exactly.

import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { solveElbow, clampToReach } from '../logic/placement.js';
import { toonMaterial, COLORS } from './materials.js';

const SKIN = 0xffc89b;   // toon skin tone
const SLEEVE = 0xe23434; // chef sleeve red

// Module-level constants / scratch vectors to avoid per-frame allocation.
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _elbowV = new THREE.Vector3();
const _wristV = new THREE.Vector3();
const _armUp = new THREE.Vector3();

// ---- Helpers (ported verbatim from proto/hand-proto.js) ----

// Toon fill mesh + inverted-hull outline matching the fry look.
function outlined(geo, color, scale = 1.1) {
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide }));
  o.scale.multiplyScalar(scale);
  g.add(o);
  g.add(new THREE.Mesh(geo, toonMaterial(color)));
  return g;
}

// A limb segment: tapered cylinder modelled along +Y, centred at origin.
function makeLimb(len, rTop, rBot, color) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, 14);
  return outlined(geo, color, 1.18);
}

// Orient a +Y-modelled object so it spans from → to, sitting at the midpoint.
function spanY(obj, from, to) {
  _dir.copy(to).sub(from);
  if (_dir.lengthSq() > 1e-8) {
    obj.quaternion.setFromUnitVectors(Y_AXIS, _dir.clone().normalize());
  }
  obj.position.copy(from).add(to).multiplyScalar(0.5);
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
    for (const f of fingers) {
      f.prox.rotation.x = -(0.15 + g * 0.95);
      f.dist.rotation.x = -(0.10 + g * 0.95);
    }
    tprox.rotation.x = -(0.10 + g * 0.7);
    tdist.rotation.x = -(0.05 + g * 0.7);
  }
  setGrip(0.8);
  return { group: hand, setGrip };
}

// ---- HandRig class ----

export class HandRig {
  constructor(scene) {
    const cfg = CONFIG.hand;

    // IK parameters read from config (no hardcoding).
    this.baseShoulder = new THREE.Vector3(cfg.shoulder.x, cfg.shoulder.y, cfg.shoulder.z);
    this.basePole = new THREE.Vector3(cfg.pole.x, cfg.pole.y, cfg.pole.z).normalize();
    this.L1 = cfg.upperLen;
    this.L2 = cfg.foreLen;
    this.maxReach = this.L1 + this.L2 - 0.05;

    // Working copies rotated by azimuth each solve() call.
    this._S = this.baseShoulder.clone();
    this._pole = this.basePole.clone();

    // Limb meshes.
    this.upper = makeLimb(this.L1, 0.30, 0.25, SLEEVE);
    this.fore = makeLimb(this.L2, 0.25, 0.21, SKIN);
    this.shoulder = outlined(new THREE.SphereGeometry(0.46, 16, 12), SLEEVE, 1.18);
    this.elbowJoint = outlined(new THREE.SphereGeometry(0.29, 14, 10), SKIN, 1.18);
    this.wristJoint = outlined(new THREE.SphereGeometry(0.24, 14, 10), SKIN, 1.18);

    // Place shoulder mesh at the base position (will be updated in solve()).
    this.shoulder.position.copy(this.baseShoulder);

    // Hand group + grip setter (from buildHand).
    const h = buildHand();
    this.hand = h.group;
    this._setGrip = h.setGrip;

    scene.add(this.upper, this.fore, this.shoulder, this.elbowJoint, this.wristJoint, this.hand);
  }

  // Solve IK and update all limb transforms.
  // azimuth = camera orbit yaw (radians).
  // worldTarget = THREE.Vector3 — desired wrist world position (e.g. hover above tower).
  solve(worldTarget, azimuth) {
    // Rotate shoulder anchor + pole around world Y by the camera azimuth so the
    // arm enters from the same screen side as the camera turns.
    this._S.copy(this.baseShoulder).applyAxisAngle(Y_AXIS, azimuth);
    this._pole.copy(this.basePole).applyAxisAngle(Y_AXIS, azimuth);

    // Update shoulder joint mesh position.
    this.shoulder.position.copy(this._S);

    // Clamp the target to arm reach (returns plain {x,y,z}).
    const wristRaw = clampToReach(this._S, worldTarget, this.maxReach);
    _wristV.set(wristRaw.x, wristRaw.y, wristRaw.z);

    // Solve IK for the elbow (returns plain {x,y,z}).
    const elbowRaw = solveElbow(this._S, _wristV, this.L1, this.L2, this._pole);
    _elbowV.set(elbowRaw.x, elbowRaw.y, elbowRaw.z);

    // Lay the two limbs along their solved bone axes.
    spanY(this.upper, this._S, _elbowV);
    spanY(this.fore, _elbowV, _wristV);

    // Position joint spheres.
    this.elbowJoint.position.copy(_elbowV);
    this.wristJoint.position.copy(_wristV);

    // Place the hand at the wrist.
    this.hand.position.copy(_wristV);

    // Orient the hand so its +Y axis points back up toward the elbow, which
    // naturally keeps the palm facing front and fingers reaching downward —
    // exactly matching the proto's hand orientation logic.
    _armUp.copy(_elbowV).sub(_wristV);
    if (_armUp.lengthSq() > 1e-6) {
      this.hand.quaternion.setFromUnitVectors(Y_AXIS, _armUp.normalize());
    }
  }

  // Curl the fingers. g in 0..1 (0 = open, 1 = fully gripped).
  setGrip(g) {
    this._setGrip(g);
  }

  // World position of the grip point (where the held fry sits in the fingers).
  // out must be a THREE.Vector3; it is filled in-place and returned.
  gripWorldPos(out) {
    out.set(0, -0.52, 0.30).applyQuaternion(this.hand.quaternion).add(this.hand.position);
    return out;
  }
}
