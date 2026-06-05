import * as THREE from 'three';
import { getManagerArchetype } from '../logic/managers.js';
import { applyTactic } from '../logic/tactics.js';
import { getArchetype } from '../logic/archetypes.js';
import { decayRage } from '../logic/rage.js';
import { SETTINGS } from '../logic/settings.js';

const ACTION_RANGE = 2.2;   // how close a manager walks before acting on a worker
const AWARENESS = 22;       // how far a manager notices a problem worker to go handle it
const SPEED = { drill: 4.6, veteran: 3.4, vibe: 2.6, intern: 3.0 }; // per-archetype movement personality

export class Manager {
  constructor(archetypeId) {
    const a = getManagerArchetype(archetypeId);
    this.archetypeId = archetypeId;
    this.archetype = a;
    this.label = a.label;
    this.salary = a.salary;
    this.object3d = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: a.color, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 3, 6), bodyMat);
    body.position.y = 1.1;
    this.object3d.add(body);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: a.helmet, flatShading: true })
    );
    helmet.position.y = 1.95;
    this.object3d.add(helmet);
    this.object3d.add(makeTagSprite(a.icon));

    this.position = this.object3d.position;
    // distinct patrol home per manager so they don't clump and orbit the same circle
    this._home = { x: (Math.random() * 2 - 1) * 9, z: -6 + (Math.random() * 2 - 1) * 6 };
    this.position.set(this._home.x, 0, this._home.z);
    this.cooldownTimer = 0;
    this.mixer = null;
    // movement personality (varied feel): drill marches, vibe ambles, etc. + a little per-instance jitter
    this._speed = (SPEED[archetypeId] || 3.2) * (0.9 + Math.random() * 0.25);
    this._idle = { x: this._home.x, z: this._home.z };
    this._idleTimer = Math.random() * 2;
    this._actTimer = 0;
    this._bump = 0;
    this._target = null;
  }

  setModel() { /* intentionally empty — managers use the bright primitive */ }

  update(dt, game) {
    if (this.mixer) this.mixer.update(dt);
    const a = this.archetype;
    const p = this.position;
    const workers = game.workers || [];
    this.cooldownTimer -= dt;
    if (this._actTimer > 0) this._actTimer -= dt;
    if (this._bump > 0) this._bump = Math.max(0, this._bump - dt);

    // PASSIVE (vibe): mingle through the crew, applying the calming aura to nearby workers.
    if (a.passive) {
      let nearest = null, nd = Infinity;
      for (const w of workers) {
        if (w.logic.escaped) continue;
        const dx = w.position.x - p.x, dz = w.position.z - p.z, d = dx * dx + dz * dz;
        if (d <= a.radius * a.radius) {
          decayRage(w.logic, dt * 1.6);
          if (w.logic.activity === 'working') w.logic.slackTimer += dt * 0.5;
        }
        if (d < nd) { nd = d; nearest = w; }
      }
      // drift toward the nearest worker (keep some distance) or wander its own zone
      const goal = (nearest && nd > 7) ? nearest.position : this._idleGoal(dt);
      this._stepToward(goal, dt, this._speed * 0.7);
      this._applyBob();
      return;
    }

    // ACTIVE (veteran/drill/intern): find the nearest slacking/sabotaging worker, WALK to it, act up close.
    const target = this._findProblem(workers);
    this._target = target;
    if (target) {
      const dx = target.position.x - p.x, dz = target.position.z - p.z;
      const dist = Math.hypot(dx, dz) || 1e-3;
      this.object3d.rotation.y = Math.atan2(dx, dz);
      if (dist > ACTION_RANGE) {
        p.x += (dx / dist) * this._speed * dt;
        p.z += (dz / dist) * this._speed * dt;
      } else if (this.cooldownTimer <= 0 && this._actTimer <= 0) {
        this._actTimer = 0.7;                 // brief "handling them" beat (reads as doing something)
        this.cooldownTimer = a.cooldown;
        if (a.successRate >= 1 || Math.random() < a.successRate) {
          applyTactic(target.logic, a.tactic, getArchetype(target.logic.archetypeId).rageSensitivity);
          target._lastKey = '';
          this._bump = 0.4;                   // satisfied hop
        } else {
          this._bump = 0.12;                  // intern fumble
        }
      }
    } else {
      this._stepToward(this._idleGoal(dt), dt, this._speed * 0.5); // no problems → patrol own zone
    }
    this._applyBob();
  }

  _findProblem(workers) {
    let best = null, bestD = AWARENESS * AWARENESS;
    for (const w of workers) {
      const s = w.logic;
      if (s.escaped || (s.state !== 'slacking' && s.state !== 'sabotage')) continue;
      const dx = w.position.x - this.position.x, dz = w.position.z - this.position.z, d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }

  // Re-pick a wander point near home every few seconds (with pauses) → organic, non-uniform idle motion.
  _idleGoal(dt) {
    this._idleTimer -= dt;
    if (this._idleTimer <= 0) {
      this._idleTimer = 1.6 + Math.random() * 2.6;
      this._idle = { x: this._home.x + (Math.random() * 2 - 1) * 5, z: this._home.z + (Math.random() * 2 - 1) * 4 };
    }
    return this._idle;
  }

  _stepToward(goal, dt, speed) {
    const dx = goal.x - this.position.x, dz = goal.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      this.position.x += (dx / dist) * Math.min(speed * dt, dist);
      this.position.z += (dz / dist) * Math.min(speed * dt, dist);
      this.object3d.rotation.y = Math.atan2(dx, dz);
    }
  }

  _applyBob() {
    this.object3d.position.y = (!SETTINGS.reducedMotion && (this._actTimer > 0 || this._bump > 0))
      ? Math.abs(Math.sin(performance.now() / 70)) * 0.18 : 0;
  }
}

function makeTagSprite(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.fillText(emoji, 32, 46);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(2.2, 2.2, 1); sprite.position.y = 3.1;
  return sprite;
}
