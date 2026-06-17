// 뽑기 (ppopgi) — metal claw, real physics, conditional + breakable grip.
// Prongs physically close (kinematic, shove the pile). A spring "grip" holds caught
// prizes: it STRETCHES under weight/swing and SNAPS if you yank too hard or grab a
// heavy/multi load -> real slip ("잡았다… 미끄러진다"). Empty cage = catch nothing
// (no magic, not unconditional). Japanese-arcade dressing. Self-contained (no fry-tower deps).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Prize, PRIZE_SETS } from './prizes.js';
import { sfx } from './sfx.js';
import { rollValue, prizeMass, gripBreakDist, tickTime } from './logic.js';

let currentSet = PRIZE_SETS[0]; // the selected machine (PrizeSet) — see machine-select

// ---- Tunables ----
const FLOOR_Y = 3.0;
const CAB = { x: 0, z: 0, half: 3.0 };
const HOLE = { x: -1.85, z: -1.85, half: 1.0 };
const R_ATTACH = 0.55, FINGER_LEN = 1.9, FINGER_R = 0.13;
const OPEN_ANG = 0.4, CLOSE_ANG = -0.42;          // prong tilt: + splays out, - tips in
const HOVER_Y = 8.6, PLUNGE_Y = FLOOR_Y + 1.7;    // hub heights
const PLUNGE_SPEED = 4.0, LIFT_SPEED = 3.2, RETURN_SPEED = 2.2, AIM_SPEED = 3.6; // lift yanks (tests the grip)
const GRIP_R = 1.15, CAGE_BAND = 1.4, MAX_GRAB = 2;
const K_BASE = 30, DAMP = 5.0;                    // grip spring stiffness / damping
// grip snap distance lives in logic.js (gripBreakDist) — pure + unit-tested
const ROUND_SEC = 90;
// Collision groups: held fries stop colliding with the claw (spring is the grip) but still hit walls/pile.
const G_SOLID = 1, G_FRY = 2, G_CLAW = 4, G_HELD = 8;

// ---- Scene ----
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x150a22);          // dark arcade hall
scene.fog = new THREE.Fog(0x150a22, 26, 64);           // the aisle fades into the distance
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.6, 200); // near 0.6 for depth precision (less z-fighting)
scene.add(new THREE.HemisphereLight(0x7a5aa6, 0x241038, 0.55)); // dim purple ambient
const sun = new THREE.DirectionalLight(0xfff0e0, 0.55);
sun.position.set(8, 20, 10);
scene.add(sun);
// Warm light INSIDE the hero cabinet so the prize area glows like a real UFO catcher.
const cabLight = new THREE.PointLight(0xffe7b2, 1.7, 18, 1.5);
cabLight.position.set(CAB.x, FLOOR_Y + 3.0, CAB.z);
scene.add(cabLight);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
// Settable camera: spherical orbit (azimuth/pitch/radius) with drag + preset angles.
const CAM_PRESETS = {
  play: { az: 0.13, pitch: 0.28, r: 13.6, ty: 4.05 },      // standing-at-machine (default; bin in frame at the bottom)
  front: { az: 0.0, pitch: 0.10, r: 12.5, ty: 4.7 },        // straight-on
  side: { az: 1.32, pitch: 0.22, r: 12.5, ty: 4.4 },        // judge depth from the side
  top: { az: 0.0, pitch: 0.62, r: 12.0, ty: 4.0 },          // high-front angle (marquee blocks true top-down)
};
const camState = { ...CAM_PRESETS.play };
const camGoal = { ...CAM_PRESETS.play };
let camShake = 0, camDrag = false;
function setCamPreset(name) { if (CAM_PRESETS[name]) Object.assign(camGoal, CAM_PRESETS[name]); }
function updateCamera(dt) {
  if (camShake > 0.001) camShake *= Math.pow(0.0015, dt);
  if (!camDrag) { const k = Math.min(1, dt * 6); for (const p of ['az', 'pitch', 'r', 'ty']) camState[p] += (camGoal[p] - camState[p]) * k; }
  const sx = (Math.random() - 0.5) * camShake, sy = (Math.random() - 0.5) * camShake;
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  camera.position.set(Math.sin(camState.az) * cp * camState.r + sx, camState.ty + sp * camState.r + sy, Math.cos(camState.az) * cp * camState.r);
  camera.lookAt(0, camState.ty, 0);
}
// audio handled by the sfx module

// ---- Physics ----
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 16;
const fryMat = new CANNON.Material('fry');
const solidMat = new CANNON.Material('solid');
const clawMat = new CANNON.Material('claw');
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, fryMat, { friction: 0.45, restitution: 0.02 }));
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, solidMat, { friction: 0.6, restitution: 0.02 }));
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, clawMat, { friction: 0.9, restitution: 0.0 }));
world.addContactMaterial(new CANNON.ContactMaterial(clawMat, solidMat, { friction: 0.3, restitution: 0.0 }));

function staticBox(cx, cy, cz, hx, hy, hz, color, opacity = 1) {
  const body = new CANNON.Body({ mass: 0, material: solidMat, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
  body.position.set(cx, cy, cz);
  world.addBody(body);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }) // glass: no depth write -> no transparent-sort flicker
  );
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);
  return body;
}

// Cabinet — floor with a back-left hole, glass walls, posts. (No solid base: the hole must drop through.)
const FLOORC = 0xefe6ee; // prize floor (tucked just under the cabinet's cream floor; cream body shows on top)
// Floor = two strips leaving the back-left hole uncovered (x<-0.85 & z<-0.85 open).
staticBox(0.95, FLOOR_Y - 0.66, 0, CAB.half - 0.85, 0.6, CAB.half, FLOORC);       // right strip (thick slab)
staticBox(-1.95, FLOOR_Y - 0.66, 1.05, 1.05, 0.6, CAB.half - 1.05, FLOORC);       // left-front strip (thick slab)
// Walls sit ENTIRELY outside the interior (inner face exactly at ±CAB.half) so they never
// overlap floor-resting fries; corners overlapped so nothing escapes diagonally.
const wallY = FLOOR_Y + 1.9, wallH = 2.5, WT = 0.3;
staticBox(CAB.x + CAB.half + WT, wallY, CAB.z, WT, wallH, CAB.half + WT, 0x8fd3e8, 0.16);
staticBox(CAB.x - CAB.half - WT, wallY, CAB.z, WT, wallH, CAB.half + WT, 0x8fd3e8, 0.16);
staticBox(CAB.x, wallY, CAB.z + CAB.half + WT, CAB.half + WT, wallH, WT, 0x8fd3e8, 0.16);
staticBox(CAB.x, wallY, CAB.z - CAB.half - WT, CAB.half + WT, wallH, WT, 0x8fd3e8, 0.16);
for (const px of [-1, 1]) for (const pz of [-1, 1]) {
  staticBox(CAB.x + px * CAB.half, wallY, CAB.z + pz * CAB.half, 0.13, wallH, 0.13, 0x2a1a3a); // dark posts (neon on top)
}
staticBox(HOLE.x, FLOOR_Y - 1.4, HOLE.z, HOLE.half + 0.35, 0.1, HOLE.half + 0.35, 0x161616); // bin floor
const rim = new THREE.Mesh(new THREE.RingGeometry(HOLE.half * 0.6, HOLE.half + 0.22, 30),
  new THREE.MeshBasicMaterial({ color: 0x141414, side: THREE.DoubleSide }));
rim.rotation.x = -Math.PI / 2; rim.position.set(HOLE.x, FLOOR_Y + 0.02, HOLE.z); scene.add(rim);

// Aim reticle.
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.64, 30),
  new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
reticle.rotation.x = -Math.PI / 2; scene.add(reticle);

// ===================== Arcade dressing (real ゲーセン / UFO-catcher look) =====================
function emis(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}
function visBox(cx, cy, cz, hx, hy, hz, mat, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), mat);
  m.position.set(cx, cy, cz); parent.add(m); return m;
}
function drawMarquee(cv, text, bg, fg) {
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 130);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 66;                                            // auto-fit: shrink until the name fits (no clipping)
  do { g.font = `bold ${size}px system-ui, sans-serif`; size -= 3; } while (g.measureText(text).width > 472 && size > 22);
  g.fillText(text, 256, 70);
}
function marqueeMat(text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 130;
  drawMarquee(cv, text, bg, fg);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0, roughness: 0.6 });
  mat.userData = { cv, tex };
  return mat;
}
const CREAM = 0xf3e9f0;
const bodyMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.7, metalness: 0.05 });

// --- Hero: detailed lower cabinet — body, control console, prize chute, feet, glass frame ---
const accent = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.5, metalness: 0.12 });  // pink frame
const darkMat = new THREE.MeshStandardMaterial({ color: 0x221030, roughness: 0.6 });
const BF = CAB.z + CAB.half + 0.36;                                                                    // base front face
visBox(CAB.x, FLOOR_Y / 2, CAB.z, CAB.half + 0.35, FLOOR_Y / 2, CAB.half + 0.35, bodyMat);            // base body
visBox(CAB.x, FLOOR_Y - 0.1, CAB.z, CAB.half + 0.42, 0.14, CAB.half + 0.42, accent);                  // rail at base/glass seam
for (const fx of [-1, 1]) for (const fz of [-1, 1]) visBox(CAB.x + fx * (CAB.half + 0.16), 0.13, CAB.z + fz * (CAB.half + 0.16), 0.16, 0.13, 0.16, darkMat); // feet
// glass-window bottom frame (all four sides)
for (const pz of [-1, 1]) visBox(CAB.x, FLOOR_Y - 0.02, CAB.z + pz * (CAB.half + 0.05), CAB.half + 0.12, 0.1, 0.08, accent);
for (const px of [-1, 1]) visBox(CAB.x + px * (CAB.half + 0.05), FLOOR_Y - 0.02, CAB.z, 0.08, 0.1, CAB.half + 0.12, accent);
// --- prize chute + collection bin (front-center, below the console): won prizes drop in and pile up, fully visible ---
const G_BIN = 16, G_COLLECTED = 32;
const BIN = { x: CAB.x, z: CAB.z + CAB.half + 1.0, floorY: 0.45, hx: 0.82, hz: 0.5, topY: 1.6 };
const binClear = new THREE.MeshStandardMaterial({ color: 0xbfe9f5, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.1, depthWrite: false });
const binDark = new THREE.MeshStandardMaterial({ color: 0x140a20, roughness: 0.5 });
function binWall(cx, cy, cz, hx, hy, hz, mat) {
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), collisionFilterGroup: G_BIN, collisionFilterMask: G_COLLECTED });
  body.position.set(cx, cy, cz); world.addBody(body);
  const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), mat); m.position.set(cx, cy, cz); scene.add(m);
}
const binCY = (BIN.floorY + BIN.topY) / 2, binHY = (BIN.topY - BIN.floorY) / 2 + 0.05;
binWall(BIN.x, BIN.floorY - 0.05, BIN.z, BIN.hx + 0.06, 0.06, BIN.hz + 0.06, binDark);     // floor
binWall(BIN.x, binCY, BIN.z - BIN.hz, BIN.hx, binHY, 0.04, binClear);                      // back
binWall(BIN.x, binCY, BIN.z + BIN.hz, BIN.hx, binHY, 0.04, binClear);                      // front (clear window)
binWall(BIN.x - BIN.hx, binCY, BIN.z, 0.04, binHY, BIN.hz, binClear);                      // left
binWall(BIN.x + BIN.hx, binCY, BIN.z, 0.04, binHY, BIN.hz, binClear);                      // right
visBox(BIN.x, BIN.topY + 0.06, BIN.z, BIN.hx + 0.08, 0.05, BIN.hz + 0.08, accent);         // rim
const binGlowMat = emis(0xffe14a, 0.0);                                                    // pulses on GET
visBox(BIN.x, BIN.topY + 0.06, BIN.z + BIN.hz + 0.05, BIN.hx + 0.06, 0.06, 0.02, binGlowMat);
visBox(BIN.x, BIN.topY + 0.28, BIN.z, 0.62, 0.13, 0.02, marqueeMat('경품 배출구', '#2a0a1a', '#ffd34d'));
let binFlash = 0;
const collectedList = [];
function rmBody(b) { const i = world.bodies.indexOf(b); if (i !== -1) world.removeBody(b); }
function collectIntoBin(f) {
  const b = f.body; b.wakeUp();
  b.position.set(BIN.x + (Math.random() - 0.5) * 0.7, BIN.topY - 0.05, BIN.z + (Math.random() - 0.5) * 0.4); // emerge at the chute mouth
  b.velocity.set(0, -1.0, 0); b.angularVelocity.set(0, 0, 0);                              // fall into the bin (visible)
  b.collisionFilterGroup = G_COLLECTED; b.collisionFilterMask = G_BIN | G_COLLECTED;
  collectedList.push(f); binFlash = 1;
  if (collectedList.length > 10) { const old = collectedList.shift(); rmBody(old.body); scene.remove(old.mesh); old.gone = true; }
}
// --- front control console (slanted, toward the player) ---
const FZ = CAB.z + CAB.half + 0.5;
const consoleTop = visBox(CAB.x, FLOOR_Y - 0.5, FZ + 0.28, 2.25, 0.14, 0.44, bodyMat); consoleTop.rotation.x = -0.34;
visBox(CAB.x, FLOOR_Y - 0.96, FZ + 0.1, 2.25, 0.5, 0.14, accent);                                     // console skirt
const joyStick = new THREE.Group(); joyStick.position.set(CAB.x + 1.4, FLOOR_Y - 0.42, FZ + 0.34); scene.add(joyStick); // tilts with input
const joyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 10), emis(0xff3d7f, 0.7)); joyShaft.position.y = 0.25; joyStick.add(joyShaft);
const joyBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), emis(0xffe14a, 0.7)); joyBall.position.y = 0.52; joyStick.add(joyBall);
visBox(CAB.x + 0.62, FLOOR_Y - 0.5, FZ + 0.36, 0.12, 0.06, 0.12, emis(0xff2d2d, 0.5));                 // button (red)
visBox(CAB.x + 0.28, FLOOR_Y - 0.5, FZ + 0.36, 0.12, 0.06, 0.12, emis(0x36a0ff, 0.5));                 // button (blue)
const disp = visBox(CAB.x - 0.28, FLOOR_Y - 0.5, FZ + 0.36, 0.5, 0.13, 0.02, marqueeMat('₩100  CR 1', '#04140e', '#7fffc0')); disp.rotation.x = -0.34; // credit display
visBox(CAB.x - 0.92, FLOOR_Y - 0.52, FZ + 0.34, 0.2, 0.1, 0.13, emis(0x14385e, 0.4));                  // card reader
visBox(CAB.x - 0.92, FLOOR_Y - 0.47, FZ + 0.4, 0.14, 0.02, 0.02, emis(0x6cf0ff, 0.7));                 // card slot glow
visBox(CAB.x - 1.42, FLOOR_Y - 0.42, FZ + 0.34, 0.04, 0.16, 0.02, darkMat);                            // coin slot
visBox(CAB.x - 1.42, FLOOR_Y - 0.8, FZ + 0.28, 0.16, 0.1, 0.1, darkMat);                               // coin return

// --- Hero: neon corner strips + LED halo + marquee ---
const neonMats = [];
for (const px of [-1, 1]) for (const pz of [-1, 1]) {
  const m = emis(0xff2d8f, 1.5); neonMats.push(m);
  visBox(CAB.x + px * (CAB.half + 0.06), wallY, CAB.z + pz * (CAB.half + 0.06), 0.07, wallH, 0.07, m);
}
const haloMat = emis(0x36e0ff, 1.3);
visBox(CAB.x, wallY + wallH, CAB.z + CAB.half, CAB.half, 0.08, 0.08, haloMat);
visBox(CAB.x, wallY + wallH, CAB.z - CAB.half, CAB.half, 0.08, 0.08, haloMat);
visBox(CAB.x + CAB.half, wallY + wallH, CAB.z, 0.08, 0.08, CAB.half, haloMat);
visBox(CAB.x - CAB.half, wallY + wallH, CAB.z, 0.08, 0.08, CAB.half, haloMat);
const marqueeY = wallY + wallH + 0.55;
const heroMarquee = marqueeMat('POTATO CATCHER', '#2a0a3a', '#ffe14a');
visBox(CAB.x, marqueeY, CAB.z, CAB.half + 0.45, 0.6, CAB.half + 0.45, bodyMat);                       // housing
const M = CAB.half + 0.47, MH = 0.5;                                                                   // illuminated signs on 4 faces
visBox(CAB.x, marqueeY, CAB.z + M, CAB.half + 0.35, MH, 0.04, heroMarquee);
visBox(CAB.x, marqueeY, CAB.z - M, CAB.half + 0.35, MH, 0.04, heroMarquee);
visBox(CAB.x + M, marqueeY, CAB.z, 0.04, MH, CAB.half + 0.35, heroMarquee);
visBox(CAB.x - M, marqueeY, CAB.z, 0.04, MH, CAB.half + 0.35, heroMarquee);

// --- Arcade aisle floor (dark, faintly reflective) ---
const aisle = new THREE.Mesh(new THREE.PlaneGeometry(140, 140),
  new THREE.MeshStandardMaterial({ color: 0x0d0717, roughness: 0.35, metalness: 0.45 }));
aisle.rotation.x = -Math.PI / 2; scene.add(aisle);

// --- A receding row of glowing neighbor machines ---
function makeNeighbor(x, z, neon, name, bg, fg) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  visBox(0, FLOOR_Y / 2, 0, 1.7, FLOOR_Y / 2, 1.7, bodyMat, g);
  visBox(0, FLOOR_Y + 1.4, 0, 1.55, 1.4, 1.55,
    new THREE.MeshStandardMaterial({ color: 0xbfe9f5, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false }), g);
  const blobC = [0xff7ab8, 0xffd34d, 0x8fd3ff, 0xb98cff, 0xff9d5c];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), emis(blobC[i % 5], 0.55));
    b.position.set((i - 2) * 0.55, FLOOR_Y + 0.4 + (i % 2) * 0.5, ((i % 3) - 1) * 0.6); g.add(b);
  }
  for (const px of [-1, 1]) for (const pz of [-1, 1])
    visBox(px * 1.55, FLOOR_Y + 1.4, pz * 1.55, 0.07, 1.4, 0.07, emis(neon, 1.4), g);
  visBox(0, FLOOR_Y + 3.1, 0, 1.6, 0.5, 1.6, bodyMat, g);
  visBox(0, FLOOR_Y + 3.1, 0, 1.62, 0.4, 0.03, marqueeMat(name, bg, fg), g);
}
makeNeighbor(-7, -1.0, 0x36e0ff, 'UFO', '#10243a', '#7fe3ff');
makeNeighbor(7, -1.0, 0xffd34d, 'KUMA', '#3a2a08', '#ffe9a8');
makeNeighbor(-10.5, -6, 0xff2d8f, 'PUNI', '#3a0a22', '#ff9ecb');
makeNeighbor(10.5, -6, 0xb98cff, 'STAR', '#1f0a3a', '#d7c2ff');
makeNeighbor(0, -10, 0x8fff9d, 'GET', '#0a3a18', '#bfffc9');
makeNeighbor(-5.5, -13.5, 0xff7a3d, 'TOY', '#3a1a08', '#ffc9a0');
makeNeighbor(5.5, -13.5, 0x6cf0ff, 'POP', '#0a323a', '#bff4ff');

// --- Overhead neon bars ---
for (let i = 0; i < 5; i++) {
  visBox((i - 2) * 7, 12.5, -3 - i * 2.5, 4.5, 0.14, 0.3,
    emis([0xff2d8f, 0x36e0ff, 0xffd34d, 0xb98cff, 0x8fff9d][i], 1.1));
}

// --- Machines (PrizeSets): theme the cabinet + swap the prizes. Picked via machine-select / Q·E ---
function applyMachineTheme(set) {
  drawMarquee(heroMarquee.userData.cv, set.name, set.marqueeBg, set.marqueeFg); heroMarquee.userData.tex.needsUpdate = true;
  for (const m of neonMats) { m.color.setHex(set.neon); m.emissive.setHex(set.neon); }
  accent.color.setHex(set.accent);
}
function loadMachine(set) {
  currentSet = set;
  resetFries();                 // respawn with this machine's prizes (count + shape)
  applyMachineTheme(set);
}

// ---- The metal claw: kinematic hub + 3 kinematic animated fingers ----
const handPos = new THREE.Vector3(HOLE.x, HOVER_Y, HOLE.z);
const hub = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
hub.position.set(handPos.x, handPos.y, handPos.z);
world.addBody(hub);
const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.44, 18),
  new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.7, roughness: 0.32 }));
scene.add(hubMesh);
const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 12),
  new THREE.MeshStandardMaterial({ color: 0x6b7178, metalness: 0.6, roughness: 0.4 }));
scene.add(rodMesh);

const UP = new THREE.Vector3(0, 1, 0);
const prongs = [];
for (let i = 0; i < 3; i++) {
  const ang = i * (Math.PI * 2 / 3) + Math.PI / 6;
  const c = Math.cos(ang), s = Math.sin(ang);
  const d = new THREE.Vector3(c, 0, s);              // radial (outward)
  const ax = new THREE.Vector3(-s, 0, c);            // tangential (hinge axis)
  const qOrient = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, UP, ax));
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: clawMat,
    collisionFilterGroup: G_CLAW, collisionFilterMask: G_SOLID | G_FRY }); // claw shoves pile, ignores held
  body.addShape(new CANNON.Box(new CANNON.Vec3(FINGER_R, FINGER_LEN / 2, FINGER_R)));
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.26, FINGER_R, FINGER_R)),   // inward foot at the tip
    new CANNON.Vec3(-0.26, -FINGER_LEN / 2 + FINGER_R, 0));
  world.addBody(body);
  const mesh = new THREE.Group();
  const fingerMesh = new THREE.Mesh(new THREE.BoxGeometry(FINGER_R * 2, FINGER_LEN, FINGER_R * 2),
    new THREE.MeshStandardMaterial({ color: 0xc2c9d2, metalness: 0.66, roughness: 0.32 }));
  const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, FINGER_R * 2, FINGER_R * 2),
    new THREE.MeshStandardMaterial({ color: 0xb6bdc7, metalness: 0.66, roughness: 0.32 }));
  footMesh.position.set(-0.26, -FINGER_LEN / 2 + FINGER_R, 0);
  mesh.add(fingerMesh, footMesh);
  scene.add(mesh);
  prongs.push({ body, mesh, d, ax, qOrient, prev: new THREE.Vector3() });
}
let gripT = 0; // 0 open -> 1 closed

// Place every prong from handPos + current gripT; set kinematic velocity for pile contact.
const _tmpV = new THREE.Vector3(), _tmpC = new THREE.Vector3(), _qZ = new THREE.Quaternion();
const ZAXIS = new THREE.Vector3(0, 0, 1);
function placeProngs(dt) {
  const theta = OPEN_ANG + (CLOSE_ANG - OPEN_ANG) * gripT;
  const sinT = Math.sin(theta), cosT = Math.cos(theta), half = FINGER_LEN / 2;
  _qZ.setFromAxisAngle(ZAXIS, theta);
  for (const p of prongs) {
    const ppiv = _tmpV.copy(p.d).multiplyScalar(R_ATTACH).add(handPos);    // pivot on hub
    const local = _tmpC.set(half * sinT, -half * cosT, 0).applyQuaternion(p.qOrient);
    const px = ppiv.x + local.x, py = ppiv.y + local.y, pz = ppiv.z + local.z;
    if (dt > 0) p.body.velocity.set((px - p.prev.x) / dt, (py - p.prev.y) / dt, (pz - p.prev.z) / dt);
    p.body.position.set(px, py, pz);
    p.prev.set(px, py, pz);
    p.body.quaternion.copy(p.qOrient).mult(_qZ);
    p.mesh.position.copy(p.body.position);
    p.mesh.quaternion.copy(p.body.quaternion);
  }
}

// ---- Prizes ----
const fries = [];
function spawnFries(n) {
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const value = rollValue(r);
    const mass = prizeMass(value);                          // heavier prize = harder to hold
    const h = currentSet.half;
    const body = new CANNON.Body({ mass, material: fryMat,
      shape: new CANNON.Box(new CANNON.Vec3(h.x, h.y, h.z)),
      collisionFilterGroup: G_FRY, collisionFilterMask: G_SOLID | G_FRY | G_CLAW | G_HELD });
    body.sleepSpeedLimit = 0.2; body.sleepTimeLimit = 0.5;
    body.position.set(
      CAB.x + (Math.random() - 0.5) * 3.2,
      FLOOR_Y + 0.6 + Math.random() * 2.8,
      CAB.z + (Math.random() - 0.5) * 2.6 + 0.7
    );
    body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    world.addBody(body);
    const mesh = currentSet.makeMesh();
    scene.add(mesh);
    const fry = new Prize(body, mesh);
    fry.value = value; fry.delivered = false;
    if (value > 1) mesh.traverse((o) => {
      if (o.material && o.material.emissive) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(value === 5 ? 0xffcc33 : 0xff7a1f);
        o.material.emissiveIntensity = value === 5 ? 0.5 : 0.28;
      }
    });
    fries.push(fry);
  }
}
spawnFries(currentSet.spawn);

// ---- Juice ----
const elFlash = document.getElementById('flash'), elPop = document.getElementById('pop');
function flash() { if (elFlash) { elFlash.style.opacity = '1'; setTimeout(() => (elFlash.style.opacity = '0'), 130); } }
function popScore(n) {
  if (!elPop) return;
  elPop.textContent = '+' + n; elPop.classList.remove('show'); void elPop.offsetWidth; elPop.classList.add('show');
}

// ---- Grip springs (the heart): caught fries are held by a stretchy grip that can snap ----
const held = []; // { fry, anchor:THREE.Vector3 (hub-local), k, breakDist }
const slipLog = []; let maxStretch = 0;
function tryGrab() {
  // Cage check: fries near claw center & near the tip height. Empty -> catch nothing.
  const tipY = handPos.y - FINGER_LEN * 0.9;
  const cand = [];
  for (const f of fries) {
    if (f.delivered || held.some((h) => h.fry === f)) continue;
    const p = f.body.position;
    const dx = p.x - handPos.x, dz = p.z - handPos.z;
    const dr = Math.hypot(dx, dz);
    if (dr < GRIP_R && Math.abs(p.y - tipY) < CAGE_BAND) cand.push({ f, dr });
  }
  cand.sort((a, b) => a.dr - b.dr);
  const take = cand.slice(0, MAX_GRAB);
  const n = take.length;
  for (const { f, dr } of take) {
    const center = 1 - (dr / GRIP_R) * 0.55;                 // centered grab = firmer
    const k = K_BASE * center / n;                            // multi-grab splits grip budget
    const breakDist = gripBreakDist(center, f.value, n) + (Math.random() - 0.5) * 0.1;
    const anchor = new THREE.Vector3(f.body.position.x - hub.position.x,
      f.body.position.y - hub.position.y, f.body.position.z - hub.position.z);
    f.body.wakeUp();
    f.body.velocity.set(0, 0, 0);                            // arrest the bat from the closing fingers
    f.body.angularVelocity.set(0, 0, 0);
    f.body.collisionFilterGroup = G_HELD;                    // ignore claw, pile, and each other
    f.body.collisionFilterMask = G_SOLID;                    // only bonks the cabinet (walls)
    held.push({ fry: f, anchor, k, breakDist });
  }
  return n;
}
const _fpos = new THREE.Vector3(), _target = new THREE.Vector3(), _stretch = new THREE.Vector3();
function applyGripForces() {
  for (let i = held.length - 1; i >= 0; i--) {
    const h = held[i];
    _target.set(hub.position.x + h.anchor.x, hub.position.y + h.anchor.y, hub.position.z + h.anchor.z);
    _fpos.copy(h.fry.body.position);
    _stretch.subVectors(_fpos, _target);
    const dist = _stretch.length();
    if (dist > h.breakDist) {                                // grip exceeded -> SLIP
      h.fry.body.collisionFilterGroup = G_FRY;
      h.fry.body.collisionFilterMask = G_SOLID | G_FRY | G_CLAW | G_HELD;
      slipLog.push({ state, dist: +dist.toFixed(2), v: h.fry.value }); if (slipLog.length > 40) slipLog.shift();
      held.splice(i, 1);
      slips++; flash(); camShake = 0.2; if (audioReady) sfx.slip();
      continue;
    }
    if (dist > maxStretch) maxStretch = dist;
    const b = h.fry.body, v = b.velocity, hv = hub.velocity;
    b.applyForce(new CANNON.Vec3(
      -h.k * _stretch.x - DAMP * (v.x - hv.x),
      -h.k * _stretch.y - DAMP * (v.y - hv.y),
      -h.k * _stretch.z - DAMP * (v.z - hv.z)), b.position);
  }
}

// ---- Input: commit aiming ----
const keys = {};
let audioReady = false;
addEventListener('keydown', (e) => {
  if (!audioReady) { sfx.init(); sfx.resume(); audioReady = true; }
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); startPlunge(); }
  if (e.code === 'KeyE') loadMachine(PRIZE_SETS[(PRIZE_SETS.indexOf(currentSet) + 1) % PRIZE_SETS.length]);
  if (e.code === 'KeyQ') loadMachine(PRIZE_SETS[(PRIZE_SETS.indexOf(currentSet) + PRIZE_SETS.length - 1) % PRIZE_SETS.length]);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---- State machine ----
let state = 'aim', stateT = 0;
let score = 0, slips = 0, drops = 0, delivered = 0;
let started = false;                     // gated behind the coin/card payment screen
const aimVec = { x: 0, z: 0 };           // analog joystick input (-1..1)
function startPlunge() { if (started && state === 'aim') { state = 'plunge'; stateT = 0; drops++; } }
function approach(cur, target, speed, dt) { const d = target - cur, st = speed * dt; return Math.abs(d) <= st ? target : cur + Math.sign(d) * st; }

// Position the claw over the chute so the prize (hanging at its grab offset) drops INTO the hole.
let returnX = HOLE.x, returnZ = HOLE.z;
function computeReturnTarget() {
  if (!held.length) { returnX = HOLE.x; returnZ = HOLE.z; return; }
  let ax = 0, az = 0;
  for (const h of held) { ax += h.anchor.x; az += h.anchor.z; }
  ax /= held.length; az /= held.length;
  returnX = THREE.MathUtils.clamp(HOLE.x - ax, CAB.x - CAB.half + 0.6, CAB.x + CAB.half - 0.6);
  returnZ = THREE.MathUtils.clamp(HOLE.z - az, CAB.z - CAB.half + 0.6, CAB.z + CAB.half - 0.6);
}

function releaseAll() {
  for (const h of held) {
    h.fry.body.wakeUp();
    h.fry.body.velocity.set(0, 0, 0);                       // drop straight down — no fling
    h.fry.body.angularVelocity.set(0, 0, 0);
    h.fry.body.collisionFilterGroup = G_FRY;
    h.fry.body.collisionFilterMask = G_SOLID | G_FRY;        // ignore the opening claw on the way down
  }
  held.length = 0;
}
function checkDeliveries() {
  for (const f of fries) {
    if (f.delivered) continue;
    const p = f.body.position;
    if (Math.abs(p.x - HOLE.x) < HOLE.half + 0.3 && Math.abs(p.z - HOLE.z) < HOLE.half + 0.3 && p.y < FLOOR_Y - 0.7) {
      f.delivered = true; score += f.value; delivered++;
      popScore(f.value); camShake = 0.12; if (audioReady) sfx.get();
      collectIntoBin(f);                                    // drop it into the visible collection bin
    }
  }
}

// ---- Loop ----
const elScore = document.getElementById('r-score'), elHeld = document.getElementById('r-held');
const elSlip = document.getElementById('r-slip'), elTime = document.getElementById('r-time');
const elGot = document.getElementById('r-got');
const PHASE = { aim: '조준 ←→ ↑↓', plunge: '내려가는 중', close: '집는 중', lift: '올리는 중', return: '배출구로', open: '놓는 중' };
let timeLeft = ROUND_SEC, last = performance.now();
const _handPrev = new THREE.Vector3().copy(handPos);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  stateT += dt;
  if (started && timeLeft > 0) { timeLeft = tickTime(timeLeft, dt); if (timeLeft === 0) endGame(); }
  if (keys.BracketLeft) { camState.az += 1.1 * dt; camGoal.az = camState.az; }
  if (keys.BracketRight) { camState.az -= 1.1 * dt; camGoal.az = camState.az; }

  if (state === 'aim') {
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
    gripT = Math.max(0, gripT - dt * 3);
    if (started && timeLeft > 0) {                            // free aim: analog joystick + arrow keys
      const mx = aimVec.x + (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
      const mz = aimVec.z + (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
      handPos.x = THREE.MathUtils.clamp(handPos.x + mx * AIM_SPEED * dt, CAB.x - CAB.half + 0.6, CAB.x + CAB.half - 0.6);
      handPos.z = THREE.MathUtils.clamp(handPos.z + mz * AIM_SPEED * dt, CAB.z - CAB.half + 0.6, CAB.z + CAB.half - 0.6);
    }
  } else if (state === 'plunge') {
    handPos.y = approach(handPos.y, PLUNGE_Y, PLUNGE_SPEED, dt);
    if (handPos.y <= PLUNGE_Y + 0.01) { state = 'close'; stateT = 0; if (audioReady) sfx.place(); }
  } else if (state === 'close') {
    gripT = Math.min(1, gripT + dt * 1.7);
    if (gripT >= 1 && stateT > 0.4) {
      const got = tryGrab();
      state = 'lift'; stateT = 0;
      if (audioReady) sfx.grab();
      if (got === 0 && audioReady) { /* whiff */ }
    }
  } else if (state === 'lift') {
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
    if (handPos.y >= HOVER_Y - 0.01) { computeReturnTarget(); state = 'return'; stateT = 0; }
  } else if (state === 'return') {
    handPos.x = approach(handPos.x, returnX, RETURN_SPEED, dt);
    handPos.z = approach(handPos.z, returnZ, RETURN_SPEED, dt);
    if (Math.abs(handPos.x - returnX) < 0.02 && Math.abs(handPos.z - returnZ) < 0.02) { state = 'open'; stateT = 0; }
  } else if (state === 'open') {
    gripT = Math.max(0, gripT - dt * 3);
    if (stateT > 0.15 && held.length) releaseAll();
    if (stateT > 0.9) { state = 'aim'; stateT = 0; }
  }

  if (dt > 0) hub.velocity.set((handPos.x - _handPrev.x) / dt, (handPos.y - _handPrev.y) / dt, (handPos.z - _handPrev.z) / dt);
  _handPrev.copy(handPos);
  hub.position.set(handPos.x, handPos.y, handPos.z);
  placeProngs(dt);
  applyGripForces();
  world.step(1 / 60, dt, 3);

  hubMesh.position.copy(handPos);
  rodMesh.position.set(handPos.x, (handPos.y + 12.5) / 2, handPos.z);
  rodMesh.scale.y = Math.max(0.1, 12.5 - handPos.y);
  for (const f of fries) {
    if (f.gone) continue;
    if (!f.delivered) {                                     // play-area fries: anti-tunnel + stray recycle
      const v = f.body.velocity, sp = v.length();
      if (sp > 10) v.scale(10 / sp, v);
      const p = f.body.position;
      if ((p.y < -2 || Math.abs(p.x) > CAB.half + 0.5 || Math.abs(p.z) > CAB.half + 0.5) && !held.some((h) => h.fry === f)) {
        f.body.position.set(CAB.x + (Math.random() - 0.5) * 3, FLOOR_Y + 3, CAB.z + (Math.random() - 0.5) * 2);
        f.body.velocity.set(0, 0, 0); f.body.angularVelocity.set(0, 0, 0);
        f.body.collisionFilterGroup = G_FRY; f.body.collisionFilterMask = G_SOLID | G_FRY | G_CLAW | G_HELD;
      }
    }
    f.sync();                                               // sync ALL (collected prizes track into the bin too)
  }
  checkDeliveries();
  if (binFlash > 0) { binFlash = Math.max(0, binFlash - dt * 2); binGlowMat.emissiveIntensity = binFlash * 1.8; } // GET pulse

  reticle.position.set(handPos.x, FLOOR_Y + 0.04, handPos.z);
  reticle.material.color.setHex(state === 'aim' ? 0xffe14a : 0x888888);
  reticle.visible = state === 'aim';
  joyStick.rotation.z = -aimVec.x * 0.5;                     // cabinet joystick leans with input
  joyStick.rotation.x = aimVec.z * 0.5;

  updateCamera(dt);
  renderer.render(scene, camera);

  elScore.textContent = score;
  elHeld.textContent = (held.length ? `잡음 ×${held.length} · ` : '') + (PHASE[state] || '-');
  elSlip.textContent = slips;
  elGot.textContent = delivered;
  elTime.textContent = Math.ceil(timeLeft);
  elTime.style.color = timeLeft <= 10 ? '#ff5a4a' : '#ffd479';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ===================== Arcade: coin/card payment, start/replay, touch joystick =====================
let actx = null;
function beep(freq, dur, type, vol, when) {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + (when || 0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch (e) { /* no audio */ }
}
const coinSfx = () => { beep(900, 0.05, 'square', 0.18, 0); beep(1350, 0.07, 'square', 0.16, 0.05); beep(640, 0.13, 'triangle', 0.14, 0.13); };
const cardSfx = () => { beep(1500, 0.05, 'sine', 0.2, 0); beep(2050, 0.08, 'sine', 0.18, 0.08); };
const startSfx = () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.13, 'square', 0.18, i * 0.08)); };

const elStart = document.getElementById('start'), elGameover = document.getElementById('gameover');
const elPad = document.getElementById('pad'), elCredit = document.getElementById('credit'), elStartBtn = document.getElementById('startbtn');
const elFinal = document.getElementById('final-score'), payCoin = document.getElementById('pay-coin'), payCard = document.getElementById('pay-card'), coinEl = document.getElementById('coin');
const elMachineSelect = document.getElementById('machineselect'), elPayTitle = document.getElementById('pay-title'), elPaySub = document.getElementById('pay-sub');
let credited = false, firstGame = true;

function ensureAudio() { if (!audioReady) { try { sfx.init(); sfx.resume(); } catch (e) { /* */ } audioReady = true; } }
function addCredit(kind) {
  ensureAudio();
  if (kind === 'coin') { coinEl.classList.remove('drop'); void coinEl.offsetWidth; coinEl.classList.add('drop'); payCoin.classList.add('done'); coinSfx(); }
  else { payCard.classList.add('done'); cardSfx(); }
  if (!credited) { credited = true; elCredit.textContent = 'CREDIT  1'; elStartBtn.classList.add('on'); }
}
if (payCoin) payCoin.addEventListener('click', () => addCredit('coin'));
if (payCard) payCard.addEventListener('click', () => addCredit('card'));
if (elStartBtn) elStartBtn.addEventListener('click', () => { if (credited) startGame(); });
const replayBtn = document.getElementById('replay');
if (replayBtn) replayBtn.addEventListener('click', () => {
  credited = false; elCredit.textContent = ''; elStartBtn.classList.remove('on');
  payCoin.classList.remove('done'); payCard.classList.remove('done');
  elGameover.classList.add('off'); elMachineSelect.classList.remove('off');  // back to machine select
});

// Machine select: build a card per PrizeSet; pick -> load that machine + go to payment.
const cardsEl = document.getElementById('machinecards');
if (cardsEl) PRIZE_SETS.forEach((set) => {
  const c = document.createElement('div'); c.className = 'mcard';
  c.style.borderColor = '#' + set.neon.toString(16).padStart(6, '0');
  c.innerHTML = `<div class="ico">${set.emoji}</div><div class="t">${set.name}</div><div class="s">${set.sub}</div><div class="go" style="background:${set.marqueeFg}">선택 ▶</div>`;
  c.addEventListener('click', () => {
    ensureAudio();
    loadMachine(set);
    elPayTitle.textContent = set.emoji + ' ' + set.name;
    elPaySub.textContent = set.sub + ' · CRANE GAME';
    elMachineSelect.classList.add('off'); elStart.classList.remove('off');
  });
  cardsEl.appendChild(c);
});

function resetFries() {
  held.length = 0;
  for (const f of fries) { if (!f.gone) { rmBody(f.body); scene.remove(f.mesh); } }
  fries.length = 0; collectedList.length = 0; binFlash = 0; binGlowMat.emissiveIntensity = 0;
  spawnFries(currentSet.spawn);
}
function startGame() {
  if (!firstGame) { resetFries(); score = 0; slips = 0; delivered = 0; drops = 0; }
  firstGame = false; credited = false; held.length = 0; gripT = 0;
  timeLeft = ROUND_SEC; started = true; state = 'aim'; stateT = 0;
  handPos.set(CAB.x, HOVER_Y, CAB.z); _handPrev.copy(handPos);
  elStart.classList.add('off'); elGameover.classList.add('off'); elMachineSelect.classList.add('off'); elPad.classList.add('on');
  startSfx();
}
function endGame() {
  started = false; elPad.classList.remove('on');
  let best = 0;
  try { best = +(localStorage.getItem('ppopgi_best') || 0); } catch (e) { /* */ }
  const isRecord = score > best;
  if (isRecord) { best = score; try { localStorage.setItem('ppopgi_best', String(best)); } catch (e) { /* */ } }
  elFinal.textContent = score;
  document.getElementById('final-got').textContent = delivered;
  document.getElementById('final-best').textContent = best;
  document.getElementById('final-record').textContent = isRecord ? '🎉 신기록!' : '시간 종료';
  elGameover.classList.remove('off');
}

// Analog on-screen joystick (touch + mouse via Pointer Events).
const joyEl = document.getElementById('joy'), knobEl = document.getElementById('knob'), dropEl = document.getElementById('drop');
const JOY_R = 46; let joyId = null;
function joyFrom(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy), m = d > 0 ? Math.min(1, d / JOY_R) : 0;
  if (d > 0) { dx = dx / d * m * JOY_R; dy = dy / d * m * JOY_R; }
  knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  aimVec.x = dx / JOY_R; aimVec.z = dy / JOY_R;              // up(-dy) = back(-z), down = front(+z)
}
function joyEnd(e) { if (joyId !== null && e.pointerId !== joyId) return; joyId = null; aimVec.x = 0; aimVec.z = 0; knobEl.style.transform = 'translate(-50%, -50%)'; }
if (joyEl) {
  joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (er) { /* */ } joyFrom(e); });
  joyEl.addEventListener('pointermove', (e) => { if (joyId === e.pointerId) joyFrom(e); });
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
}
if (dropEl) dropEl.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); startPlunge(); });

// Drag the scene to orbit the camera (judge depth like leaning around the machine).
const gameCanvas = document.getElementById('game');
let dragX = 0, dragY = 0, dragId = null;
if (gameCanvas) {
  gameCanvas.addEventListener('pointerdown', (e) => { camDrag = true; dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; });
  gameCanvas.addEventListener('pointermove', (e) => {
    if (!camDrag || e.pointerId !== dragId) return;
    const dx = e.clientX - dragX, dy = e.clientY - dragY; dragX = e.clientX; dragY = e.clientY;
    camState.az -= dx * 0.006;
    camState.pitch = THREE.MathUtils.clamp(camState.pitch + dy * 0.005, 0.05, 1.45);
    camGoal.az = camState.az; camGoal.pitch = camState.pitch; camGoal.r = camState.r; camGoal.ty = camState.ty;
  });
  const endDrag = (e) => { if (e.pointerId === dragId) { camDrag = false; dragId = null; } };
  gameCanvas.addEventListener('pointerup', endDrag); gameCanvas.addEventListener('pointercancel', endDrag);
}
// Preset angle buttons (정면/측면/위/기본).
document.querySelectorAll('#cambtns button').forEach((b) => b.addEventListener('click', () => setCamPreset(b.dataset.cam)));

// Verify / debug API.
window.__claw = {
  get score() { return score; }, get drops() { return drops; }, get delivered() { return delivered; },
  get slips() { return slips; }, get held() { return held.length; },
  get state() { return state; }, get handPos() { return handPos; },
  start() { startGame(); }, drop() { startPlunge(); }, setHand(x, z) { handPos.x = x; handPos.z = z; },
  end() { if (started) endGame(); }, get started() { return started; },
  setCam(name) { setCamPreset(name); }, get camPitch() { return camState.pitch; },
  piles() { return fries.filter((f) => !f.delivered).map((f) => ({ x: f.body.position.x, y: f.body.position.y, z: f.body.position.z, value: f.value })); },
  get slipLog() { return slipLog; }, get maxStretch() { return maxStretch; },
};
