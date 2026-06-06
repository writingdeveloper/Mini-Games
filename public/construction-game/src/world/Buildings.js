import * as THREE from 'three';
import { Building } from './Building.js';
import { CONFIG } from '../logic/config.js';
import { SPACING, BUILDING_ROW_Z, activeBuildingIndex, buildingCenter, workSlots } from '../logic/site.js';

export class Buildings {
  constructor(targetBuildings, floorsPerBuilding) {
    this.object3d = new THREE.Group();
    this.object3d.position.set(0, 0, BUILDING_ROW_Z);
    this.floorsPerBuilding = floorsPerBuilding;
    this.buildings = [];
    for (let i = 0; i < targetBuildings; i++) {
      const b = new Building(floorsPerBuilding);
      b.object3d.position.set((i - (targetBuildings - 1) / 2) * SPACING, 0, 0);
      this.object3d.add(b.object3d);
      this.buildings.push(b);
    }
    // active-building anchor + SCV work slots (frame-0 defaults; refreshed each update)
    this._refreshActive(0);
  }

  // Recompute which building is being worked + the crew's work slots around its near face. Read by
  // managers (game.building.activeCenterX patrol anchor) and workers (slotFor → SCV gather target).
  _refreshActive(floorsBuilt) {
    const idx = Math.min(this.buildings.length - 1, activeBuildingIndex(floorsBuilt, this.floorsPerBuilding));
    this.activeIndex = idx;
    this.activeCenter = buildingCenter(idx, this.buildings.length);
    this.activeCenterX = this.activeCenter.x;
    this._slots = workSlots(this.activeCenter, CONFIG.workerCount);
  }

  update(dt, game) {
    this._refreshActive(game.build ? game.build.floorsBuilt : 0);
  }

  // Stable work slot for a worker id (fixed assignment → no reshuffle when crew shrinks); null if none.
  slotFor(workerId) {
    if (!this._slots || !this._slots.length) return null;
    return this._slots[workerId % this._slots.length];
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
