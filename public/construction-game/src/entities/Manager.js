import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getManagerArchetype, pickManagerTarget } from '../logic/managers.js';
import { applyTactic } from '../logic/tactics.js';
import { getArchetype } from '../logic/archetypes.js';
import { decayRage } from '../logic/rage.js';

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
    this.position.set(0, 0, -10 + Math.random() * 4);
    this.cooldownTimer = 0;
    this._wander = Math.random() * 6.28;
  }

  setModel(obj) {
    // keep only the sprite child(ren), drop the placeholder primitives
    this.object3d.children = this.object3d.children.filter((c) => c.isSprite);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    const target = 2.8; // ~worker height in world units
    const s = size.y > 0 ? target / size.y : 1;
    obj.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y = -box2.min.y; // feet on the ground
    this.object3d.add(obj);
  }

  update(dt, game) {
    const a = this.archetype;
    const p = this.position;
    // gentle patrol around the build zone
    this._wander += dt * 0.6;
    const tx = Math.cos(this._wander) * 10, tz = -4 + Math.sin(this._wander) * 8;
    p.x += (tx - p.x) * Math.min(1, dt * 0.5);
    p.z += (tz - p.z) * Math.min(1, dt * 0.5);

    const workers = game.workers || [];
    if (a.passive) {
      for (const w of workers) {
        if (w.logic.escaped) continue;
        const dx = w.position.x - p.x, dz = w.position.z - p.z;
        if (dx * dx + dz * dz <= a.radius * a.radius) {
          decayRage(w.logic, dt * 1.5);
          if (w.logic.activity === 'working') w.logic.slackTimer += dt * 0.5;
        }
      }
      return;
    }

    this.cooldownTimer -= dt;
    if (this.cooldownTimer > 0) return;
    const flat = workers.map((w) => ({ x: w.position.x, z: w.position.z, state: w.logic.state, escaped: w.logic.escaped }));
    const idx = pickManagerTarget(p, a, flat);
    if (idx < 0) return;
    this.cooldownTimer = a.cooldown;
    if (a.successRate < 1 && Math.random() > a.successRate) return; // intern sometimes misses
    const target = workers[idx];
    applyTactic(target.logic, a.tactic, getArchetype(target.logic.archetypeId).rageSensitivity);
    target._lastKey = '';
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
