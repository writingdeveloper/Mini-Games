import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { FOOTPRINT } from '../logic/site.js'; // single source of truth (shared with the gather logic)
import { SETTINGS } from '../logic/settings.js';

const FLOOR_H = 2.4;

// Overshoot ease for the floor "thunk into place" pop-in.
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class Building {
  constructor(maxFloors = CONFIG.targetFloors) {
    this.maxFloors = maxFloors;
    this.object3d = new THREE.Group();
    this.object3d.position.set(0, 0, -6);
    this.floors = [];
    this.floorMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0, flatShading: true });

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(FOOTPRINT + 1, 0.5, FOOTPRINT + 1),
      new THREE.MeshLambertMaterial({ color: 0x6e6a63 })
    );
    slab.position.y = 0.25;
    this.object3d.add(slab);

    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(FOOTPRINT, FLOOR_H, FOOTPRINT),
      new THREE.MeshLambertMaterial({ color: 0xffd24a, transparent: true, opacity: 0.25, flatShading: true })
    );
    this.object3d.add(this.ghost);
    this._positionGhost(0, 0);
  }

  _positionGhost(floorsBuilt, progress01) {
    const y = 0.5 + floorsBuilt * FLOOR_H + (FLOOR_H * progress01) / 2;
    this.ghost.position.set(0, y, 0);
    this.ghost.scale.y = Math.max(0.05, progress01);
    this.ghost.visible = floorsBuilt < this.maxFloors;
  }

  sync(floorsBuilt, progress01) {
    while (this.floors.length < floorsBuilt) {
      const i = this.floors.length;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(FOOTPRINT, FLOOR_H, FOOTPRINT), this.floorMat);
      floor.position.set(0, 0.5 + i * FLOOR_H + FLOOR_H / 2, 0);
      // Pop-in (S4): new floor "thunks" up with an overshoot. Reduced-motion: appear at full scale.
      if (SETTINGS.reducedMotion) { floor.scale.y = 1; }
      else { floor.scale.y = 0.001; floor.userData.pop = 0; }
      this.object3d.add(floor);
      this.floors.push(floor);
    }
    this._positionGhost(floorsBuilt, progress01);
  }

  // Ease any popping floors toward full height (called from Buildings.update). Cheap: only runs while
  // a floor is mid-pop (~0.35s), then the tag is cleared.
  tickPops(dt) {
    for (const f of this.floors) {
      if (f.userData.pop == null) continue;
      f.userData.pop = Math.min(1, f.userData.pop + dt / 0.35);
      f.scale.y = Math.max(0.001, easeOutBack(f.userData.pop));
      if (f.userData.pop >= 1) { f.scale.y = 1; delete f.userData.pop; }
    }
  }
}
