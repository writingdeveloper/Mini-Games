import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { createPhysicsWorld, makeFryBody, towerHeight, isSettled, fallenCount } from '../physics/world.js';
import { makeFryMesh } from '../render/fryMesh.js';
import { Fry } from '../entities/Fry.js';
import { createRound, tickRound, isOver } from '../logic/round.js';
import { createCombo, onStablePlacement, onCollapse } from '../logic/combo.js';
import { roundScore } from '../logic/scoring.js';

// Owns the cannon world, the active (aiming) fry, placed fries, and pure-logic state.
export class Session {
  constructor(scene, { onEnd, fx } = {}) {
    this.scene = scene;
    this.onEnd = onEnd || (() => {});
    this.fx = fx || null;
    const phys = createPhysicsWorld();
    this.world = phys.world;
    this.fryMat = phys.fryMat;
    this.trayTopY = phys.trayTopY;

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

    const fry = new Fry(body, a.mesh);
    this.placed.push(fry);
    this.bodies.push(body);
    this._pendingSettle.push({ body, t: 0 });
    this.active = null;
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
        this._pendingSettle.splice(i, 1);
        continue;
      }
      if (s.t > CONFIG.stability.settleTime && isSettled(s.body)) {
        this.combo = onStablePlacement(this.combo);
        this.stableCount += 1;
        this._pendingSettle.splice(i, 1);
      }
    }
  }

  update(dt, input) {
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

  get height() { return towerHeight(this.bodies, this.trayTopY); }
}
