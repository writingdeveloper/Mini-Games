import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getArchetype } from '../logic/archetypes.js';
import { stepWorker } from '../logic/workerState.js';
import { SETTINGS } from '../logic/settings.js';
import { separation, STATION } from '../logic/site.js';

// Other non-escaped workers' positions, for SCV-pack separation (so the crew clusters without overlap).
function workerPeers(game, self) {
  const out = [];
  for (const w of (game && game.workers) || []) if (w !== self && !w.logic.escaped) out.push(w.position);
  return out;
}

const STATE_COLOR = {
  working: 0x6fae6f, slacking: 0xd8c24a, sabotage: 0xe08a2a, fleeing: 0xe05a3a, riot: 0xa44ad0,
};
const STATE_ICON = { slacking: '❗', sabotage: '😠', fleeing: '🏃', riot: '✊' };

function makeStatusSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 1.8, 1);
  sprite.position.y = 3.4;
  return { sprite, canvas, tex, ctx: canvas.getContext('2d') };
}

// Shared work-rig geometry/material (S4). The arm box hangs from its top so rotation.x swings it like
// a shoulder. Marked userData.shared so removeEntity() won't dispose these singletons on restart.
const ARM_GEO = new THREE.BoxGeometry(0.16, 0.7, 0.16);
ARM_GEO.translate(0, -0.35, 0);
ARM_GEO.userData.shared = true;
const ARM_MAT = new THREE.MeshLambertMaterial({ color: 0x5a4a32, flatShading: true });
ARM_MAT.userData.shared = true;

function makeGlyphSprite(emoji, px, scale, additive) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.font = `${px - 6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, px / 2, px / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  if (additive) mat.blending = THREE.AdditiveBlending;
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(scale);
  return sp;
}
const makeToolSprite = () => makeGlyphSprite('🔨', 32, 0.9, false);
function makeSparkSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff7c8';
  ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xfff2b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(0.5);
  return sp;
}

export class Worker {
  constructor(logic, x, z, exit) {
    this.logic = logic;
    this.archetype = getArchetype(logic.archetypeId);
    this.exit = exit;
    this.object3d = new THREE.Group();
    this.object3d.position.set(x, 0, z);
    this.home = new THREE.Vector2(x, z);
    this.position = this.object3d.position;
    this.justEscaped = false;
    this.enteredRiot = false;
    this.justRiotted = false;
    this.mixer = null;

    // Bright primitive worker (state-tinted capsule + yellow hard-hat). Reads clearly against the
    // brown ground at diorama distance — the downloaded worker.glb rendered near-black (dark PBR
    // materials + metalness, no env map) and was effectively invisible, so it's no longer applied.
    this.bodyMat = new THREE.MeshLambertMaterial({ color: this.archetype.color, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 3, 6), this.bodyMat);
    body.position.y = 1.0;
    this._body = body;
    this.object3d.add(body);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xffcf3a, flatShading: true })
    );
    helmet.position.y = 1.82;
    this.object3d.add(helmet);

    // Work rig (S4): arms + a hammer + a spark, driven only while on-station & working (see _animateWork).
    this._rightArm = new THREE.Mesh(ARM_GEO, ARM_MAT); this._rightArm.position.set(0.42, 1.45, 0.12);
    this._leftArm = new THREE.Mesh(ARM_GEO, ARM_MAT); this._leftArm.position.set(-0.42, 1.45, 0.12);
    this.object3d.add(this._rightArm); this.object3d.add(this._leftArm);
    this._tool = makeToolSprite(); this._tool.position.set(0, -0.78, 0); this._tool.visible = false; this._rightArm.add(this._tool);
    this._spark = makeSparkSprite(); this._spark.position.set(0, -0.95, 0.12); this._spark.material.opacity = 0; this._rightArm.add(this._spark);
    this._workPhase = Math.random() * 6.28;
    this._workRand = Math.random();
    this._prevSwing = 0;
    this._sparkLife = 0;

    const s = makeStatusSprite();
    this.statusSprite = s.sprite; this._canvas = s.canvas; this._tex = s.tex; this._ctx = s.ctx;
    this.object3d.add(this.statusSprite);
    this._lastKey = '';
    this._wanderPhase = Math.random() * 6.28;
    this._wanderSpeed = 0.5 + Math.random() * 0.7; // per-worker pace — crew moves organically, not in lockstep
    this._wanderR = 0.6 + Math.random() * 0.8;     // per-worker wander radius scale
    this._wobble = Math.random() * 6.28;

    this._redraw();
  }

  // No-op: workers use the bright primitive above (the dark worker.glb is not applied). Kept so the
  // engine's model-application path stays uniform across entities.
  setModel() { /* intentionally empty */ }

  _redraw() {
    const w = this.logic;
    const icon = STATE_ICON[w.state] || (w.state === 'working' ? '' : this.archetype.icon);
    const rage01 = w.rage / CONFIG.rage.max;
    const danger = w.rage >= CONFIG.rage.flee; // riot-danger threshold
    const ctx = this._ctx;
    ctx.clearRect(0, 0, 128, 96);
    // Always-on presence marker: a state-colored dot so workers — even calm/"working" ones with no
    // status icon — are spottable at diorama distance against the brown ground.
    ctx.beginPath(); ctx.arc(64, 14, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#' + (STATE_COLOR[w.state] || 0x6fae6f).toString(16).padStart(6, '0');
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.stroke();
    if (icon) { ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.fillText(icon, 64, 60); }
    // Colorblind-safe danger cue: a 💢 glyph reads at high rage even without the bar's red color.
    if (danger) { ctx.font = '30px serif'; ctx.textAlign = 'left'; ctx.fillText('💢', 2, 42); }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(20, 74, 88, 12);
    ctx.fillStyle = rage01 > 0.8 ? '#ff5a3a' : rage01 > 0.6 ? '#ffcf3a' : '#7ec96f';
    ctx.fillRect(22, 76, 84 * rage01, 8);
    this._tex.needsUpdate = true;
  }

  update(dt, game) {
    const w = this.logic;
    if (w.escaped) { this.object3d.visible = false; return; }
    if (this.mixer) this.mixer.update(dt);

    stepWorker(w, dt);
    if (this.bodyMat) this.bodyMat.color.setHex(STATE_COLOR[w.state]);

    const p = this.position;
    if (w.state === 'fleeing') {
      this.object3d.position.y = 0;
      const dx = this.exit.x - p.x, dz = this.exit.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) { w.escaped = true; this.justEscaped = true; }
      else { p.x += (dx / d) * CONFIG.worker.fleeSpeed * dt; p.z += (dz / d) * CONFIG.worker.fleeSpeed * dt; }
      this.object3d.rotation.y = Math.atan2(dx, dz);
    } else if (w.state === 'riot') {
      if (!this.enteredRiot) { this.enteredRiot = true; this.justRiotted = true; }
      // Reduced-motion: skip the vertical riot "bob" (vestibular trigger); hold at base y.
      this.object3d.position.y = SETTINGS.reducedMotion ? 0 : Math.abs(Math.sin(performance.now() / 90)) * 0.3;
    } else {
      this.object3d.position.y = 0;
      this._wanderPhase += dt * this._wanderSpeed;
      const b = game && game.building;
      // SCV gather: a WORKING worker walks to its assigned slot on the active building's near face,
      // then holds station and faces the wall (S4 hooks the hammer motion onto onStation+working).
      const slot = (w.state === 'working' && b && b.slotFor) ? b.slotFor(w.id) : null;
      if (slot) {
        const ndx = slot.x - p.x, ndz = slot.z - p.z;
        const d = Math.hypot(ndx, ndz);
        if (d > STATION.arriveEps) {
          // en route — gather toward the slot, blended with peer separation so the crew packs neatly
          w.onStation = false;
          const sep = separation(p, workerPeers(game, this), 1.4);
          let mx = ndx / (d || 1) + sep.x * 0.8, mz = ndz / (d || 1) + sep.z * 0.8;
          const ml = Math.hypot(mx, mz) || 1;
          const step = CONFIG.worker.moveSpeed * dt;
          p.x += (mx / ml) * step; p.z += (mz / ml) * step;
          this.object3d.rotation.y = Math.atan2(mx, mz);
        } else {
          // on station — micro-sway so the crew isn't frozen, body faces the building wall
          w.onStation = true;
          p.x += (slot.x + Math.cos(this._wanderPhase) * 0.12 - p.x) * Math.min(1, dt * 4);
          p.z += (slot.z + Math.sin(this._wanderPhase * 1.3) * 0.12 - p.z) * Math.min(1, dt * 4);
          const cx = b.activeCenter ? b.activeCenter.x : 0, cz = b.activeCenter ? b.activeCenter.z : -6;
          this.object3d.rotation.y = Math.atan2(cx - p.x, cz - p.z);
        }
      } else {
        // slacking/sabotage (or no active building): amble around spawn home, drifting AWAY from the
        // work line — reads as "that guy walked off the job" and contributes no on-station output.
        w.onStation = false;
        const r = CONFIG.worker.wanderRadius * this._wanderR;
        const tx = this.home.x + Math.cos(this._wanderPhase) * r + Math.cos(this._wanderPhase * 2.3 + this._wobble) * 0.6;
        const tz = this.home.y + Math.sin(this._wanderPhase * 1.3) * r;
        const ndx = tx - p.x, ndz = tz - p.z;
        p.x += ndx * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
        p.z += ndz * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
        if (Math.abs(ndx) + Math.abs(ndz) > 0.04) this.object3d.rotation.y = Math.atan2(ndx, ndz);
      }
    }

    this._animateWork(dt);

    // Redraw gate: include the danger flag so crossing CONFIG.rage.flee toggles the 💢 glyph
    // even if flee isn't aligned to the rage/5 bucketing. Still no per-frame redraw.
    const key = `${w.state}:${Math.round(w.rage / 5)}:${w.rage >= CONFIG.rage.flee ? 1 : 0}`;
    if (key !== this._lastKey) { this._lastKey = key; this._redraw(); }
  }

  // Hammer the building face while on-station & working (transform-only; a spark on each down-stroke).
  // Off-state eases arms to rest. Reduced-motion: a STATIC working pose (no swing/sparks) — still
  // visibly distinct from idle, no vestibular motion. All cheap: a handful of float writes per worker.
  _animateWork(dt) {
    const w = this.logic;
    const ra = this._rightArm, la = this._leftArm, body = this._body;
    if (w.state === 'working' && w.onStation && !SETTINGS.reducedMotion) {
      this._tool.visible = true;
      this._workPhase += dt * (6.0 + this._workRand * 2);
      const swing = Math.sin(this._workPhase);
      ra.rotation.x = -1.1 + swing * 0.9;                 // overhead-down hammer arc
      la.rotation.x = -0.5 + Math.sin(this._workPhase + 1.0) * 0.4; // bracing arm, offset
      body.rotation.x = 0.12 + Math.max(0, swing) * 0.10; // forward hunch on the down-stroke
      body.position.y = 1.0 - Math.max(0, swing) * 0.06;
      if (this._prevSwing > 0 && swing <= 0) this._sparkLife = 0.12; // strike on the down-stroke zero-cross
      this._prevSwing = swing;
      if (this._sparkLife > 0) {
        this._sparkLife -= dt;
        const k = Math.max(0, this._sparkLife / 0.12);
        this._spark.material.opacity = k;
        this._spark.scale.setScalar(0.3 + (1 - k) * 0.6);
      } else this._spark.material.opacity = 0;
    } else {
      const staticPose = w.state === 'working' && SETTINGS.reducedMotion;
      const rest = staticPose ? -0.7 : 0;
      const e = Math.min(1, dt * 8);
      ra.rotation.x += (rest - ra.rotation.x) * e;
      la.rotation.x += (rest - la.rotation.x) * e;
      body.rotation.x += (0 - body.rotation.x) * e;
      body.position.y += (1.0 - body.position.y) * e;
      this._tool.visible = staticPose;
      this._spark.material.opacity = 0;
    }
  }
}
