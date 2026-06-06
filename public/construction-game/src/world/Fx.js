import * as THREE from 'three';
import { SETTINGS } from '../logic/settings.js';

// Soft radial disc (dust) — one shared canvas texture, NearestFilter to stay retro.
function discTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}
// Small bright spark dot.
function sparkTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

// Pre-allocated ring of sprites with velocity + life, integrated each frame. NEVER allocates at
// runtime (a GC pause mid-shift would read as a stutter), so floor-complete bursts are free.
class SpritePool {
  constructor(scene, count, texture, blending) {
    this.sprites = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending });
      mat.opacity = 0;
      const s = new THREE.Sprite(mat); s.visible = false;
      s.userData = { vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, s0: 1, s1: 1 };
      scene.add(s);
      this.sprites.push(s);
    }
    this._next = 0;
  }
  spawn(x, y, z, o) {
    const s = this.sprites[this._next];
    this._next = (this._next + 1) % this.sprites.length;
    const u = s.userData;
    s.position.set(x, y, z);
    u.vel.set(o.vx || 0, o.vy || 0, o.vz || 0);
    u.life = u.maxLife = o.life || 0.5; u.grav = o.grav || 0;
    u.s0 = o.s0 || 1; u.s1 = o.s1 != null ? o.s1 : u.s0;
    u.peak = o.opacity != null ? o.opacity : 1; // peak opacity, faded to 0 over the life
    s.material.color.set(o.color != null ? o.color : 0xffffff);
    s.material.opacity = u.peak;
    s.scale.setScalar(u.s0); s.visible = true;
  }
  update(dt) {
    for (const s of this.sprites) {
      const u = s.userData;
      if (u.life <= 0) continue;
      u.life -= dt;
      if (u.life <= 0) { s.visible = false; s.material.opacity = 0; continue; }
      u.vel.y -= u.grav * dt;
      s.position.x += u.vel.x * dt; s.position.y += u.vel.y * dt; s.position.z += u.vel.z * dt;
      const t = 1 - u.life / u.maxLife;
      s.scale.setScalar(u.s0 + (u.s1 - u.s0) * t);
      s.material.opacity = u.peak * (1 - t);
    }
  }
  reset() { for (const s of this.sprites) { s.visible = false; s.material.opacity = 0; s.userData.life = 0; } }
}

// Floor/building completion FX (pooled). Added once as a persistent system; survives buildWorld.
export class Fx {
  constructor(scene) {
    this.object3d = new THREE.Group(); // placeholder so game.add() tracks this as a system
    this.dust = new SpritePool(scene, 32, discTexture(), THREE.NormalBlending);
    this.spark = new SpritePool(scene, 48, sparkTexture(), THREE.AdditiveBlending);
  }

  // Burst at the just-finished floor: a dust ring at its base + a spark fountain off the top edge.
  floorBurst(x, y, z, footprint = 10) {
    if (SETTINGS.reducedMotion) return;
    const r = footprint / 2 * 0.9;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.dust.spawn(x + Math.cos(a) * r, y, z + Math.sin(a) * r,
        { vx: Math.cos(a) * 1.2, vy: 0.8, vz: Math.sin(a) * 1.2, life: 0.55, color: 0xcfc6b2, s0: 1.2, s1: 3.2, opacity: 0.85 });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 3;
      this.spark.spawn(x + (Math.random() * 2 - 1) * 2, y + 1.4, z + (Math.random() * 2 - 1) * 2,
        { vx: Math.cos(a) * sp, vy: 3 + Math.random() * 3, vz: Math.sin(a) * sp, grav: 14, life: 0.45, color: i % 2 ? 0xfff2b0 : 0xffd24a, s0: 0.9, s1: 0.2 });
    }
  }

  update(dt) { this.dust.update(dt); this.spark.update(dt); }
  reset() { this.dust.reset(); this.spark.reset(); }
}
