import * as THREE from 'three';

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Camera-follow constants.
const FOLLOW_FACTOR = 0.9;  // world-units of camera rise per world-unit of tower height
const MAX_RISE      = 18;   // hard cap so camera doesn't fly off into the sky
const LERP_SPEED    = 3;    // base-Y lerp speed (units/s feel, exponential)

// Small pooled dust burst + a decaying camera-shake offset.
export class Fx {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this._shake = 0;
    this._base = camera.position.clone();
    this._initialBaseY = this._base.y;
    this._targetBaseY  = this._base.y;
    this._spawnBudget = 8;
    this.sprites = [];
    const tex = makeDotTexture();
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdcb86a, transparent: true, opacity: 0 }));
      s.visible = false; scene.add(s); this.sprites.push({ s, life: 0, vel: new THREE.Vector3() });
    }
  }
  burst(x, y, z) {
    if (reduced) return;
    for (const p of this.sprites) {
      if (p.life > 0) continue;
      p.s.position.set(x, y, z); p.s.visible = true; p.life = 0.6;
      p.vel.set((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3);
      p.s.material.opacity = 1;
      if (--this._spawnBudget <= 0) break;
    }
  }
  shake(amp) { if (!reduced) this._shake = Math.max(this._shake, amp); }
  /** Call each frame with the current tower height so the camera pans up gently. */
  followHeight(h) {
    const rise = Math.min(h * FOLLOW_FACTOR, MAX_RISE);
    this._targetBaseY = this._initialBaseY + rise;
  }
  update(dt) {
    // Lerp base Y toward the target (camera follows tower height with ease).
    const t = Math.min(1, LERP_SPEED * dt);
    this._base.y += (this._targetBaseY - this._base.y) * t;

    this._spawnBudget = 8;
    for (const p of this.sprites) {
      if (p.life <= 0) continue;
      p.life -= dt; p.vel.y -= 6 * dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.material.opacity = Math.max(0, p.life / 0.6);
      if (p.life <= 0) p.s.visible = false;
    }
    // Shake offsets from the now-moving _base, so the two effects compose cleanly.
    if (this._shake > 0.001) {
      this.camera.position.set(
        this._base.x + (Math.random() - 0.5) * this._shake,
        this._base.y + (Math.random() - 0.5) * this._shake,
        this._base.z
      );
      this._shake *= Math.pow(0.001, dt);
    } else {
      this.camera.position.copy(this._base);
    }
  }
}

function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(8, 8, 7, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
