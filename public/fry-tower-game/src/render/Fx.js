import * as THREE from 'three';

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Small pooled dust burst.
export class Fx {
  constructor(scene) {
    this.scene = scene;
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
  update(dt) {
    this._spawnBudget = 8;
    for (const p of this.sprites) {
      if (p.life <= 0) continue;
      p.life -= dt; p.vel.y -= 6 * dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.material.opacity = Math.max(0, p.life / 0.6);
      if (p.life <= 0) p.s.visible = false;
    }
  }
}

function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(8, 8, 7, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
