// 뽑기 (ppopgi) — metal claw, real physics, conditional + breakable grip.
// Prongs physically close (kinematic, shove the pile). A spring "grip" holds caught
// prizes: it STRETCHES under weight/swing and SNAPS if you yank too hard or grab a
// heavy/multi load -> real slip ("잡았다… 미끄러진다"). Empty cage = catch nothing
// (no magic, not unconditional). Japanese-arcade dressing. Self-contained (no fry-tower deps).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Prize, PRIZE_SETS } from './prizes.js';
import { sfx } from './sfx.js';
import { rollValue, prizeMass, gripBreakDist, tickTime, comboMult } from './logic.js';

const currentSet = PRIZE_SETS[0]; // the single machine (JELLY CATCHER)

// ---- Tunables ----
const FLOOR_Y = 3.0;
const CAB = { x: 0, z: 0, half: 3.0 };
const HOLE = { x: -1.85, z: -1.85, half: 1.0 };
const FINGER_LEN = 1.9;
const OPEN_ANG = 0.4, CLOSE_ANG = -0.42;          // prong tilt: + splays out, - tips in
const HOVER_Y = 6.8, PLUNGE_Y = FLOOR_Y + 2.0;    // hub heights — rest INSIDE the glass (8.6 was above it = claw hidden), tips stop ~0.3 above the floor
const PLUNGE_SPEED = 2.8, LIFT_SPEED = 3.2, RETURN_SPEED = 2.2, AIM_SPEED = 3.6; // gentler plunge -> the prongs ease into the pile (no shove-pop)
const GRIP_R = 0.72, CAGE_BAND = 1.1, MAX_GRAB = 1; // SINGLE grab (only the closest prize -> never a clump/neighbor); GRIP_R is just aim forgiveness now
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
renderer.shadowMap.enabled = true;                     // prizes/claw cast shadows -> depth + realism (the flat look)
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x150a22);          // dark arcade hall
scene.fog = new THREE.Fog(0x150a22, 26, 64);           // the aisle fades into the distance
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.6, 200); // near 0.6 for depth precision (less z-fighting)
scene.add(new THREE.HemisphereLight(0x7a5aa6, 0x241038, 0.5)); // dim purple ambient
const sun = new THREE.DirectionalLight(0xfff0e0, 1.0);  // dominant enough that its cast shadows read on the floor
sun.position.set(6, 16, 7);
sun.castShadow = true;                                 // the shadow caster (directional -> one cheap shadow map)
sun.shadow.mapSize.set(1024, 1024);     // 1024 is plenty for the tight cabinet shadow camera — cheaper (mobile + render cost)
sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -3;
sun.shadow.camera.near = 2; sun.shadow.camera.far = 50;
sun.shadow.bias = -0.0007;
sun.target.position.set(CAB.x, FLOOR_Y, CAB.z);
scene.add(sun); scene.add(sun.target);
// Warm light INSIDE the hero cabinet so the prize area glows like a real UFO catcher.
const cabLight = new THREE.PointLight(0xffe7b2, 1.1, 18, 1.5);  // softened fill so the sun's shadows aren't washed out
cabLight.position.set(CAB.x, FLOOR_Y + 3.0, CAB.z);
scene.add(cabLight);
// A small light riding just under the claw so the metal prongs + the held prize stay readable
// even when the claw lifts above the cabinet light (sells the grip).
const clawLight = new THREE.PointLight(0xfff2d8, 1.7, 10, 1.6);
scene.add(clawLight);
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
};
const camState = { ...CAM_PRESETS.play };
const camGoal = { ...CAM_PRESETS.play };
let camShake = 0, camDrag = false;
const REDUCE_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; // a11y: suppress camera shake
function setCamPreset(name) { if (CAM_PRESETS[name]) Object.assign(camGoal, CAM_PRESETS[name]); }
function updateCamera(dt) {
  if (camShake > 0.001) camShake *= Math.pow(0.0015, dt);
  if (!camDrag) { const k = Math.min(1, dt * 6); for (const p of ['az', 'pitch', 'r', 'ty']) camState[p] += (camGoal[p] - camState[p]) * k; }
  const sx = REDUCE_MOTION ? 0 : (Math.random() - 0.5) * camShake, sy = REDUCE_MOTION ? 0 : (Math.random() - 0.5) * camShake;
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  camera.position.set(Math.sin(camState.az) * cp * camState.r + sx, camState.ty + sp * camState.r + sy, Math.cos(camState.az) * cp * camState.r);
  camera.lookAt(0, camState.ty, 0);
}
// audio handled by the sfx module

// ---- Physics ----
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 24;            // big boxes stacked deep -> more iterations for a stable, non-jittery pile
world.solver.tolerance = 0.002;
const fryMat = new CANNON.Material('fry');
const solidMat = new CANNON.Material('solid');
const clawMat = new CANNON.Material('claw');
// prize↔prize: no bounce + a soft, relaxed contact so a dense pile settles instead of exploding apart
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, fryMat, { friction: 0.5, restitution: 0.0, contactEquationStiffness: 5e6, contactEquationRelaxation: 4 }));
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, solidMat, { friction: 0.6, restitution: 0.02 }));
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, clawMat, { friction: 0.9, restitution: 0.0, contactEquationStiffness: 2.5e6, contactEquationRelaxation: 5 })); // soft claw contact -> prongs nudge, never squeeze-pop
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
  mesh.receiveShadow = opacity >= 1;                    // opaque solids (floor/body) catch prize shadows; glass doesn't
  scene.add(mesh);
  return body;
}

// Cabinet — floor with a back-left hole, glass walls, posts. (No solid base: the hole must drop through.)
const FLOORC = 0xefe6ee; // prize floor (tucked just under the cabinet's cream floor; cream body shows on top)
// Floor = two strips leaving the back-left hole uncovered (x<-0.85 & z<-0.85 open).
staticBox(0.95, FLOOR_Y - 1.06, 0, CAB.half - 0.85, 1.0, CAB.half, FLOORC);       // right strip (deep slab — top unchanged, extends down so nothing tunnels through)
staticBox(-1.95, FLOOR_Y - 1.06, 1.05, 1.05, 1.0, CAB.half - 1.05, FLOORC);       // left-front strip (deep slab)
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
staticBox(HOLE.x, FLOOR_Y - 1.9, HOLE.z, HOLE.half + 0.35, 0.6, HOLE.half + 0.35, 0x161616); // bin floor (deep — catches chute-fallers, nothing reaches y<-2)
const rim = new THREE.Mesh(new THREE.RingGeometry(HOLE.half * 0.6, HOLE.half + 0.22, 30),
  new THREE.MeshBasicMaterial({ color: 0x141414, side: THREE.DoubleSide }));
rim.rotation.x = -Math.PI / 2; rim.position.set(HOLE.x, FLOOR_Y + 0.02, HOLE.z); scene.add(rim);
// raised + bouncy LIP around the prize hole: a dropped prize can catch the edge and bounce OUT (miss) — real difficulty
const lipMatC = new CANNON.Material('lip');
world.addContactMaterial(new CANNON.ContactMaterial(fryMat, lipMatC, { friction: 0.45, restitution: 0.25 }));
const lipVis = new THREE.MeshStandardMaterial({ color: 0x2a1a38, roughness: 0.5, metalness: 0.55 }); // dark rim wall — recedes (not a red box)
const lipNeonMat = new THREE.MeshBasicMaterial({ color: 0x36e0ff }); // bright neon cap -> reads as a glowing chute opening
function lipWall(cx, cy, cz, hx, hy, hz) {
  const b = new CANNON.Body({ mass: 0, material: lipMatC, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
  b.position.set(cx, cy, cz); world.addBody(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), lipVis); m.position.set(cx, cy, cz); m.receiveShadow = true; scene.add(m);
  const n = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.03, 0.07, hz * 2 + 0.03), lipNeonMat); // neon rim cap on top of the wall
  n.position.set(cx, cy + hy + 0.04, cz); scene.add(n);
}
const LIP_Y = FLOOR_Y + 0.5, LIP_H = 0.5, LH = HOLE.half;  // tall walls (to FLOOR_Y+1.0) — block popped prizes from the hole; the claw still drops in from above
// dark inner shaft so the hole reads as a deep opening going down
const shaftMat = new THREE.MeshStandardMaterial({ color: 0x07040c, roughness: 1, side: THREE.DoubleSide });
for (const [dx, dz, w] of [[LH, 0, 0.04], [-LH, 0, 0.04], [0, LH, 0.04], [0, -LH, 0.04]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dx ? w : LH * 2, 0.9, dz ? w : LH * 2), shaftMat);
  m.position.set(HOLE.x + dx, FLOOR_Y - 0.4, HOLE.z + dz); scene.add(m);
}
lipWall(HOLE.x, LIP_Y, HOLE.z + LH, LH + 0.07, LIP_H, 0.07);    // inner +z edge (facing the pile)
lipWall(HOLE.x + LH, LIP_Y, HOLE.z, 0.07, LIP_H, LH + 0.07);    // inner +x edge
lipWall(HOLE.x, LIP_Y, HOLE.z - LH, LH + 0.07, LIP_H, 0.07);    // back edge
lipWall(HOLE.x - LH, LIP_Y, HOLE.z, 0.07, LIP_H, LH + 0.07);    // left edge

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
  m.position.set(cx, cy, cz); m.receiveShadow = !mat.transparent; parent.add(m); return m;
}
function drawMarquee(cv, text, bg, fg) {
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 130);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 66;                                            // auto-fit: shrink until the name fits (no clipping)
  do { g.font = `bold ${size}px system-ui, sans-serif`; size -= 3; } while (g.measureText(text).width > 472 && size > 22);
  g.shadowColor = fg; g.shadowBlur = 24;                    // neon halo
  g.fillStyle = fg; g.fillText(text, 256, 70); g.fillText(text, 256, 70); // double-pass = stronger glow
  g.shadowBlur = 0; g.globalAlpha = 0.9; g.fillStyle = '#ffffff'; g.fillText(text, 256, 70); g.globalAlpha = 1; // white-hot core
}
function marqueeMat(text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 130;
  drawMarquee(cv, text, bg, fg);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.45, roughness: 0.6 });
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
const BIN = { x: CAB.x, z: CAB.z + CAB.half + 0.9, floorY: 0.45, hx: 0.82, hz: 0.5, topY: 1.6 }; // back wall meets the cabinet front
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
// 배출구 (visible outlet on the cabinet front, at the bin's back — prizes emerge here)
const OUT_Z = BIN.z - BIN.hz - 0.02;
visBox(BIN.x, 1.42, OUT_Z - 0.04, 0.52, 0.44, 0.04, accent);                               // outlet frame
visBox(BIN.x, 1.42, OUT_Z, 0.42, 0.34, 0.03, binDark);                                     // dark opening
const outLip = visBox(BIN.x, 1.2, OUT_Z + 0.24, 0.4, 0.04, 0.28, binDark); outLip.rotation.x = 0.55; // chute lip into the bin
visBox(BIN.x, BIN.topY + 0.06, BIN.z, BIN.hx + 0.08, 0.05, BIN.hz + 0.08, accent);         // rim
const binGlowMat = emis(0xffe14a, 0.0);                                                    // pulses on GET
visBox(BIN.x, BIN.topY + 0.06, BIN.z + BIN.hz + 0.05, BIN.hx + 0.06, 0.06, 0.02, binGlowMat);
visBox(BIN.x, BIN.topY + 0.28, BIN.z, 0.62, 0.13, 0.02, marqueeMat('경품 배출구', '#2a0a1a', '#ffd34d'));
let binFlash = 0;
const collectedList = [];
function rmBody(b) { const i = world.bodies.indexOf(b); if (i !== -1) world.removeBody(b); }
function collectIntoBin(f) {
  const b = f.body; b.wakeUp();
  b.position.set(BIN.x + (Math.random() - 0.5) * 0.35, 1.45, BIN.z - BIN.hz + 0.18);       // emerge from the 배출구 (back)
  b.velocity.set(0, -0.4, 1.0); b.angularVelocity.set(0, 0, 0);                            // slide out of the outlet into the bin (visible)
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
for (const px of [-1, 1]) for (const pz of [-1, 1]) {
  visBox(CAB.x + px * (CAB.half + 0.06), wallY, CAB.z + pz * (CAB.half + 0.06), 0.07, wallH, 0.07, emis(0xff2d8f, 1.5));
}
const haloMat = emis(0x36e0ff, 1.3);
visBox(CAB.x, wallY + wallH, CAB.z + CAB.half, CAB.half, 0.08, 0.08, haloMat);
visBox(CAB.x, wallY + wallH, CAB.z - CAB.half, CAB.half, 0.08, 0.08, haloMat);
visBox(CAB.x + CAB.half, wallY + wallH, CAB.z, 0.08, 0.08, CAB.half, haloMat);
visBox(CAB.x - CAB.half, wallY + wallH, CAB.z, 0.08, 0.08, CAB.half, haloMat);
const marqueeY = wallY + wallH + 0.55;
const heroMarquee = marqueeMat(currentSet.name, currentSet.marqueeBg, currentSet.marqueeFg);
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

// ---- The metal claw: kinematic hub + 3 kinematic animated fingers ----
const handPos = new THREE.Vector3(HOLE.x, HOVER_Y, HOLE.z);   // aim target (input-driven)
const clawPos = new THREE.Vector3().copy(handPos);            // ACTUAL claw position — swings/lags handPos (고리 흔들림)
const bob = { x: handPos.x, z: handPos.z, vx: 0, vz: 0 };     // pendulum sway state
const SWAY_K = 84, SWAY_DAMP = 10.5;                          // claw swing stiffness / damping (settles faster -> more accurate aim)
function swayed() { return Math.abs(bob.x - handPos.x) < 0.07 && Math.abs(bob.z - handPos.z) < 0.07 && Math.hypot(bob.vx, bob.vz) < 0.25; }
const hub = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
hub.position.set(handPos.x, handPos.y, handPos.z);
world.addBody(hub);
// chrome housing where the arms hinge + the cable attaches (the claw "head")
const clawHeadMat = new THREE.MeshStandardMaterial({ color: 0xd9dee7, metalness: 0.88, roughness: 0.18, emissive: 0x2e3640, emissiveIntensity: 0.5 });
const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.42, 20), clawHeadMat);
hubMesh.castShadow = true;
scene.add(hubMesh);
const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 16), clawHeadMat); // swivel collar the arms hinge on
collarMesh.castShadow = true; scene.add(collarMesh);
// thin CABLE the claw dangles from (not a thick rod)
const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8),
  new THREE.MeshStandardMaterial({ color: 0x9097a1, metalness: 0.4, roughness: 0.5 }));
scene.add(rodMesh);

// ---- 2 curved CLAW ARMS (the 갈고리): a chrome tube that bows OUT then hooks IN to a rounded tip ----
const UP = new THREE.Vector3(0, 1, 0);
const ARM_PIVOT_R = 0.12;                                   // arms hinge near the head center -> a compact pincer
const clawArmMat = new THREE.MeshStandardMaterial({ color: 0xe1e6ee, metalness: 0.9, roughness: 0.16, emissive: 0x2e3640, emissiveIntensity: 0.5 });
function makeClawArm() {
  const pts = [new THREE.Vector3(0.02, 0.06, 0), new THREE.Vector3(0.17, -0.36, 0), new THREE.Vector3(0.33, -0.86, 0),
    new THREE.Vector3(0.30, -1.30, 0), new THREE.Vector3(0.12, -1.58, 0), new THREE.Vector3(0.25, -1.72, 0)]; // bow out, hook in
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.065, 8, false), clawArmMat);
  tube.castShadow = true; g.add(tube);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), clawArmMat); // rounded hook end
  tip.position.copy(pts[pts.length - 1]); tip.castShadow = true; g.add(tip);
  return g;
}
const prongs = [];
for (let i = 0; i < 3; i++) {
  const ang = i * (Math.PI * 2 / 3) + Math.PI / 6;    // 3 curved arms at 120° (one toward the player, two back)
  const c = Math.cos(ang), s = Math.sin(ang);
  const d = new THREE.Vector3(c, 0, s);              // the arm bows this way
  const ax = new THREE.Vector3(-s, 0, c);            // hinge axis (tangential)
  const qOrient = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, UP, ax));
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: clawMat,
    collisionFilterGroup: G_CLAW, collisionFilterMask: G_SOLID }); // approx box (prongs only avoid walls; cage-grab is proximity)
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.14, FINGER_LEN / 2, 0.14)));
  world.addBody(body);
  const mesh = makeClawArm();
  scene.add(mesh);
  prongs.push({ body, mesh, d, ax, qOrient, prev: new THREE.Vector3() });
}
const clawTiltQ = new THREE.Quaternion();                   // pendulum dangle tilt (흔들흔들) — set in the loop
let gripT = 0; // 0 open -> 1 closed
// Prongs close ~90% (the curved hooks come together around the prize); the grab itself is the
// proximity cage. Constant now (was a per-machine fn back when prize sizes differed).
const GRIP_CLOSE = 0.9;

// Place every prong from handPos + current gripT; set kinematic velocity for pile contact.
const _tmpV = new THREE.Vector3(), _tmpC = new THREE.Vector3(), _qZ = new THREE.Quaternion();
const ZAXIS = new THREE.Vector3(0, 0, 1);
const _armQ = new THREE.Quaternion(), _tiltE = new THREE.Euler(), _cabBot = new THREE.Vector3(), _cabTop = new THREE.Vector3(), _cabDir = new THREE.Vector3();
function placeProngs(dt) {
  // prongs visibly loosen (open) as the grip strains past ~0.78 -> you SEE the slip coming
  const theta = OPEN_ANG + (CLOSE_ANG - OPEN_ANG) * gripT + (gripStress > 0.78 ? (gripStress - 0.78) * 0.9 : 0);
  _qZ.setFromAxisAngle(ZAXIS, theta);
  for (const p of prongs) {
    const pivOff = _tmpC.copy(p.d).multiplyScalar(ARM_PIVOT_R).applyQuaternion(clawTiltQ); // hinge offset, tilted with the claw
    const ppiv = _tmpV.copy(pivOff).add(clawPos);
    if (dt > 0) p.body.velocity.set((ppiv.x - p.prev.x) / dt, (ppiv.y - p.prev.y) / dt, (ppiv.z - p.prev.z) / dt);
    p.body.position.copy(ppiv);
    p.prev.copy(ppiv);
    // arm = head tilt (sway)  ×  arm orientation  ×  open/close angle
    _armQ.copy(clawTiltQ).multiply(p.qOrient).multiply(_qZ);
    p.body.quaternion.copy(_armQ);
    p.mesh.position.copy(ppiv);
    p.mesh.quaternion.copy(_armQ);
  }
}

// ---- Prizes ----
const fries = [];
function spawnFries(n) {
  const h = currentSet.half;
  // Spawn on a jittered GRID (no initial interpenetration) in the front play area, clear of the
  // back-left chute, stacked in a few layers. No overlap at t=0 -> the solver never has to explosively
  // separate bodies, so the pile settles like a real heap instead of flinging prizes around.
  const SMIN = 0.82, SMAX = 1.2;                            // per-prize size variation -> natural heap, not a uniform grid
  const padX = h.x * 2 * SMAX + 0.18, padZ = h.z * 2 * SMAX + 0.18; // cells fit the biggest prize + its tilt -> still no t=0 overlap
  const x0 = -1.55, x1 = 1.75, z0 = -0.3, z1 = 2.05;
  const cols = Math.max(1, Math.floor((x1 - x0) / padX) + 1);
  const rows = Math.max(1, Math.floor((z1 - z0) / padZ) + 1);
  const startX = (x0 + x1) / 2 - (cols - 1) * padX / 2;
  const startZ = (z0 + z1) / 2 - (rows - 1) * padZ / 2;
  const perLayer = cols * rows;
  for (let i = 0; i < n; i++) {
    const value = rollValue(Math.random());
    const mass = prizeMass(value);                          // heavier prize = harder to hold
    const s = SMIN + Math.random() * (SMAX - SMIN);          // this prize's size
    const body = new CANNON.Body({ mass, material: fryMat,
      shape: new CANNON.Box(new CANNON.Vec3(h.x * s, h.y * s, h.z * s)),
      collisionFilterGroup: G_FRY, collisionFilterMask: G_SOLID | G_FRY | G_CLAW | G_HELD });
    body.linearDamping = 0.1; body.angularDamping = 0.3;     // bleed energy -> settles, no perpetual jitter
    body.sleepSpeedLimit = 0.26; body.sleepTimeLimit = 0.4;
    const layer = Math.floor(i / perLayer), idx = i % perLayer;
    const cx = idx % cols, cz = Math.floor(idx / cols);
    body.position.set(
      startX + cx * padX + (Math.random() - 0.5) * 0.06,
      FLOOR_Y + h.y + 0.05 + layer * (h.y * 2 + 0.07),       // rest on the floor + stack layers (tiny gap, small settle)
      startZ + cz * padZ + (Math.random() - 0.5) * 0.06
    );
    body.quaternion.setFromEuler((Math.random() - 0.5) * 0.42, Math.random() * 3, (Math.random() - 0.5) * 0.42); // slight tilt + random yaw; settling adds the rest of the tumble
    world.addBody(body);
    const mesh = currentSet.makeMesh();
    mesh.scale.setScalar(s);
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); // prizes cast/receive shadows
    scene.add(mesh);
    const fry = new Prize(body, mesh);
    fry.value = value; fry.delivered = false; fry.everHeld = false; // only a GRABBED prize can score (no free start-of-game drop-ins)
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
const elFlash = document.getElementById('flash'), elPop = document.getElementById('pop'), elComboPop = document.getElementById('combo');
function flash() { if (elFlash) { elFlash.style.opacity = '1'; setTimeout(() => (elFlash.style.opacity = '0'), 130); } }
function popScore(n, tier = n) {
  if (!elPop) return;
  elPop.textContent = '+' + n;
  elPop.style.color = tier >= 5 ? '#ffd34d' : tier >= 3 ? '#ff9a4d' : '#bff4ff';   // gold / orange / common — the score pop reads the prize tier
  elPop.classList.remove('show'); void elPop.offsetWidth; elPop.classList.add('show');
}
function showCombo(c, mult) {                                  // floating "🔥 N연속 ×M" on a streak
  if (!elComboPop) return;
  elComboPop.textContent = `🔥 ${c}연속 ×${mult.toFixed(1)}`;
  elComboPop.classList.remove('show'); void elComboPop.offsetWidth; elComboPop.classList.add('show');
}
function popMiss() {                                           // a slip silently reset the combo -> name it so the player knows WHY
  if (!elPop) return;
  elPop.textContent = '놓침!'; elPop.style.color = '#ff9a4d';
  elPop.classList.remove('show'); void elPop.offsetWidth; elPop.classList.add('show');
}
const MILESTONES = [20, 45, 75, 110];                         // score thresholds -> fanfare + marquee pulse (raised: a single gold×3 no longer trips the first one)
function checkMilestone() {                                    // returns true if one fired (caller swaps the chime for the fanfare)
  if (milestoneIdx < MILESTONES.length && score >= MILESTONES[milestoneIdx]) {
    milestoneIdx++; marqueePulse = 1; camShake = Math.max(camShake, 0.3); return true;
  }
  return false;
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
    const dx = p.x - clawPos.x, dz = p.z - clawPos.z;        // cage at the ACTUAL (swaying) claw
    const dr = Math.hypot(dx, dz);
    if (dr < GRIP_R && Math.abs(p.y - tipY) < CAGE_BAND) cand.push({ f, dr });
  }
  cand.sort((a, b) => a.dr - b.dr);
  const take = cand.slice(0, MAX_GRAB);
  const n = take.length;
  const gripPower = 0.95 + Math.random() * 0.2;             // firm grip, tight variance — a slip is decided by AIM + weight, not a luck roll
  for (const { f, dr } of take) {
    const center = 1 - (dr / GRIP_R) * 0.3;                  // centered grab firmer; edge catches still hold reasonably
    const k = K_BASE * center / n;                            // multi-grab splits grip budget
    const breakDist = gripBreakDist(center, f.value, n) * gripPower + (Math.random() - 0.5) * 0.06;
    const offX = f.body.position.x - hub.position.x, offZ = f.body.position.z - hub.position.z;
    // Start the anchor at the caught spot, then ramp it toward the claw AXIS (the prongs drag the
    // prize to center as they grip). cf = how off-center it ends up: multi-grab keeps a spread so the
    // two prizes don't overlap; a single prize centers nearly under the claw, cradled by the prongs.
    const cf = n > 1 ? 0.42 : 0.14;
    const anchor = new THREE.Vector3(offX, f.body.position.y + 0.18 - hub.position.y, offZ); // grip point hangs below
    f.everHeld = true;                                       // grabbed at least once -> now eligible to score
    f.body.wakeUp();
    f.body.velocity.set(0, 0, 0);                            // arrest the bat from the closing fingers
    f.body.angularVelocity.set(0, 0, 0);
    f.body.angularDamping = 0.96;                            // kill spin while held — hangs steady (no 빙글빙글)
    f.body.collisionFilterGroup = G_HELD;                    // ignore claw, pile, and each other
    f.body.collisionFilterMask = G_SOLID;                    // only bonks the cabinet (walls)
    held.push({ fry: f, anchor, homeX: offX * cf, homeZ: offZ * cf, k, breakDist, slipWarn: false });
  }
  return n;
}
const _fpos = new THREE.Vector3(), _target = new THREE.Vector3(), _stretch = new THREE.Vector3(), _gripPt = new CANNON.Vec3(), _force = new CANNON.Vec3();
function applyGripForces(dt) {
  const ramp = Math.min(1, dt * 5);                          // ~0.3s pull-to-center as the claw grips + lifts
  gripStress = 0;                                            // peak grip strain this frame (drives the slip-warning juice)
  for (let i = held.length - 1; i >= 0; i--) {
    const h = held[i];
    h.anchor.x += (h.homeX - h.anchor.x) * ramp;             // drag the prize under the claw axis (cradled by the prongs)
    h.anchor.z += (h.homeZ - h.anchor.z) * ramp;
    _target.set(hub.position.x + h.anchor.x, hub.position.y + h.anchor.y, hub.position.z + h.anchor.z);
    _fpos.set(h.fry.body.position.x, h.fry.body.position.y + 0.18, h.fry.body.position.z); // measure the GRIP POINT (top), so the swing below shows as slip risk
    _stretch.subVectors(_fpos, _target);
    const dist = _stretch.length();
    if (dist > h.breakDist) {                                // grip exceeded -> SLIP
      h.fry.body.collisionFilterGroup = G_FRY;
      h.fry.body.collisionFilterMask = G_SOLID | G_FRY | G_CLAW | G_HELD;
      h.fry.body.angularDamping = 0.01;
      slipLog.push({ state, dist: +dist.toFixed(2), v: h.fry.value }); if (slipLog.length > 40) slipLog.shift();
      held.splice(i, 1);
      slips++; combo = 0; flash(); popMiss(); camShake = 0.2; if (audioReady) sfx.slip();   // a dropped prize breaks the combo streak (say "놓침!" so the reset is explained)
      continue;
    }
    const ratio = dist / h.breakDist;                        // how close to slipping (0..1)
    if (ratio > gripStress) gripStress = ratio;
    if (ratio > 0.8 && !h.slipWarn) { h.slipWarn = true; if (audioReady) sfx.creak(); } // strain groan once as it starts to slide
    else if (ratio < 0.65) h.slipWarn = false;               // recovered -> can warn again
    if (dist > maxStretch) maxStretch = dist;
    const b = h.fry.body, v = b.velocity, hv = hub.velocity;
    // cannon-es applyForce(force, relativePoint) — relativePoint is RELATIVE to the COM. _gripPt is a
    // ZERO vector, so there's NO torque -> the prize hangs + swings (pendulum) but never SPINS ("빙글빙글").
    // (The old code passed b.position+offset, a WORLD point ~5 units up -> enormous torque -> wild spin.)
    // The dangle is preserved because the stretch is still measured at the grip point above the center.
    _force.set(
      -h.k * _stretch.x - DAMP * (v.x - hv.x),
      -h.k * _stretch.y - DAMP * (v.y - hv.y),
      -h.k * _stretch.z - DAMP * (v.z - hv.z));
    b.applyForce(_force, _gripPt);                            // reuse a scratch vector (no per-frame alloc); zero relativePoint -> no spin
  }
}

// ---- Input: commit aiming ----
const keys = {};
let audioReady = false;
addEventListener('keydown', (e) => {
  if (!audioReady) { sfx.init(); sfx.resume(); audioReady = true; }
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); startPlunge(); }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') setZoom(camState.r - 1.2);     // + : zoom in
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') setZoom(camState.r + 1.2); // - : zoom out
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---- State machine ----
let state = 'aim', stateT = 0;
let score = 0, slips = 0, drops = 0, delivered = 0;
let combo = 0, bestCombo = 0, milestoneIdx = 0, marqueePulse = 0, goldGot = 0;   // C: combo streak + milestones + golds caught this round
let clawFlash = 0, clawShudder = 0, gripStress = 0, dropRequested = false; // juice: grab light flare / whiff prong shudder / slip strain / player-triggered release
let recycles = 0, maxObsSpeed = 0, maxSpeedTag = ''; // debug: floor-tunnel recycles + peak prize speed (instability)
let started = false;                     // gated behind the coin/card payment screen
const aimVec = { x: 0, z: 0 };           // analog joystick input (-1..1)
const joyVis = { x: 0, z: 0 };           // smoothed visual tilt of the 3D cabinet joystick (combines joystick + keys)
function startPlunge() {
  if (!started) return;
  if (state === 'aim') { state = 'plunge'; stateT = 0; drops++; }
  else if (state === 'return') { dropRequested = true; if (audioReady) sfx.place(); }   // 잡기!/Space during return = release as soon as it's over the chute ("received" click)
}
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
    const b = h.fry.body; b.wakeUp();
    b.velocity.set((Math.random() - 0.5) * 0.12 + bob.vx * 0.5, -0.4, (Math.random() - 0.5) * 0.12 + bob.vz * 0.5); // let go WITH the swing -> a residual swing can catch the wall
    b.angularVelocity.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
    b.angularDamping = 0.01;
    b.collisionFilterGroup = G_FRY;
    b.collisionFilterMask = G_SOLID | G_FRY | G_CLAW | G_HELD; // full physics: hits the lip/floor/pile, bounces, can be re-grabbed
  }
  held.length = 0;
}
function scoreDelivery(f) {                                    // a grabbed prize reached the chute -> combo-multiplied score
  combo++; if (combo > bestCombo) bestCombo = combo;
  const mult = comboMult(combo);
  const pts = Math.round(f.value * mult);
  score += pts; delivered++; if (f.value >= 5) goldGot++;
  popScore(pts);                                              // color by the actual (combo-boosted) points, not the raw tier
  if (combo >= 2) showCombo(combo, mult);
  camShake = 0.12 + Math.min(0.14, combo * 0.025);
  const hitMilestone = checkMilestone();
  if (audioReady) {
    if (hitMilestone) sfx.milestone();                        // fanfare REPLACES the get/combo chimes (no 3-sound stack on a milestone)
    else { sfx.get(); if (combo >= 2) sfx.combo(combo); }
  }
}
function checkDeliveries() {
  if (!started) return;                                       // no scoring before the game starts (pile still settling)
  for (const f of fries) {
    if (f.delivered) continue;
    const p = f.body.position;
    if (Math.abs(p.x - HOLE.x) < HOLE.half + 0.05 && Math.abs(p.z - HOLE.z) < HOLE.half + 0.05 && p.y < FLOOR_Y - 0.5) { // below the floor + in the hole = fell into the chute -> score immediately (was 0.95: big prizes rested above it -> scored late)
      f.delivered = true;
      if (f.everHeld) scoreDelivery(f);                       // GRABBED prize -> combo-multiplied score
      // (a free faller is just collected: no score, no combo, no jarring reload)
      collectIntoBin(f);                                    // either way it drops into the visible bin (chute stays clear)
    }
  }
}

// ---- Loop ----
const elScore = document.getElementById('r-score'), elTime = document.getElementById('r-time'), elGot = document.getElementById('r-got');
const elCombo = document.getElementById('r-combo'), elComboN = document.getElementById('r-combo-n'), elComboM = document.getElementById('r-combo-m');
const elGold = document.getElementById('r-gold');
let timeLeft = ROUND_SEC, last = performance.now();
const _handPrev = new THREE.Vector3().copy(handPos);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  stateT += dt;
  if (started && timeLeft > 0) { timeLeft = tickTime(timeLeft, dt); if (timeLeft === 0) endGame(); }

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
    gripT = Math.min(GRIP_CLOSE, gripT + dt * 1.3);          // ease the prongs onto the prize surface (gentler -> less shove)
    if (gripT >= GRIP_CLOSE - 0.01 && stateT > 0.45) {
      const got = tryGrab();
      state = 'lift'; stateT = 0;
      if (got > 0) { if (audioReady) sfx.grab(); clawFlash = 1; }   // caught -> firm clamp + the claw light flares (you SEE the catch land)
      else { combo = 0; if (audioReady) sfx.whiff(); clawShudder = 0.6; }   // empty grab breaks the streak too (rewards precision) + hollow miss + prong shudder
    }
  } else if (state === 'lift') {
    handPos.y = approach(handPos.y, HOVER_Y, LIFT_SPEED, dt);
    if (handPos.y >= HOVER_Y - 0.01) {
      for (const h of held) h.fry.body.velocity.set((Math.random() - 0.5) * 1.0, 0.15, (Math.random() - 0.5) * 1.0); // 천장 충격 — the claw clunks at the top, can knock the prize loose
      camShake = 0.18; computeReturnTarget(); state = 'return'; stateT = 0;
    }
  } else if (state === 'return') {
    handPos.x = approach(handPos.x, returnX, RETURN_SPEED, dt);
    handPos.z = approach(handPos.z, returnZ, RETURN_SPEED, dt);
    const overChute = Math.abs(handPos.x - returnX) < 0.02 && Math.abs(handPos.z - returnZ) < 0.02;
    if (overChute && (dropRequested || swayed() || stateT > 1.2)) { dropRequested = false; state = 'open'; stateT = 0; } // player can drop NOW (잡기!/Space); else a short settle then auto-drop (was a 3.5s forced wait)
  } else if (state === 'open') {
    gripT = Math.max(0, gripT - dt * 3);
    if (stateT > 0.15 && held.length) releaseAll();
    if (stateT > 0.9) { state = 'aim'; stateT = 0; }
  }

  // claw sway (고리 흔들림): a pendulum that lags the aim — must settle to grab/drop accurately
  bob.vx += ((handPos.x - bob.x) * SWAY_K - bob.vx * SWAY_DAMP) * dt;
  bob.vz += ((handPos.z - bob.z) * SWAY_K - bob.vz * SWAY_DAMP) * dt;
  bob.x += bob.vx * dt; bob.z += bob.vz * dt;
  clawPos.set(bob.x, handPos.y, bob.z);
  if (clawShudder > 0) { clawShudder = Math.max(0, clawShudder - dt * 3.2); const j = clawShudder * 0.12; clawPos.x += (Math.random() - 0.5) * j; clawPos.z += (Math.random() - 0.5) * j; } // whiff: the empty claw shudders
  // pendulum dangle (흔들흔들): the claw head leans by how far it lags the aim, plus its swing velocity,
  // so it visibly wobbles + overshoots + settles. The underdamped sway makes this oscillate naturally.
  const leanX = THREE.MathUtils.clamp((clawPos.x - handPos.x) * 1.9 + bob.vx * 0.16, -0.5, 0.5);
  const leanZ = THREE.MathUtils.clamp((clawPos.z - handPos.z) * 1.9 + bob.vz * 0.16, -0.5, 0.5);
  clawTiltQ.setFromEuler(_tiltE.set(-leanZ, 0, leanX));
  if (dt > 0) hub.velocity.set((clawPos.x - _handPrev.x) / dt, (clawPos.y - _handPrev.y) / dt, (clawPos.z - _handPrev.z) / dt);
  _handPrev.copy(clawPos);
  hub.position.set(clawPos.x, clawPos.y, clawPos.z);
  placeProngs(dt);
  applyGripForces(dt);
  clawLight.position.set(clawPos.x, clawPos.y - 0.7, clawPos.z); // travels with the claw so the prongs + held prize read
  clawFlash = Math.max(0, clawFlash - dt * 2.5);
  const stressFlicker = gripStress > 0.82 ? (0.6 + 0.4 * Math.sin(now * 0.05)) * (gripStress - 0.82) * 6 : 0; // light flickers as the grip strains
  clawLight.intensity = 1.7 + clawFlash * 2.6 + stressFlicker;  // flare on a successful catch
  for (const f of fries) { if (f.gone || f.delivered) continue; const v = f.body.velocity, sp = v.length(); if (sp > 4) v.scale(4 / sp, v); } // pre-step cap so the integrator never flings a squeezed prize
  world.step(1 / 60, dt, 3);

  // claw head + collar: ride the swaying clawPos, tilted by the pendulum dangle
  hubMesh.position.copy(clawPos); hubMesh.quaternion.copy(clawTiltQ);
  collarMesh.position.copy(clawPos); collarMesh.position.y -= 0.27; collarMesh.quaternion.copy(clawTiltQ);
  // cable: connects the swaying head (clawPos) to the FIXED gantry above the aim -> it leans as the claw swings
  _cabBot.copy(clawPos); _cabBot.y += 0.2;
  _cabTop.set(handPos.x, 12.5, handPos.z);
  rodMesh.position.copy(_cabBot).add(_cabTop).multiplyScalar(0.5);
  rodMesh.scale.y = Math.max(0.1, _cabBot.distanceTo(_cabTop));
  rodMesh.quaternion.setFromUnitVectors(UP, _cabDir.copy(_cabTop).sub(_cabBot).normalize());
  const LIM = CAB.half - 0.18;                              // interior limit, just inside the glass
  for (const f of fries) {
    if (f.gone) continue;
    if (!f.delivered) {
      const v = f.body.velocity, sp = v.length(), p = f.body.position;
      if (sp > maxObsSpeed) { maxObsSpeed = sp; maxSpeedTag = state + (held.some((h) => h.fry === f) ? '/held' : '/free'); } // debug: peak speed + context
      if (sp > 3.5) v.scale(3.5 / sp, v);                   // speed cap: a calm pile never needs more; also caps any arc toward the chute (< lip height)
      if (p.x > LIM) { p.x = LIM; if (v.x > 0) v.x *= -0.2; } else if (p.x < -LIM) { p.x = -LIM; if (v.x < 0) v.x *= -0.2; } // HARD containment: can never leave the glass
      if (p.z > LIM) { p.z = LIM; if (v.z > 0) v.z *= -0.2; } else if (p.z < -LIM) { p.z = -LIM; if (v.z < 0) v.z *= -0.2; }
      // anti-jam: a free prize riding UP on the prongs (high + near the claw axis while it works) -> slide it off.
      // SET a gentle outward+down velocity (never accumulate) so it slips off without being flung.
      if (state !== 'aim' && p.y > FLOOR_Y + 1.4 && !held.some((h) => h.fry === f)) {
        const dx = p.x - clawPos.x, dz = p.z - clawPos.z, dr = Math.hypot(dx, dz) || 1;
        if (dr < 0.55) { v.x = (dx / dr) * 0.9; v.z = (dz / dr) * 0.9; v.y = Math.min(v.y, -0.7); }
      }
      // soft shove: ONLY while the claw is descending ('plunge') — part free prizes in a RING around
      // its column (NOT the central grab target dr<GRIP_R). Stops at 'close' so the pile settles before
      // the grab, and so shoved neighbors don't bump the target out of the grasp.
      if (state === 'plunge' && !held.some((h) => h.fry === f)) {
        const dx = p.x - clawPos.x, dz = p.z - clawPos.z, dr = Math.hypot(dx, dz) || 0.01;
        if (dr > GRIP_R + 0.06 && dr < 1.0) {                 // ring just OUTSIDE the grasp -> never pushes the grab target
          const ux = dx / dr, uz = dz / dr, push = (1.0 - dr) * 1.9; // gentle outward part (capped by the 3.5 clamp)
          if (v.x * ux + v.z * uz < push) { v.x = ux * push; v.z = uz * push; } // only add outward push if not already parting
        }
      }
      if (p.y < -2 && !held.some((h) => h.fry === f)) {     // somehow escaped the play area -> COLLECT it (no score, no jarring reload)
        f.delivered = true; collectIntoBin(f);
        recycles++;                                          // debug: count escapes (should be ~0)
      }
    }
    f.sync();
  }
  checkDeliveries();
  if (binFlash > 0) { binFlash = Math.max(0, binFlash - dt * 2); binGlowMat.emissiveIntensity = binFlash * 1.8; } // GET pulse
  if (marqueePulse > 0) { marqueePulse = Math.max(0, marqueePulse - dt * 1.1); heroMarquee.emissiveIntensity = 1.45 + marqueePulse * 1.7; } // milestone marquee flare

  const dropReady = state === 'return' && Math.abs(handPos.x - returnX) < 0.05 && Math.abs(handPos.z - returnZ) < 0.05;
  if (dropReady) { reticle.position.set(HOLE.x, FLOOR_Y + 0.04, HOLE.z); reticle.material.color.setHex(0x36e0ff); reticle.visible = true; } // cyan "drop now" ring over the chute (the 잡기! window)
  else { reticle.position.set(clawPos.x, FLOOR_Y + 0.04, clawPos.z); reticle.material.color.setHex(state === 'aim' ? 0xffe14a : 0x888888); reticle.visible = state === 'aim'; }
  // Cabinet joystick leans with the COMBINED input (analog joystick + arrow keys), smoothed.
  const jvx = (state === 'aim' && started) ? THREE.MathUtils.clamp(aimVec.x + (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), -1, 1) : 0;
  const jvz = (state === 'aim' && started) ? THREE.MathUtils.clamp(aimVec.z + (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), -1, 1) : 0;
  joyVis.x += (jvx - joyVis.x) * Math.min(1, dt * 12);
  joyVis.z += (jvz - joyVis.z) * Math.min(1, dt * 12);
  joyStick.rotation.z = -joyVis.x * 0.5;
  joyStick.rotation.x = joyVis.z * 0.5;

  updateCamera(dt);
  renderer.render(scene, camera);

  elScore.textContent = score;
  elGot.textContent = delivered;
  elTime.textContent = Math.ceil(timeLeft);
  elTime.style.color = timeLeft <= 10 ? '#ff5a4a' : '#ffd479';
  if (elCombo) { elComboN.textContent = combo; elComboM.textContent = comboMult(combo).toFixed(1); elCombo.classList.toggle('hot', combo >= 2); }
  if (elGold) elGold.textContent = fries.filter((f) => f.value === 5 && !f.delivered && !f.gone).length; // ✨ golds left in the machine (live near-miss pressure)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ===================== Arcade: coin/card payment, start/replay, touch joystick =====================
// (coin/card/start tones live in the sfx module — no second AudioContext here)
const elStart = document.getElementById('start'), elGameover = document.getElementById('gameover');
const elPad = document.getElementById('pad'), elCredit = document.getElementById('credit'), elStartBtn = document.getElementById('startbtn');
const elFinal = document.getElementById('final-score'), payCoin = document.getElementById('pay-coin'), payCard = document.getElementById('pay-card'), coinEl = document.getElementById('coin');
let credited = false, firstGame = true;

function ensureAudio() { if (!audioReady) { try { sfx.init(); sfx.resume(); } catch (e) { /* */ } audioReady = true; } }
// 체인소맨 레제가 뽑기 기계에 다가와 응원 — 라운드 START에서 음성 1회(클릭 제스처 안이라 자동재생 허용).
// (예전엔 결제 화면 첫 클릭에 터져 자막이 결제창 위에 뜨는 어색함이 있었음 -> START로 이동)
const rezeVoice = new Audio('audio/reze.mp3');
rezeVoice.volume = 0.85;
let rezePlayed = false, muted = false;
function playReze() {
  if (rezePlayed) return; rezePlayed = true;
  rezeVoice.currentTime = 0;
  rezeVoice.play().catch(() => { rezePlayed = false; });   // blocked -> allow a later retry
}
// Mute toggle (🔊/🔇): gates every SFX + the voice. Deaf-friendly — the subtitle still shows.
const muteBtn = document.getElementById('mute');
try { muted = localStorage.getItem('ppopgi_muted') === '1'; } catch (e) { /* */ }   // remember the player's choice
function applyMute() {
  sfx.setMuted(muted); rezeVoice.muted = muted;
  if (muteBtn) { muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
  try { localStorage.setItem('ppopgi_muted', muted ? '1' : '0'); } catch (e) { /* */ }
}
if (muteBtn) muteBtn.addEventListener('click', () => { muted = !muted; applyMute(); ensureAudio(); });
applyMute();   // reflect the persisted mute state on load
// Korean subtitle for the JAPANESE line (ja clip) — synced to playback by timed segments.
const subEl = document.getElementById('subtitle');
const REZE_SUB = [
  { t: 0.0, ko: '있잖아, 저거 뽑아줘!' },
  { t: 1.4, ko: '응, 그 반짝이는 거.' },
  { t: 2.9, ko: '부탁이야, 딱 한 번만이면 돼.' },
  { t: 4.7, ko: '분명 좋은 게 나올 거야, 응?' },
];
if (subEl) {
  rezeVoice.addEventListener('timeupdate', () => {
    if (rezeVoice.paused) return;
    let cur = REZE_SUB[0].ko;
    for (const s of REZE_SUB) if (rezeVoice.currentTime >= s.t) cur = s.ko;
    subEl.textContent = cur; subEl.classList.add('on');
  });
  const hideSub = () => subEl.classList.remove('on');
  rezeVoice.addEventListener('ended', hideSub);
  rezeVoice.addEventListener('pause', hideSub);
}
function addCredit(kind) {
  ensureAudio();
  if (kind === 'coin') { coinEl.classList.remove('drop'); void coinEl.offsetWidth; coinEl.classList.add('drop'); payCoin.classList.add('done'); sfx.coin(); }
  else { payCard.classList.add('done'); sfx.card(); }
  if (!credited) { credited = true; elCredit.textContent = 'CREDIT  1'; elStartBtn.classList.add('on'); }
}
// keyboard/AT: the payment tiles are the ENTRY gate — they must be operable without a mouse
function payKey(e, kind) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); addCredit(kind); } }
if (payCoin) { payCoin.addEventListener('click', () => addCredit('coin')); payCoin.addEventListener('keydown', (e) => payKey(e, 'coin')); }
if (payCard) { payCard.addEventListener('click', () => addCredit('card')); payCard.addEventListener('keydown', (e) => payKey(e, 'card')); }
if (elStartBtn) elStartBtn.addEventListener('click', () => { if (credited) startGame(); });
const replayBtn = document.getElementById('replay');
if (replayBtn) replayBtn.addEventListener('click', () => {
  credited = false; elCredit.textContent = ''; elStartBtn.classList.remove('on');
  payCoin.classList.remove('done'); payCard.classList.remove('done');
  elGameover.classList.add('off');
  elStart.classList.remove('off');                            // back to the payment (entry) screen
});

function resetFries() {
  held.length = 0;
  for (const f of fries) { if (!f.gone) { rmBody(f.body); scene.remove(f.mesh); } }
  fries.length = 0; collectedList.length = 0; binFlash = 0; binGlowMat.emissiveIntensity = 0;
  spawnFries(currentSet.spawn);
}
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function showToast() {   // one-time control reminder on the first round (covers mobile, where #hint is hidden)
  if (!toastEl) return;
  toastEl.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 4200);
}
if (toastEl) toastEl.addEventListener('pointerdown', () => toastEl.classList.remove('on'));
function startGame() {
  const firstRun = firstGame;
  if (!firstGame) { resetFries(); score = 0; slips = 0; delivered = 0; drops = 0; combo = 0; bestCombo = 0; milestoneIdx = 0; marqueePulse = 0; goldGot = 0; }
  firstGame = false; credited = false; held.length = 0; gripT = 0; dropRequested = false;
  timeLeft = ROUND_SEC; started = true; state = 'aim'; stateT = 0;
  handPos.set(CAB.x, HOVER_Y, CAB.z); bob.x = CAB.x; bob.z = CAB.z; bob.vx = 0; bob.vz = 0; clawPos.copy(handPos); _handPrev.copy(handPos);
  elStart.classList.add('off'); elGameover.classList.add('off'); elPad.classList.add('on');
  sfx.start();
  playReze();   // 레제 등장 응원 — 첫 라운드 시작에 1회
  if (firstRun) showToast();   // controls reminder, once
}
function endGame() {
  started = false; elPad.classList.remove('on');
  let best = 0;
  try { best = +(localStorage.getItem('ppopgi_best') || 0); } catch (e) { /* */ }
  const isRecord = score > best;
  if (isRecord) { best = score; try { localStorage.setItem('ppopgi_best', String(best)); } catch (e) { /* */ } }
  elFinal.textContent = score;
  document.getElementById('final-got').textContent = delivered;
  const elGG = document.getElementById('final-goldgot'); if (elGG) elGG.textContent = goldGot > 0 ? `✨골드 ${goldGot}` : '';
  document.getElementById('final-best').textContent = best;
  document.getElementById('final-record').textContent = isRecord ? '🎉 신기록!' : '시간 종료';
  // best combo + golds left behind ("한 판 더" 유인) — show the rows only when they have something to say
  const bcRow = document.getElementById('final-combo-row');
  if (bcRow) { bcRow.style.display = bestCombo >= 2 ? '' : 'none'; document.getElementById('final-combo').textContent = bestCombo; }
  const missedGold = fries.filter((f) => f.value === 5 && !f.delivered && !f.gone).length;
  const mgRow = document.getElementById('final-missed-row');
  if (mgRow) { mgRow.style.display = missedGold > 0 ? '' : 'none'; document.getElementById('final-missed').textContent = missedGold; }
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
if (dropEl) {
  dropEl.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); startPlunge(); });
  dropEl.addEventListener('keydown', (e) => { if (e.code === 'Enter') { e.preventDefault(); ensureAudio(); startPlunge(); } }); // keyboard/AT: Enter on the focused 잡기! button
}

// Drag to orbit; wheel (desktop) / pinch (mobile) to ZOOM the current view (확대/축소).
const gameCanvas = document.getElementById('game');
const ZOOM_MIN = 5.5, ZOOM_MAX = 22;
function setZoom(r) { camState.r = THREE.MathUtils.clamp(r, ZOOM_MIN, ZOOM_MAX); camGoal.r = camState.r; }
let dragX = 0, dragY = 0, dragId = null;
const touchPts = new Map();                          // active pointers on the canvas (for pinch)
let pinchPrev = 0;
if (gameCanvas) {
  gameCanvas.addEventListener('pointerdown', (e) => {
    touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPts.size >= 2) { camDrag = false; dragId = null; const [a, b] = [...touchPts.values()]; pinchPrev = Math.hypot(a.x - b.x, a.y - b.y); } // 2 fingers -> pinch
    else { camDrag = true; dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; }                                                          // 1 finger -> orbit
  });
  gameCanvas.addEventListener('pointermove', (e) => {
    if (touchPts.has(e.pointerId)) touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPts.size >= 2) {                        // pinch-to-zoom
      const [a, b] = [...touchPts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchPrev > 0 && d > 0) setZoom(camState.r * (pinchPrev / d));
      pinchPrev = d; return;
    }
    if (!camDrag || e.pointerId !== dragId) return;  // 1-finger orbit
    const dx = e.clientX - dragX, dy = e.clientY - dragY; dragX = e.clientX; dragY = e.clientY;
    camState.az -= dx * 0.006;
    camState.pitch = THREE.MathUtils.clamp(camState.pitch + dy * 0.005, 0.05, 1.45);
    camGoal.az = camState.az; camGoal.pitch = camState.pitch; camGoal.r = camState.r; camGoal.ty = camState.ty;
  });
  const endPt = (e) => { touchPts.delete(e.pointerId); pinchPrev = 0; if (e.pointerId === dragId) { camDrag = false; dragId = null; } };
  gameCanvas.addEventListener('pointerup', endPt); gameCanvas.addEventListener('pointercancel', endPt);
  gameCanvas.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(camState.r + e.deltaY * 0.012); }, { passive: false }); // scroll = zoom
}
// Preset angle buttons (정면/측면/기본). #mute is in the same bar but has no data-cam.
document.querySelectorAll('#cambtns button[data-cam]').forEach((b) => b.addEventListener('click', () => setCamPreset(b.dataset.cam)));
const zin = document.getElementById('zoomin'), zout = document.getElementById('zoomout'); // on-screen zoom (discoverable; mirrors +/- keys + pinch)
if (zin) zin.addEventListener('click', () => setZoom(camState.r - 1.6));
if (zout) zout.addEventListener('click', () => setZoom(camState.r + 1.6));

// Verify / debug API.
window.__claw = {
  get score() { return score; }, get drops() { return drops; }, get delivered() { return delivered; },
  get slips() { return slips; }, get held() { return held.length; },
  get combo() { return combo; }, get bestCombo() { return bestCombo; }, get gripStress() { return +gripStress.toFixed(2); }, // C/B debug
  get muted() { return muted; },
  get heldAng() { return held.length ? +held[0].fry.body.angularVelocity.length().toFixed(2) : 0; }, // debug: held-prize spin rate
  get reze() { return { played: rezePlayed, paused: rezeVoice.paused, dur: +(rezeVoice.duration || 0).toFixed(1), t: +rezeVoice.currentTime.toFixed(2) }; }, // debug: Reze voice state
  get state() { return state; }, get handPos() { return handPos; },
  start() { startGame(); }, drop() { startPlunge(); }, setHand(x, z) { handPos.x = x; handPos.z = z; },
  end() { if (started) endGame(); }, get started() { return started; },
  forceDeliver() { const f = fries.find((x) => !x.delivered && !x.gone && !held.some((h) => h.fry === x)); if (f) { f.delivered = true; f.everHeld = true; scoreDelivery(f); collectIntoBin(f); } return delivered; },
  setCam(name) { setCamPreset(name); }, get camPitch() { return camState.pitch; },
  zoom(r) { setZoom(r); }, get camR() { return +camState.r.toFixed(2); },
  piles() { return fries.filter((f) => !f.delivered).map((f) => ({ x: f.body.position.x, y: f.body.position.y, z: f.body.position.z, value: f.value })); },
  get slipLog() { return slipLog; }, get maxStretch() { return maxStretch; },
  get recycles() { return recycles; }, get maxSpeed() { return +maxObsSpeed.toFixed(1); }, get maxSpeedTag() { return maxSpeedTag; },
  resetDbg() { recycles = 0; maxObsSpeed = 0; maxSpeedTag = ''; },
  stuck() { return fries.filter((f) => !f.delivered && !f.gone && !held.some((h) => h.fry === f) && f.body.position.y > FLOOR_Y + 1.6 && Math.hypot(f.body.position.x - clawPos.x, f.body.position.z - clawPos.z) < 0.7).length; },
};
