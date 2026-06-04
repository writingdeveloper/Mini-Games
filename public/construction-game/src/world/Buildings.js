import * as THREE from 'three';
import { Building } from './Building.js';

export class Buildings {
  constructor(targetBuildings, floorsPerBuilding) {
    this.object3d = new THREE.Group();
    this.object3d.position.set(0, 0, -6);
    this.floorsPerBuilding = floorsPerBuilding;
    const spacing = 12;
    this.buildings = [];
    for (let i = 0; i < targetBuildings; i++) {
      const b = new Building(floorsPerBuilding);
      b.object3d.position.set((i - (targetBuildings - 1) / 2) * spacing, 0, 0);
      this.object3d.add(b.object3d);
      this.buildings.push(b);
    }
  }

  get floorMats() { return this.buildings.map((b) => b.floorMat); }

  // floorsBuilt is the cumulative total across all buildings
  sync(floorsBuilt, progress01) {
    const F = this.floorsPerBuilding;
    const current = Math.floor(floorsBuilt / F);
    for (let i = 0; i < this.buildings.length; i++) {
      if (i < current) this.buildings[i].sync(F, 0);               // completed
      else if (i === current) this.buildings[i].sync(floorsBuilt - i * F, progress01); // active
      else this.buildings[i].sync(0, 0);                           // not started
    }
  }
}
