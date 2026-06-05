import * as THREE from 'three';
import { SETTINGS } from '../logic/settings.js';

export class DioramaCamera {
  constructor(camera, foreman) {
    this.camera = camera;
    this.foreman = foreman;
    this.mode = 'overseer';
    this.focus = null;
    this.holdTimer = 0;
    this.overseerOffset = new THREE.Vector3(0, 22, 24);
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  pushIn(targetObject3d, seconds = 1.4) {
    // Reduced-motion: skip the confrontation camera lurch (push-in is a nausea trigger).
    // Stay in the steady overseer framing instead of animating toward the target.
    if (SETTINGS.reducedMotion) return;
    this.focus = targetObject3d;
    this.mode = 'pushin';
    this.holdTimer = seconds;
  }

  update(dt) {
    const f = this.foreman.position;
    let k;
    if (this.mode === 'pushin' && this.focus) {
      this.holdTimer -= dt;
      const w = this.focus.position;
      const mx = (f.x + w.x) / 2, my = (f.y + w.y) / 2 + 1.4, mz = (f.z + w.z) / 2;
      this._look.set(mx, my, mz);
      this._desired.set(mx, my + 3.5, mz + 8);
      k = 1 - Math.pow(0.002, dt);
      if (this.holdTimer <= 0) { this.mode = 'overseer'; this.focus = null; }
    } else {
      this._desired.set(f.x + this.overseerOffset.x, this.overseerOffset.y, f.z + this.overseerOffset.z);
      this._look.set(f.x, 3, f.z - 4);
      k = 1 - Math.pow(0.004, dt);
    }
    this.camera.position.lerp(this._desired, k);
    this.camera.lookAt(this._look);
  }
}
