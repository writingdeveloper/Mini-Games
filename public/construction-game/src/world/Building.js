import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

const FLOOR_H = 2.4;
const FOOTPRINT = 10;

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
      this.object3d.add(floor);
      this.floors.push(floor);
    }
    this._positionGhost(floorsBuilt, progress01);
  }
}
