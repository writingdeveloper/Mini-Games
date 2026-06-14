import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../logic/config.js';
import { createPhysicsWorld, makeFryBody, towerHeight, isSettled, fallenCount } from '../physics/world.js';
import { makeFryMesh } from '../render/fryMesh.js';
import { Fry } from '../entities/Fry.js';
import { createRound, tickRound, isOver } from '../logic/round.js';
import { createCombo, onStablePlacement, onCollapse } from '../logic/combo.js';
import { roundScore } from '../logic/scoring.js';

// Owns the cannon world, the active (aiming) fry, placed fries, and pure-logic state.
export class Session {
  constructor(scene, { onEnd, fx, audio } = {}) {
    this.scene = scene;
    this.onEnd = onEnd || (() => {});
    this.fx = fx || null;
    this.audio = audio || null;
    const phys = createPhysicsWorld();
    this.world = phys.world;
    this.fryMat = phys.fryMat;
    this.trayTopY = phys.trayTopY;
    this._trayBody = phys.trayBody;

    this.placed = [];          // Fry[] dropped
    this.bodies = [];          // CANNON.Body[] dropped (for height)
    this.active = null;        // { mesh, x, angle }
    this.round = createRound();
    this.combo = createCombo();
    this.score = 0;
    this.stableCount = 0;
    this._pendingSettle = [];  // bodies awaiting settle check
    this._spawnActive();
  }

  _spawnActive() {
    const mesh = makeFryMesh();
    mesh.position.set(0, CONFIG.spawn.y, 0);
    this.scene.add(mesh);
    this.active = { mesh, x: 0, angle: 0 };
  }

  // Move/rotate the aiming fry (called from update with input + dt).
  steer(input, dt) {
    if (!this.active) return;
    const a = this.active;
    const speed = 3.2, rot = 2.6;
    if (input.state.left) a.x -= speed * dt;
    if (input.state.right) a.x += speed * dt;
    a.x = THREE.MathUtils.clamp(a.x, -CONFIG.spawn.xRange, CONFIG.spawn.xRange);
    if (input.state.rotL) a.angle += rot * dt;
    if (input.state.rotR) a.angle -= rot * dt;
    a.mesh.position.x = a.x;
    a.mesh.rotation.z = a.angle;
  }

  // Convert the aiming fry into a dynamic body (drop it).
  drop() {
    if (!this.active) return;
    const a = this.active;
    const body = makeFryBody(this.fryMat);
    body.position.set(a.x, CONFIG.spawn.y, 0);
    const e = new THREE.Euler(0, 0, a.angle);
    const q = new THREE.Quaternion().setFromEuler(e);
    body.quaternion.set(q.x, q.y, q.z, q.w);
    this.world.addBody(body);

    // Sabotage: a greased drop slips sideways as it lands.
    if (this._greaseNext) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      body.velocity.set(dir * 1.5, 0, 0);
      this._greaseNext = false;
    }

    const fry = new Fry(body, a.mesh);
    this.placed.push(fry);
    this.bodies.push(body);
    this._pendingSettle.push({ body, t: 0 });
    this.active = null;
    if (this.audio) this.audio.place();
    this._spawnActive();
  }

  _resolveSettles(dt) {
    for (let i = this._pendingSettle.length - 1; i >= 0; i--) {
      const s = this._pendingSettle[i];
      s.t += dt;
      const fell = s.body.position.y < this.trayTopY - 1.5;
      if (fell) {
        this.combo = onCollapse(this.combo);
        if (this.fx) { this.fx.burst(s.body.position.x, s.body.position.y, s.body.position.z); this.fx.shake(0.25); }
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
    if (this.active) { this.scene.remove(this.active.mesh); this.active = null; }
    for (const f of this.placed) this.scene.remove(f.mesh);
    this.placed = [];
    // Remove all dynamic fry bodies from the physics world to free Cannon memory.
    for (const b of this.bodies) this.world.removeBody(b);
    this.bodies = [];
    // Remove the static tray body as well (the world is discarded after this round).
    if (this._trayBody) { this.world.removeBody(this._trayBody); this._trayBody = null; }
    this._pendingSettle = [];
    this._disposed = true;
  }

  update(dt, input) {
    if (this._disposed) return;
    if (isOver(this.round)) return;
    if (input && input.takeDrop()) this.drop();
    if (input) this.steer(input, dt);

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

  // 기름 (grease): the next dropped fry slips sideways as it lands (see drop()).
  greaseNextFry() {
    this._greaseNext = true;
  }

  get height() { return towerHeight(this.bodies, this.trayTopY); }
}
