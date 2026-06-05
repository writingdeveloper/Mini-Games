import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getArchetype } from '../logic/archetypes.js';
import { stepWorker } from '../logic/workerState.js';

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
    for (const c of this.object3d.children.filter((c) => c !== this.statusSprite)) {
      this.object3d.remove(c);
    }
    obj.position.y = 0;
    this.object3d.add(obj);
  }

  _redraw() {
    const w = this.logic;
    const icon = STATE_ICON[w.state] || (w.state === 'working' ? '' : this.archetype.icon);
    const rage01 = w.rage / CONFIG.rage.max;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, 128, 96);
    if (icon) { ctx.font = '52px serif'; ctx.textAlign = 'center'; ctx.fillText(icon, 64, 52); }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(20, 70, 88, 12);
    ctx.fillStyle = rage01 > 0.8 ? '#ff5a3a' : rage01 > 0.6 ? '#ffcf3a' : '#7ec96f';
    ctx.fillRect(22, 72, 84 * rage01, 8);
    this._tex.needsUpdate = true;
  }

  update(dt) {
    const w = this.logic;
    if (w.escaped) { this.object3d.visible = false; return; }
    if (this.mixer) this.mixer.update(dt);

    stepWorker(w, dt);
    this.bodyMat.color.setHex(STATE_COLOR[w.state]);

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
      this.object3d.position.y = Math.abs(Math.sin(performance.now() / 90)) * 0.3;
    } else {
      this.object3d.position.y = 0;
      this._wanderPhase += dt;
      const tx = w.state === 'working' ? this.home.x : this.home.x + Math.cos(this._wanderPhase) * CONFIG.worker.wanderRadius;
      const tz = w.state === 'working' ? this.home.y : this.home.y + Math.sin(this._wanderPhase) * CONFIG.worker.wanderRadius;
      p.x += (tx - p.x) * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
      p.z += (tz - p.z) * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
    }

    const key = `${w.state}:${Math.round(w.rage / 5)}`;
    if (key !== this._lastKey) { this._lastKey = key; this._redraw(); }
  }
}
