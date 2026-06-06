import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getManagerArchetype, pickManagerTarget, managerTargetScore, chooseTactic, separation } from '../logic/managers.js';
import { pushOutOfFootprints } from '../logic/site.js';
import { applyTactic } from '../logic/tactics.js';
import { getArchetype } from '../logic/archetypes.js';
import { addRage, decayRage } from '../logic/rage.js';
import { mulberry32 } from '../logic/spawn.js';
import { SETTINGS } from '../logic/settings.js';

const ACTION_RANGE = 2.2;    // how close a manager stands before acting on a worker
const COMMIT_TIME = 0.8;     // min seconds committed to a target before re-evaluating (anti-thrash)
const SWITCH_MARGIN = 60;    // a rival target must beat the committed one by this score to steal focus
const SEP_RADIUS = 1.4;      // peers closer than this push each other apart (no body stacking)
const SEP_WEIGHT = 0.9;
const SPEED = { drill: 4.6, veteran: 3.4, vibe: 2.6, intern: 3.0 }; // per-archetype movement personality

let _managerSeq = 0; // monotonic per-construction → distinct seeded RNG + flank angle per manager

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
    const seq = _managerSeq++;
    // Outcome RNG (success roll) is SEEDED for determinism/testability; cosmetic jitter still uses Math.random.
    this._rng = mulberry32((CONFIG.seed + 0x51ed + seq * 2654435761) >>> 0);
    // Golden-angle flank offset so several managers fan AROUND a shared target instead of stacking.
    this._flankAngle = seq * 2.399963229;
    // Patrol anchor sits just in front of the building row (z≈-6); its x is re-anchored to the
    // ACTIVE building each frame (see _anchorToBuilding) so supervisors stay where the work is.
    this._anchorOffX = (Math.random() * 2 - 1) * 7;
    this._home = { x: this._anchorOffX, z: -2 + (Math.random() * 2 - 1) * 3 };
    this.position.set(this._home.x, 0, this._home.z);

    this.cooldownTimer = 0;
    this.mixer = null;
    this._speed = (SPEED[archetypeId] || 3.2) * (0.9 + Math.random() * 0.25);
    this._idle = { x: this._home.x, z: this._home.z };
    this._idleTimer = Math.random() * 2;
    this._actTimer = 0;
    this._bump = 0;
    this._target = null;     // committed worker id (survives array churn), or null
    this._commitTimer = 0;
    this._moving = false;
  }

  setModel() { /* intentionally empty — managers use the bright primitive (S7 may wire a glTF) */ }

  update(dt, game) {
    if (this.mixer) this.mixer.update(dt);
    const a = this.archetype;
    const workers = game.workers || [];
    this.cooldownTimer -= dt;
    if (this._actTimer > 0) this._actTimer -= dt;
    if (this._bump > 0) this._bump = Math.max(0, this._bump - dt);
    if (this._commitTimer > 0) this._commitTimer -= dt;
    this._moving = false;
    this._anchorToBuilding(game);

    if (a.passive) { this._updatePassive(dt, workers, game); this._pushOut(game); this._applyBob(); return; }

    // ACTIVE (veteran/drill/intern): triage to the most urgent reachable worker, walk to it, act up close.
    const target = this._selectTarget(workers);
    if (target) this._seekAndAct(target, dt, game);
    else this._stepToward(this._idleGoal(dt), dt, this._speed * 0.5, game); // no problems → patrol the anchor
    this._pushOut(game);
    this._applyBob();
  }

  // Never stand inside a building footprint — slide out to the nearest edge (managers flank workers at
  // the face, so this only catches the occasional walk-through).
  _pushOut(game) {
    const b = game && game.building;
    if (b && b.footprints) pushOutOfFootprints(this.position, b.footprints, b.footprintHalf, 0.6);
  }

  // Re-anchor the patrol x to the active building so managers loiter where the crew gathers, not at a
  // fixed spawn patch. game.building.activeCenterX is provided by the SCV-gather work (S3); until then
  // it falls back to the build-row centre (0).
  _anchorToBuilding(game) {
    const cx = (game.building && typeof game.building.activeCenterX === 'number') ? game.building.activeCenterX : 0;
    this._home.x = cx + this._anchorOffX;
  }

  _views(workers) {
    const out = [];
    for (const w of workers) {
      out.push({
        x: w.position.x, z: w.position.z,
        state: w.logic.state, rage: w.logic.rage, escaped: w.logic.escaped,
        sensitivity: getArchetype(w.logic.archetypeId).rageSensitivity,
      });
    }
    return out;
  }

  // Hysteresis: keep the committed target while it stays eligible and the commit window is open; only
  // switch when it becomes ineligible or a rival beats it by SWITCH_MARGIN. Stops per-frame thrashing
  // between two equidistant slackers (the old code re-picked nearest every frame and oscillated).
  _selectTarget(workers) {
    const ctx = { tactics: CONFIG.tactics, rage: CONFIG.rage };
    const views = this._views(workers);
    const curIdx = this._target == null ? -1 : workers.findIndex((w) => w.logic.id === this._target);
    const curScore = curIdx >= 0 ? managerTargetScore(this.position, this.archetype, views[curIdx], ctx) : -Infinity;

    if (curScore > -Infinity && this._commitTimer > 0) return workers[curIdx];

    const bestIdx = pickManagerTarget(this.position, this.archetype, views, ctx);
    if (bestIdx < 0) {
      if (curScore > -Infinity) return workers[curIdx];
      this._target = null;
      return null;
    }
    if (curScore > -Infinity && bestIdx !== curIdx) {
      const bestScore = managerTargetScore(this.position, this.archetype, views[bestIdx], ctx);
      if (bestScore <= curScore + SWITCH_MARGIN) return workers[curIdx]; // not clearly better — don't thrash
    }
    if (workers[bestIdx].logic.id !== this._target) { this._target = workers[bestIdx].logic.id; this._commitTimer = COMMIT_TIME; }
    return workers[bestIdx];
  }

  _seekAndAct(target, dt, game) {
    const p = this.position;
    const toX = target.position.x - p.x, toZ = target.position.z - p.z;
    const distToWorker = Math.hypot(toX, toZ) || 1e-3;
    this.object3d.rotation.y = Math.atan2(toX, toZ); // always face the worker (hop/act reads correctly)

    if (distToWorker > ACTION_RANGE) {
      // SEEK: steer toward a per-manager flank point around the worker, blended with peer separation.
      const stand = this._flankPoint(target);
      let mx = stand.x - p.x, mz = stand.z - p.z;
      const ml = Math.hypot(mx, mz) || 1e-3; mx /= ml; mz /= ml;
      const sep = this._separationPush(game);
      mx += sep.x * SEP_WEIGHT; mz += sep.z * SEP_WEIGHT;
      const sl = Math.hypot(mx, mz) || 1;
      p.x += (mx / sl) * this._speed * dt;
      p.z += (mz / sl) * this._speed * dt;
      this._moving = true;
      return;
    }
    if (this.cooldownTimer <= 0 && this._actTimer <= 0) this._act(target); // in range → ACT (else hold during cooldown)
  }

  _act(target) {
    const a = this.archetype;
    const sens = getArchetype(target.logic.archetypeId).rageSensitivity;
    const view = { state: target.logic.state, rage: target.logic.rage, sensitivity: sens };
    const tactic = chooseTactic(a, view, CONFIG.tactics, CONFIG.rage);
    if (!tactic) {
      // worker overheated during the walk-in — acting would tip it over flee. Release and re-pick.
      this._target = null; this._commitTimer = 0; this.cooldownTimer = 0.3;
      return;
    }
    this._actTimer = 0.7; // brief "handling them" beat (reads as doing something)
    const success = a.successRate >= 1 || this._rng() < a.successRate;
    if (success) {
      applyTactic(target.logic, tactic, sens);
      target._lastKey = '';
      this._bump = 0.4;             // satisfied hop
      this.cooldownTimer = a.cooldown;
    } else {
      // intern fumble: a small, capped rage bump (never crosses flee) — a readable backfire — plus a
      // shorter cooldown so the fumbling is visibly repeated instead of being a silent no-op.
      if (target.logic.rage + 5 * sens < CONFIG.rage.flee) addRage(target.logic, 5, sens);
      target._lastKey = '';
      this._bump = 0.12;
      this.cooldownTimer = a.cooldown * 0.5;
    }
  }

  _flankPoint(target) {
    const r = ACTION_RANGE * 0.8;
    return {
      x: target.position.x + Math.sin(this._flankAngle) * r,
      z: target.position.z + Math.cos(this._flankAngle) * r,
    };
  }

  _separationPush(game) {
    const others = [];
    for (const m of (game.managers || [])) if (m !== this) others.push(m.position);
    for (const w of (game.workers || [])) if (!w.logic.escaped) others.push(w.position);
    return separation(this.position, others, SEP_RADIUS);
  }

  // PASSIVE (vibe): rove toward the HOTTEST worker in range (the one most needing calming — not merely
  // the nearest), keeping a real standoff, applying the named calming aura to everyone within radius.
  _updatePassive(dt, workers, game) {
    const a = this.archetype;
    const p = this.position;
    const KEEP = 3.5;
    const r2 = a.radius * a.radius, aw2 = (a.awareness ?? 12) ** 2;
    let roam = null, roamRage = -1;
    for (const w of workers) {
      if (w.logic.escaped) continue;
      const dx = w.position.x - p.x, dz = w.position.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= r2) decayRage(w.logic, dt * (a.auraRageDecay ?? 1.6));
      if (d2 <= aw2 && w.logic.rage > roamRage) { roamRage = w.logic.rage; roam = w; }
    }
    let goal;
    if (roam && roamRage > 1) {
      const dist = Math.hypot(roam.position.x - p.x, roam.position.z - p.z);
      goal = dist > KEEP ? roam.position : this._idleGoal(dt); // stand off; don't hug the worker
    } else {
      goal = this._idleGoal(dt);
    }
    this._stepToward(goal, dt, this._speed * 0.7, game);
  }

  _idleGoal(dt) {
    this._idleTimer -= dt;
    if (this._idleTimer <= 0) {
      this._idleTimer = 1.6 + Math.random() * 2.6;
      this._idle = { x: this._home.x + (Math.random() * 2 - 1) * 4, z: this._home.z + (Math.random() * 2 - 1) * 3 };
    }
    return this._idle;
  }

  _stepToward(goal, dt, speed, game) {
    const p = this.position;
    let dx = goal.x - p.x, dz = goal.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.15) return;
    dx /= dist; dz /= dist;
    if (game) { const sep = this._separationPush(game); dx += sep.x * SEP_WEIGHT; dz += sep.z * SEP_WEIGHT; }
    const l = Math.hypot(dx, dz) || 1;
    const step = Math.min(speed * dt, dist);
    p.x += (dx / l) * step;
    p.z += (dz / l) * step;
    this.object3d.rotation.y = Math.atan2(dx, dz);
    this._moving = true;
  }

  _applyBob() {
    const active = !SETTINGS.reducedMotion && (this._actTimer > 0 || this._bump > 0 || this._moving);
    const amp = this._actTimer > 0 ? 0.18 : 0.10;
    this.object3d.position.y = active ? Math.abs(Math.sin(performance.now() / 70)) * amp : 0;
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
