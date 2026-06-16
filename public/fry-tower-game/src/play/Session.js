import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../logic/config.js';
import { createPhysicsWorld, makeFryBody, towerHeight, isSettled, fallenCount } from '../physics/world.js';
import { makeFryMesh } from '../render/fryMesh.js';
import { HandRig } from '../render/HandRig.js';
import { Fry } from '../entities/Fry.js';
import { createRound, tickRound, isOver } from '../logic/round.js';
import { createCombo, onStablePlacement, onCollapse } from '../logic/combo.js';
import { roundScore } from '../logic/scoring.js';
import { releaseVelocity } from '../logic/placement.js';

// Module-level constant + scratch vectors (avoid per-frame allocation).
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _desired = new THREE.Vector3();
const _gripNow = new THREE.Vector3();
const _inst = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _euler = new THREE.Euler();
const GRIP_CLOSED = 0.85; // fingers cupping a held fry
const GRIP_OPEN = 0.2;    // fingers spread to release, during the respawn beat

// Owns the cannon world, the IK chef hand + held fry, placed fries, and pure-logic state.
// The fry is steered in 3D (x/z/yaw/tilt/height) and released with the hand's momentum.
export class Session {
  constructor(scene, { onEnd, fx, audio, cameraRig } = {}) {
    this.scene = scene;
    this.onEnd = onEnd || (() => {});
    this.fx = fx || null;
    this.audio = audio || null;
    this.cameraRig = cameraRig || null;
    const phys = createPhysicsWorld();
    this.world = phys.world;
    this.fryMat = phys.fryMat;
    this.trayTopY = phys.trayTopY;
    this._trayBody = phys.trayBody;

    this.placed = [];          // Fry[] released
    this.bodies = [];          // CANNON.Body[] released (for height)
    this.round = createRound();
    this.combo = createCombo();
    this.score = 0;
    this.stableCount = 0;
    this._pendingSettle = [];  // bodies awaiting settle check

    // ---- Hand rig + held-fry steering state (ported from proto/hand-proto.js) ----
    this.hand = new HandRig(scene);
    this.aimX = 0;             // X placement (left/right)
    this.aimZ = 0;             // Z placement (depth, front/back)
    this.heightOff = 0;        // manual height nudge above the tower
    this.yaw = 0;             // fry spin around vertical axis (crisscross)
    this.tilt = 0;             // fry lean (pitch)
    this.grip = GRIP_CLOSED;   // finger curl (0 open .. 1 gripped)
    this.assist = false;       // damps release momentum for precision
    this.azimuth = CONFIG.camera.startYaw; // camera orbit yaw; set each frame by main
    this.handVel = new THREE.Vector3();    // smoothed grip velocity (thrown into the fry)
    this._prevGrip = new THREE.Vector3();  // grip world pos last frame
    this._wrist = new THREE.Vector3(0, CONFIG.placement.hoverYMin, 0); // smoothed wrist target
    this._primed = false;      // prevents a huge first-frame velocity spike

    this.held = null;          // currently held fry mesh
    this._respawn = 0;         // >0 during the post-release beat (no fry held)
    this._spawnHeld();
  }

  // Grab a fresh fry into the hand.
  _spawnHeld() {
    const mesh = makeFryMesh();
    this.scene.add(mesh);
    this.held = mesh;
    // grip animates closed (GRIP_CLOSED) in update() so the fingers visibly
    // cup the new fry rather than snapping shut.
  }

  // Convert the held fry into a dynamic body (release it) with the hand's momentum.
  _release() {
    if (!this.held) return;
    const body = makeFryBody(this.fryMat);

    // Spawn the body exactly where the fry sits in the fingers right now.
    this.hand.gripWorldPos(_tmp);
    body.position.set(_tmp.x, _tmp.y, _tmp.z);

    // Orientation = the held fry's orientation (tilt pitch, yaw + camera azimuth).
    _euler.set(this.tilt, this.yaw + this.azimuth, 0, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(_euler);
    body.quaternion.set(q.x, q.y, q.z, q.w);

    // Momentum: the released fry inherits the hand's recent velocity (capped/damped).
    const v = releaseVelocity(this.handVel, this.assist, CONFIG.momentum);
    body.velocity.set(v.x, v.y, v.z);

    // Sabotage: a greased release slips sideways as it lands.
    if (this._greaseNext) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      body.velocity.x += dir * 1.5;
      this._greaseNext = false;
    }

    this.world.addBody(body);
    const fry = new Fry(body, this.held);
    this.placed.push(fry);
    this.bodies.push(body);
    this._pendingSettle.push({ body, t: 0 });
    if (this.audio) this.audio.place();

    // Open the hand and pause briefly before grabbing the next fry (release gesture).
    this.held = null;
    this._respawn = CONFIG.placement.respawnBeat;
  }

  _resolveSettles(dt) {
    for (let i = this._pendingSettle.length - 1; i >= 0; i--) {
      const s = this._pendingSettle[i];
      s.t += dt;
      const fell = s.body.position.y < this.trayTopY - 1.5;
      if (fell) {
        this.combo = onCollapse(this.combo);
        if (this.fx) this.fx.burst(s.body.position.x, s.body.position.y, s.body.position.z);
        if (this.cameraRig) this.cameraRig.shake(0.25);
        if (this.audio) this.audio.collapse();
        this._pendingSettle.splice(i, 1);
        continue;
      }
      if (s.t > CONFIG.stability.settleTime && isSettled(s.body)) {
        this.combo = onStablePlacement(this.combo);
        if (this.audio) this.audio.combo();
        this.stableCount += 1;
        this._pendingSettle.splice(i, 1);
      }
    }
  }

  dispose() {
    if (this.held) { this.scene.remove(this.held); this.held = null; }
    for (const f of this.placed) this.scene.remove(f.mesh);
    this.placed = [];
    // Remove all dynamic fry bodies from the physics world to free Cannon memory.
    for (const b of this.bodies) this.world.removeBody(b);
    this.bodies = [];
    // Remove the static tray body as well (the world is discarded after this round).
    if (this._trayBody) { this.world.removeBody(this._trayBody); this._trayBody = null; }
    // Remove the hand rig's meshes from the scene so a disposed round leaves nothing behind.
    if (this.hand) { this.hand.dispose(this.scene); this.hand = null; }
    this._pendingSettle = [];
    this._disposed = true;
  }

  update(dt, input) {
    if (this._disposed) return;
    if (isOver(this.round)) return;

    // One-shot actions.
    if (input) {
      if (input.takeDrop()) this._release();
      if (input.takeAssistToggle()) this.assist = !this.assist;
      if (input.takeReset()) { this.aimX = 0; this.aimZ = 0; this.yaw = 0; this.tilt = 0; this.heightOff = 0; }
    }

    // Held-fry steering (integrate held inputs with dt; clamp to the placement envelope).
    if (input) {
      const p = CONFIG.placement;
      if (input.state.left) this.aimX -= p.moveSpeed * dt;
      if (input.state.right) this.aimX += p.moveSpeed * dt;
      this.aimX = THREE.MathUtils.clamp(this.aimX, -p.xRange, p.xRange);
      if (input.state.fwd) this.aimZ -= p.moveSpeed * dt;   // push away, into the screen
      if (input.state.back) this.aimZ += p.moveSpeed * dt;  // pull toward the camera
      this.aimZ = THREE.MathUtils.clamp(this.aimZ, -p.zRange, p.zRange);
      if (input.state.yawL) this.yaw += p.yawSpeed * dt;
      if (input.state.yawR) this.yaw -= p.yawSpeed * dt;
      if (input.state.tiltUp) this.tilt += p.tiltSpeed * dt;
      if (input.state.tiltDown) this.tilt -= p.tiltSpeed * dt;
      this.tilt = THREE.MathUtils.clamp(this.tilt, -p.tiltMax, p.tiltMax);
      if (input.state.up) this.heightOff += p.heightSpeed * dt;
      if (input.state.down) this.heightOff -= p.heightSpeed * dt;
      this.heightOff = THREE.MathUtils.clamp(this.heightOff, p.heightOffMin, p.heightOffMax);
    }

    const azi = this.azimuth;

    // Release beat: the hand stays open for a moment, then grabs a fresh fry.
    if (!this.held && this._respawn > 0) {
      this._respawn -= dt;
      if (this._respawn <= 0) this._spawnHeld();
    }

    // Hover target sits above the current tower top, clamped to the reach envelope.
    // trayTopY is 0, so towerHeight (height-above-tray) equals the absolute top here.
    const top = towerHeight(this.bodies, this.trayTopY);
    const hoverY = THREE.MathUtils.clamp(
      top + CONFIG.placement.hoverGap + this.heightOff,
      CONFIG.placement.hoverYMin,
      CONFIG.placement.hoverYMax
    );

    // Desired wrist position in world space — the X/Z aim is rotated by the camera
    // azimuth so "left/right/depth" always read from the current on-screen side.
    _desired.set(this.aimX, hoverY, this.aimZ).applyAxisAngle(Y_AXIS, azi);
    this._wrist.lerp(_desired, 1 - Math.exp(-CONFIG.placement.smoothK * dt));

    // Solve the arm IK to the smoothed wrist; the rig rotates its shoulder by azi.
    this.hand.solve(this._wrist, azi);

    // Animate the grip: closed while a fry is held, open during the release beat.
    const gripTarget = this.held ? GRIP_CLOSED : GRIP_OPEN;
    this.grip += (gripTarget - this.grip) * (1 - Math.exp(-dt * 14));
    this.hand.setGrip(this.grip);

    // The held fry rides in the fingers and takes the steered orientation.
    if (this.held) {
      this.hand.gripWorldPos(this.held.position);
      this.held.quaternion.setFromEuler(_euler.set(this.tilt, this.yaw + azi, 0, 'YXZ'));
    }

    // Hand velocity for momentum. Camera-orbit motion must NOT count as a throw.
    this.hand.gripWorldPos(_gripNow);
    if (!this._primed) { this._prevGrip.copy(_gripNow); this._primed = true; }
    const orbiting = input && (input.state.orbitL || input.state.orbitR);
    if (orbiting || dt <= 0) {
      this.handVel.set(0, 0, 0);
    } else {
      _inst.copy(_gripNow).sub(this._prevGrip).multiplyScalar(1 / dt);
      this.handVel.lerp(_inst, CONFIG.momentum.smooth);
    }
    this._prevGrip.copy(_gripNow);

    // ---- Physics + scoring (preserved) ----
    this.world.step(1 / 60, dt, 3);
    for (const f of this.placed) f.sync();
    this._resolveSettles(dt);

    const height = towerHeight(this.bodies, this.trayTopY);
    this.score = roundScore({
      height, combo: this.combo.count, stableCount: this.stableCount,
      secondsLeft: this.round.timeLeft,
    });

    const prev = this.round.phase;
    this.round = tickRound(this.round, dt);
    if (prev === 'playing' && isOver(this.round)) {
      this.onEnd({ height, score: this.score, fallen: fallenCount(this.bodies, this.trayTopY) });
    }
  }

  // ---- Sabotage effects (multiplayer-only; invoked by Multiplayer.applySabotage) ----

  // 강풍 (gust): a sideways gust shoves the whole tower so it lurches.
  applyGust() {
    if (!this.bodies.length) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const impulse = new CANNON.Vec3(dir * 2.5, 0, 0);
    const center = new CANNON.Vec3(0, 0, 0);
    for (const b of this.bodies) {
      b.wakeUp();
      b.applyImpulse(impulse, center);
    }
  }

  // 갈매기 (seagull): a single fry gets a stronger sideways knock.
  nudgeRandomFry() {
    if (!this.bodies.length) return;
    const b = this.bodies[Math.floor(Math.random() * this.bodies.length)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    b.wakeUp();
    b.applyImpulse(new CANNON.Vec3(dir * 4.0, 0.5, 0), new CANNON.Vec3(0, 0, 0));
  }

  // 기름 (grease): the next released fry slips sideways as it lands (see _release()).
  greaseNextFry() {
    this._greaseNext = true;
  }

  get height() { return towerHeight(this.bodies, this.trayTopY); }
}
