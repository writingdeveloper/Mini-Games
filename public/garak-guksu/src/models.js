import * as THREE from 'three';

// All factories return a THREE.Group so the mesh can later be swapped for a glTF
// load without touching scene.js / logic.js.

export function createFloor() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.9 })
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  g.add(floor);
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 })
  );
  counter.position.set(0, 0.5, 2.7);
  counter.castShadow = true; counter.receiveShadow = true;
  g.add(counter);
  return g;
}

export function createChef() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })
  );
  body.position.y = 0.5; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.7 })
  );
  head.position.y = 1.2; head.castShadow = true;
  g.add(body, head);
  const bowl = createBowl();
  bowl.position.set(0, 1.0, 0.35);
  bowl.name = 'heldBowl';
  bowl.visible = false;
  g.add(bowl);
  return g;
}

export function createBowl() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.14, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0xeae0d0, roughness: 0.5 })
  );
  bowl.castShadow = true;
  g.add(bowl);
  return g;
}

const STATION_COLORS = {
  setting:  0xb08d57,
  blancher: 0x9aa3ad,
  broth:    0x7a5a3a,
  garnish:  0xc23b3b,
};

export function createStation(kind = 'blancher') {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: STATION_COLORS[kind] ?? 0x9aa3ad, metalness: 0.4, roughness: 0.5 })
  );
  pot.position.y = 0.55; pot.castShadow = true; pot.receiveShadow = true;
  g.add(pot);
  return g;
}

export function createGauge() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.12, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x222831 })
  );
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.12, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffcf6a })
  );
  fill.name = 'fill';
  fill.position.z = 0.01;
  g.add(bg, fill);
  g.visible = false;
  return g;
}

export function createCustomer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.7, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.7 })
  );
  body.position.y = 0.75; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.7 })
  );
  head.position.y = 1.45;
  head.castShadow = true;
  g.add(body, head);
  return g;
}
