import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { FOOTPRINT } from '../logic/site.js'; // single source of truth (shared with the gather logic)
import { SETTINGS } from '../logic/settings.js';
import { applyRetro } from '../render/retroMaterial.js';

const FLOOR_H = 2.4;

// Overshoot ease for the floor "thunk into place" pop-in.
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// --- shared storey resources (S6) -----------------------------------------------------------------
// One set of geometries/materials reused by every storey of every building → a believable mid-rise for
// a handful of unique GPU resources. All marked userData.shared so removeEntity() won't dispose the
// singletons on restart; Lambert mats are retro'd once here (new floors are created mid-game, after the
// scene-wide retro pass, so they must carry the snap already — mirrors how floorMat is pre-retro'd).
const SLAB_GEO = shared(new THREE.BoxGeometry(FOOTPRINT, FLOOR_H, FOOTPRINT));
const WIN_GEO = shared(new THREE.BoxGeometry(FOOTPRINT + 0.04, 1.1, FOOTPRINT + 0.04));
const TRIM_GEO = shared(new THREE.BoxGeometry(FOOTPRINT + 0.12, 0.18, FOOTPRINT + 0.12));
const MULLION_GEO = shared(new THREE.BoxGeometry(0.18, FLOOR_H, 0.18));

function shared(obj) { obj.userData.shared = true; return obj; }
function retroShared(mat) { mat.userData.shared = true; applyRetro(mat, { snap: 160, affine: false }); return mat; }

// Discrete lit/unlit window cells — drawn once, mapped onto BOTH .map and .emissiveMap so only the lit
// cells glow (and they pop beautifully through the dither/posterize).
function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, 64, 32);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i === 2 ? '#1a1e26' : '#ffe6a8'; // one dark window per row for life
    ctx.fillRect(4 + i * 12, 8, 8, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return t;
}
const WIN_TEX = windowTexture();
const WIN_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0x2a3340, map: WIN_TEX, emissive: 0xffd98a, emissiveMap: WIN_TEX, flatShading: true }));
const TRIM_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0xc7c0b4, flatShading: true }));
const MULLION_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0x55504a, flatShading: true }));
const AC_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0x8f9398, flatShading: true }));
const TANK_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0x8a6b4a, flatShading: true }));
const ANTENNA_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0x55504a, flatShading: true }));
const PARAPET_MAT = retroShared(new THREE.MeshLambertMaterial({ color: 0xc7c0b4, flatShading: true }));
const LIGHT_MAT = shared(new THREE.MeshBasicMaterial({ color: 0xff3a2a })); // aviation light (unlit glow)

const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// One storey = darkened core slab + an emissive window band + top/bottom spandrel trim + corner mullions.
function makeFloorStorey(slabMat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(SLAB_GEO, slabMat));
  g.add(new THREE.Mesh(WIN_GEO, WIN_MAT));
  for (const sy of [1, -1]) {
    const trim = new THREE.Mesh(TRIM_GEO, TRIM_MAT);
    trim.position.y = sy * (FLOOR_H / 2 - 0.09);
    g.add(trim);
  }
  for (const [sx, sz] of CORNERS) {
    const m = new THREE.Mesh(MULLION_GEO, MULLION_MAT);
    m.position.set(sx * FOOTPRINT / 2, 0, sz * FOOTPRINT / 2);
    g.add(m);
  }
  return g;
}

// Rooftop dressing (AC unit, water tank, antenna mast + red aviation light, parapet lip) — one per
// building, lifted onto the current top floor as the tower grows.
function makeRooftop() {
  const g = new THREE.Group();
  const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.2), AC_MAT); ac.position.set(-2.2, 0.4, 1.6); g.add(ac);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 8), TANK_MAT); tank.position.set(2.2, 0.7, -1.4); g.add(tank);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), ANTENNA_MAT); mast.position.set(0.5, 1.2, 0.5); g.add(mast);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), LIGHT_MAT); light.position.set(0.5, 2.45, 0.5); g.add(light);
  for (const [sx, sz, w, d] of [[0, 1, FOOTPRINT, 0.15], [0, -1, FOOTPRINT, 0.15], [1, 0, 0.15, FOOTPRINT], [-1, 0, 0.15, FOOTPRINT]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), PARAPET_MAT);
    wall.position.set(sx * FOOTPRINT / 2, 0.2, sz * FOOTPRINT / 2);
    g.add(wall);
  }
  return g;
}

export class Building {
  constructor(maxFloors = CONFIG.targetFloors) {
    this.maxFloors = maxFloors;
    this.object3d = new THREE.Group();
    this.object3d.position.set(0, 0, -6);
    this.floors = [];
    this.floorMat = new THREE.MeshLambertMaterial({ color: 0x9c948a, flatShading: true }); // darkened core slab

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

    this.rooftop = makeRooftop();
    this.rooftop.visible = false;
    this.object3d.add(this.rooftop);

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
      const storey = makeFloorStorey(this.floorMat);
      storey.position.set(0, 0.5 + i * FLOOR_H + FLOOR_H / 2, 0);
      // Pop-in (S4): the storey "thunks" up with an overshoot. Reduced-motion: appear at full scale.
      if (SETTINGS.reducedMotion) { storey.scale.y = 1; }
      else { storey.scale.y = 0.001; storey.userData.pop = 0; }
      this.object3d.add(storey);
      this.floors.push(storey);
    }
    // lift the rooftop onto the current top floor (hidden until the first floor exists)
    this.rooftop.visible = floorsBuilt > 0;
    this.rooftop.position.y = 0.5 + floorsBuilt * FLOOR_H + 0.2;
    this._positionGhost(floorsBuilt, progress01);
  }

  // Ease any popping storeys toward full height (called from Buildings.update). Cheap: only runs while
  // a storey is mid-pop (~0.35s), then the tag is cleared.
  tickPops(dt) {
    for (const f of this.floors) {
      if (f.userData.pop == null) continue;
      f.userData.pop = Math.min(1, f.userData.pop + dt / 0.35);
      f.scale.y = Math.max(0.001, easeOutBack(f.userData.pop));
      if (f.userData.pop >= 1) { f.scale.y = 1; delete f.userData.pop; }
    }
  }
}
