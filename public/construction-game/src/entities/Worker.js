import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getArchetype } from '../logic/archetypes.js';
import { stepWorker } from '../logic/workerState.js';
import { swapInModel } from '../assets/modelUtils.js';
import { SETTINGS } from '../logic/settings.js';

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

    this.bodyMat = new THREE.MeshLambertMaterial({ color: this.archetype.color, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 3, 6), this.bodyMat);
    body.position.y = 1.0;
    this.object3d.add(body);

    const s = makeStatusSprite();
    this.statusSprite = s.sprite; this._canvas = s.canvas; this._tex = s.tex; this._ctx = s.ctx;
    this.object3d.add(this.statusSprite);
    this._lastKey = '';
    this._wanderPhase = Math.random() * 6.28;

    this._redraw();
  }

  setModel(obj) {
    swapInModel(this.object3d, obj);
    this.bodyMat = null; // body replaced by the glTF model; state shown via the status sprite
  }

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

  update(dt) {
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
      this._wanderPhase += dt;
      const tx = w.state === 'working' ? this.home.x : this.home.x + Math.cos(this._wanderPhase) * CONFIG.worker.wanderRadius;
      const tz = w.state === 'working' ? this.home.y : this.home.y + Math.sin(this._wanderPhase) * CONFIG.worker.wanderRadius;
      p.x += (tx - p.x) * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
      p.z += (tz - p.z) * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
    }

    // Redraw gate: include the danger flag so crossing CONFIG.rage.flee toggles the 💢 glyph
    // even if flee isn't aligned to the rage/5 bucketing. Still no per-frame redraw.
    const key = `${w.state}:${Math.round(w.rage / 5)}:${w.rage >= CONFIG.rage.flee ? 1 : 0}`;
    if (key !== this._lastKey) { this._lastKey = key; this._redraw(); }
  }
}
