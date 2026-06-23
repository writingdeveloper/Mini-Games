import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFloor, createChef, createStation, createCustomer, createGauge, createKitchenStove, createBowl, createBackWall, createWarehouseFridge } from './models.js';
import { STATIONS, CUSTOMER_SLOTS, slotProgress, patienceProgress, BLANCH_SLOTS, WAVES, PLACE_SLOTS } from './logic.js';
import { buildStation, tickStation, makeStationLabel } from './station.js';

// 가독성 상향(현 어두움 지적): hemi/lamp/fill 를 소폭 올려 막차에서도 조리대~카운터가 읽히게.
// 과노출 금지 — 무드는 유지하되 플레이영역만 들어올린다.
const ERA_MOOD = {
  '증기': { bg: 0x161b2a, amb: 1.05, lamp: 2.9, fill: 0.45, fogN: 16, fogF: 34, skyTop: 0x070b18, skyBot: 0x24304e },
  '디젤': { bg: 0x1a1f2c, amb: 1.12, lamp: 3.1, fill: 0.45, fogN: 18, fogF: 38, skyTop: 0x0b0c18, skyBot: 0x2b2440 },
  '막차': { bg: 0x0a0c14, amb: 0.95, lamp: 2.9, fill: 0.55, fogN: 12, fogF: 27, skyTop: 0x04050b, skyBot: 0x160d16 },
};

// 밤하늘 그라데이션 돔(CanvasTexture) + 별(상반구 절차적 점). 단색 background 대신 지평선→천정 그라데이션.
function makeSkyDome() {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 14), mat);
  dome.renderOrder = -10; group.add(dome);
  // 별 — 상반구(천정쪽)에 흩뿌린 점.
  const N = 210; const pos = new Float32Array(N * 3); // 과밀(340)→210, 천정쪽에 더 모아 그라데가 읽히게(QA)
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(1 - Math.random() * 0.55), r = 72;
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) + 5;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.5, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.6, depthWrite: false }));
  stars.renderOrder = -9; group.add(stars);
  const hx = (c) => '#' + c.toString(16).padStart(6, '0');
  function setColors(topHex, botHex) {
    const x = canvas.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, hx(botHex)); grad.addColorStop(0.45, hx(topHex)); grad.addColorStop(1, hx(topHex));
    x.fillStyle = grad; x.fillRect(0, 0, 8, 256); tex.needsUpdate = true;
  }
  setColors(0x070b18, 0x24304e);
  return { mesh: group, setColors };
}
let curEra = null;
let lastDwellSec = -1;
let prevWaveScene = 0;

// 손님 머리 위 주문 말풍선(양념). 가까운 손님 1명만 보이던 HUD 한계를 공간적으로 해소.
const SPICE_BUBBLE = { none: { t: '순하게', c: '#2e7d32' }, normal: { t: '기본', c: '#7a5a22' }, extra: { t: '맵게!', c: '#d23b2a' } };
function makeOrderBoard() {
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 76;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.55),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: true, toneMapped: false, depthWrite: false }));
  mesh.rotation.y = Math.PI; mesh.renderOrder = 2;
  let last = null;
  mesh.userData.setSpice = (spice) => {
    if (spice === last) return; last = spice;
    const x = canvas.getContext('2d'); x.clearRect(0, 0, 160, 76);
    const o = SPICE_BUBBLE[spice] || SPICE_BUBBLE.normal;
    x.fillStyle = '#fdfaf2'; x.fillRect(8, 6, 144, 50);
    x.fillStyle = o.c; x.fillRect(8, 50, 144, 6);
    x.fillStyle = '#fdfaf2'; x.beginPath(); x.moveTo(70, 56); x.lineTo(90, 56); x.lineTo(80, 70); x.closePath(); x.fill();
    x.fillStyle = o.c; x.font = '800 30px "Malgun Gothic", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('🌶 ' + o.t, 80, 30);
    tex.needsUpdate = true;
  };
  return mesh;
}

// 주방 작업대/하부장/매달린 도구/소품 — 조리대(STATIONS, z=-1.5)가 바닥이 아닌 카운터 위에 놓이도록.
function makeKitchen() {
  const g = new THREE.Group();
  const Z = -1.5;
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.55, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.85 });
  const front = new THREE.MeshStandardMaterial({ color: 0x7a1f14, roughness: 0.7 }); // 포장마차 적색 앞면
  const top = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.14, 1.7), steel);   // 스테인리스 상판
  top.position.set(0, 0.55, Z); top.receiveShadow = true; top.castShadow = true; g.add(top);
  const base = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.5, 1.45), wood);    // 하부장
  base.position.set(0, 0.25, Z); base.castShadow = true; base.receiveShadow = true; g.add(base);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(9.05, 0.46, 0.06), front); // 앞면 적색 띠
  apron.position.set(0, 0.3, Z + 0.76); g.add(apron);
  // 매달린 국자/주걱(작업대 위).
  const tool = new THREE.MeshStandardMaterial({ color: 0x868c93, metalness: 0.5, roughness: 0.5 });
  for (const tx of [-2.6, -1.3, 1.3, 2.6]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 8), tool);
    h.position.set(tx, 2.75, Z + 0.25); g.add(h);
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), tool);
    sc.position.set(tx, 2.5, Z + 0.25); sc.rotation.x = Math.PI; g.add(sc);
  }
  // 작업대 끝 소품 — 그릇 스택 + 주전자.
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xcdd1d6, metalness: 0.3, roughness: 0.5 });
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.42, 16), bowlMat);
  stack.position.set(-4.1, 0.83, Z); stack.castShadow = true; g.add(stack); // 상판 윗면(0.62)+높이반(0.21)=0.83(묻힘 해소 — QA)
  // 주방 화덕(AI 복잡 객체, garak_kit_stove.glb) — 작업대 우측 끝. 없으면 절차적 폴백.
  const stove = createKitchenStove();
  stove.position.set(4.0, 0.62, Z);
  g.add(stove);
  return g;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const LOW = typeof matchMedia === 'function' &&
    (matchMedia('(max-width: 560px)').matches || matchMedia('(pointer: coarse)').matches);
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0f1a);
  scene.fog = new THREE.Fog(0x0c0f1a, 14, 30);

  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 100);
  camera.position.set(0, 7.5, -7);
  camera.lookAt(0, 0.5, 1.5);

  const hemi = new THREE.HemisphereLight(0x7889b0, 0x241e2c, 0.95); // brighter ambient
  scene.add(hemi);
  // warm incandescent lamp over the counter (fill, no shadow)
  const lamp = new THREE.PointLight(0xffcf6a, 2.6, 30, 1.3);
  lamp.position.set(0, 6, 0.5);
  scene.add(lamp);
  // a single directional sun as the cheap shadow caster (ppopgi pattern — 1 pass vs point light's 6)
  const sun = new THREE.DirectionalLight(0xfff0e0, 0.85);
  sun.position.set(5, 13, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 512 : 1024, LOW ? 512 : 1024);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -5;
  sun.shadow.camera.near = 2; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  sun.target.position.set(0, 0, 0.5);
  scene.add(sun); scene.add(sun.target);

  // soft frontal fill (no shadow) so the play area (조리대~카운터) stays readable even at 막차.
  // aimed from the camera side toward the counters; intensity tuned per era in sync().
  const fillLight = new THREE.DirectionalLight(0xffe6c4, 0.45);
  fillLight.position.set(0, 6, -6); // camera side
  fillLight.target.position.set(0, 0.5, 1.5);
  scene.add(fillLight); scene.add(fillLight.target);

  scene.add(createFloor());
  const skyDome = makeSkyDome(); scene.add(skyDome.mesh); // 밤하늘 그라데이션 돔(에라별 색은 sync 에서)
  scene.add(makeKitchen()); // 주방 작업대 — 조리대가 카운터 위에 놓이도록
  const STATION_LABEL = { setting: '① 면', blancher: '② 데치기', broth: '③ 멸치육수', garnish: '④ 고명 1·2·3' };
  for (const [kind, pos] of Object.entries(STATIONS)) {
    const s = createStation(kind);
    s.position.set(pos.x, 0.62, pos.z); // 작업대 상판 윗면(y0.62)에 정확히 얹힘(0.55=상판 중심이라 묻혔음 — QA)
    scene.add(s);
    const label = makeStationLabel(STATION_LABEL[kind]);
    label.position.set(pos.x, 2.0, pos.z);
    scene.add(label);
  }

  // 플랫폼 무대 장식(배경판/기둥/등/역사인/증기). scene/logic 불변, 별도 모듈.
  const station = buildStation(scene, { reducedMotion: RM });
  if (typeof window !== 'undefined') window.__station = station; // QA 디버그 훅(__garak 관례)

  // 창고(분위기 공간) — -z 저장 구역: 포장마차 백월 + 작업대(프렙) + 냉장고. 둘러보는 배경, 메커니즘 없음.
  // 고정/궤도 부감에선 카메라 앞 가림 방지로 숨김(1인칭/추격에서만 표시).
  const warehouse = new THREE.Group();
  const backWall = createBackWall();
  backWall.position.set(0, 0, -5.3); backWall.rotation.y = Math.PI; warehouse.add(backWall);
  const whFridge = createWarehouseFridge();
  whFridge.position.set(3.5, 0, -3.8); whFridge.rotation.y = -0.6; warehouse.add(whFridge);
  scene.add(warehouse);
  if (typeof window !== 'undefined') window.__warehouse = warehouse; // 위치/회전 라이브 튜닝

  const chef = createChef();
  scene.add(chef);
  const chefBody = chef.getObjectByName('chefBody'); // 1인칭에서 숨길 본체
  const fpHands = chef.getObjectByName('fpHands');   // 1인칭 손
  const heldBowl = chef.getObjectByName('heldBowl');
  const foodNoodle = heldBowl.getObjectByName('food_noodle');
  const foodBroth = heldBowl.getObjectByName('food_broth');
  const foodGarnish = heldBowl.getObjectByName('food_garnish');
  const procBowl = heldBowl.getObjectByName('procBowl');   // 절차적 그릇(조리 단계 표시)
  const aiBowl = heldBowl.getObjectByName('aiBowl');       // AI 완성 그릇('done' 에서만)

  // 완성/진행중 그릇을 놓는 진열대(서빙 카운터) + slot별 그릇 — sync 가 state.placed 로 토글.
  const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.85 });
  const placedBowls = PLACE_SLOTS.map((slot) => {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.62), ledgeMat);
    ledge.position.set(slot.x, 0.95, slot.z); ledge.receiveShadow = true; ledge.castShadow = true; scene.add(ledge);
    const b = createBowl(); b.scale.setScalar(1.7); b.position.set(slot.x, 1.05, slot.z); b.visible = false; scene.add(b);
    return { mesh: b, proc: b.getObjectByName('procBowl'), ai: b.getObjectByName('aiBowl'),
      fn: b.getObjectByName('food_noodle'), fb: b.getObjectByName('food_broth'), fg: b.getObjectByName('food_garnish') };
  });

  // ---- 카메라 모드: 고정 / 자유궤도 / 추격3인칭 / 1인칭 — V키 순환 ----
  const CAM_FIXED_POS = new THREE.Vector3(0, 7.5, -7);
  const CAM_FIXED_LOOK = new THREE.Vector3(0, 0.5, 1.5);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.copy(CAM_FIXED_LOOK);
  orbit.enableDamping = true; orbit.dampingFactor = 0.08;
  orbit.minDistance = 3; orbit.maxDistance = 32;
  orbit.maxPolarAngle = Math.PI * 0.49; // 지면 아래로는 못 내려가게
  orbit.enabled = false;                 // 기본은 고정 모드
  const _chasePos = new THREE.Vector3();  // 추격 3인칭 보간용
  const _chaseLook = new THREE.Vector3();
  let lookYaw = 0, lookPitch = 0;          // 추격/1인칭 마우스 둘러보기 오프셋(rad)
  let cookAnim = null;                      // 동작 모션 토큰 { kind, t0, dur } — 조리/서빙/놓기별 손·그릇 궤적
  const CAM_MODES = ['fixed', 'orbit', 'chase', 'first'];
  // 모드별 시야각(수직 fov). 1인칭은 넓게(46°→64°, 모바일 70°) 잡아 "확대된 느낌" 해소, 부감/궤도는 차분히.
  const MODE_FOV = { fixed: 46, orbit: 46, chase: 54, first: LOW ? 80 : 72 };
  let camMode = 'fixed';
  function applyCamMode(mode) {
    if (!CAM_MODES.includes(mode)) return camMode;
    camMode = mode;
    camera.fov = MODE_FOV[mode] ?? 46; camera.updateProjectionMatrix(); // 모드별 시야각 적용
    if (mode === 'chase' || mode === 'first') { lookYaw = 0; lookPitch = 0; } // 진입 시 기본 시점
    else if (document.pointerLockElement) document.exitPointerLock(); // 고정/궤도로 가면 포인터락 해제
    orbit.enabled = (mode === 'orbit');
    if (chefBody) chefBody.visible = (mode !== 'first'); // 1인칭에선 본체 숨김
    if (fpHands) fpHands.visible = (mode === 'first');    // 1인칭에선 손 표시
    if (warehouse) warehouse.visible = (mode === 'first' || mode === 'chase'); // -z 창고는 1인칭/추격에서만(부감 가림 방지)
    camera.up.set(0, 1, 0);
    if (mode === 'fixed') { camera.position.copy(CAM_FIXED_POS); camera.lookAt(CAM_FIXED_LOOK); }
    else if (mode === 'orbit') { camera.position.copy(CAM_FIXED_POS); orbit.target.copy(CAM_FIXED_LOOK); orbit.update(); }
    return camMode;
  }
  function cycleCamMode() { return applyCamMode(CAM_MODES[(CAM_MODES.indexOf(camMode) + 1) % CAM_MODES.length]); }
  // 추격/1인칭 마우스 드래그 둘러보기 — 캔버스 드래그로 yaw/pitch 조절(탭=조리 동작은 main.js 가 별도 판정).
  {
    let dragging = false, lpx = 0, lpy = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (camMode === 'chase' || camMode === 'first') { dragging = true; lpx = e.clientX; lpy = e.clientY; }
    });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      lookYaw -= (e.clientX - lpx) * 0.005; lookPitch -= (e.clientY - lpy) * 0.005;
      lookPitch = Math.max(-0.55, Math.min(0.95, lookPitch));
      lpx = e.clientX; lpy = e.clientY;
    });
    addEventListener('pointerup', () => { dragging = false; });
    addEventListener('pointercancel', () => { dragging = false; });
  }
  // 마우스 전환(포인터락, FPS식) — 클릭으로 잠그면 마우스 이동=시점 회전, ESC 해제. (모바일은 위 드래그 폴백.)
  let pointerLocked = false;
  document.addEventListener('pointerlockchange', () => { pointerLocked = (document.pointerLockElement === renderer.domElement); });
  addEventListener('mousemove', (e) => {
    if (!pointerLocked || (camMode !== 'chase' && camMode !== 'first')) return;
    lookYaw -= e.movementX * 0.0022;
    lookPitch = Math.max(-0.55, Math.min(0.95, lookPitch - e.movementY * 0.0022));
  });
  function requestLook() { if (camMode === 'chase' || camMode === 'first') renderer.domElement.requestPointerLock?.(); }
  applyCamMode('first'); // 기본 시점 = 1인칭(주인장)

  // archetype display colors (Plan 6 polish refines these)
  const ARCH_COLOR = { soldier: 0x4a6a4a, worker: 0x4a5a8a, student: 0x8a7a4a, couple: 0xaa5a7a, granny: 0x8a8a8a };

  // one reusable customer mesh + patience gauge per counter slot
  const slotCustomers = CUSTOMER_SLOTS.map((pos) => {
    const c = createCustomer();
    c.position.set(pos.x, 0, pos.z); c.visible = false;
    scene.add(c);
    const pg = createGauge();
    pg.scale.set(0.6, 0.6, 0.6);
    pg.position.set(pos.x, 2.0, pos.z);
    pg.rotation.x = -0.2;
    scene.add(pg);
    const props = {
      soldier: c.getObjectByName('prop_soldier'), worker: c.getObjectByName('prop_worker'),
      student: c.getObjectByName('prop_student'), couple: c.getObjectByName('prop_couple'),
      granny: c.getObjectByName('prop_granny'),
    };
    const ai = {
      soldier: c.getObjectByName('ai_soldier'), worker: c.getObjectByName('ai_worker'),
      student: c.getObjectByName('ai_student'), couple: c.getObjectByName('ai_couple'),
      granny: c.getObjectByName('ai_granny'),
    };
    const proc = c.getObjectByName('procCust');
    const order = makeOrderBoard();
    order.position.set(pos.x, 2.55, pos.z); order.visible = false; scene.add(order);
    return { mesh: c, proc, body: proc.children[0], gauge: pg, fill: pg.getObjectByName('fill'), props, ai, order };
  });

  // one gauge per blancher slot, fanned out over the blancher
  const slotGauges = Array.from({ length: BLANCH_SLOTS }, (_, i) => {
    const gg = createGauge();
    gg.scale.set(0.8, 0.8, 0.8);
    gg.position.set(STATIONS.blancher.x + (i - (BLANCH_SLOTS - 1) / 2) * 0.5, 1.6 + i * 0.25, STATIONS.blancher.z);
    gg.rotation.x = -0.35;
    scene.add(gg);
    return { group: gg, fill: gg.getObjectByName('fill') };
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function gaugeColor(p) { return p > 0.9 ? 0xff5a5a : (p >= 0.7 && p <= 0.9) ? 0x6dff8f : 0xffcf6a; }
  function setGaugeFill(fill, p, color) {
    fill.scale.x = Math.min(1, p);
    fill.position.x = -(1 - Math.min(1, p)) * 0.5;
    fill.material.color.setHex(color);
  }

  function sync(state, t = 0) {
    const era = WAVES[Math.min(state.wave, WAVES.length - 1)].era;
    if (era !== curEra) {
      curEra = era;
      const m = ERA_MOOD[era];
      scene.background.setHex(m.bg);
      scene.fog.color.setHex(m.bg);
      scene.fog.near = m.fogN; scene.fog.far = m.fogF;
      skyDome.setColors(m.skyTop, m.skyBot);
      hemi.intensity = m.amb;
      lamp.intensity = m.lamp;
      fillLight.intensity = m.fill;
      // 무대(배경 틴트/등/증기)도 같은 에라로 동기화. setEra 가 스팀 농도까지 처리.
      station.setEra(era);
    }
    // 발차: 웨이브가 넘어가면 정차 열차가 미끄러져 나가고(다음 열차 진입). 리플레이면 복구.
    if (state.wave > prevWaveScene) {
      station.departTrain(state.wave >= WAVES.length ? null : era);
    } else if (state.wave < prevWaveScene) {
      station.resetTrain(era);
    }
    prevWaveScene = state.wave;
    // 발차 안내판 텍스트 = HUD 와 동일한 mm:ss. 초가 바뀔 때만 캔버스 재그림(매프레임 낭비 방지).
    const sec = Math.max(0, Math.ceil(state.dwellLeft));
    if (sec !== lastDwellSec) {
      lastDwellSec = sec;
      station.setDwell(`발차 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, state.phase === 'serving' && sec <= 10);
    }
    tickStation(t);
    // chef: gentle idle bob, stronger when moving
    const moving = Math.hypot(state.player.x - chef.position.x, state.player.z - chef.position.z) > 0.001;
    const bobY = RM ? 0 : moving ? Math.abs(Math.sin((t || 0) * 10)) * 0.08 : Math.sin((t || 0) * 2) * 0.03;
    chef.position.set(state.player.x, bobY, state.player.z);
    chef.rotation.z = RM ? 0 : moving ? Math.sin((t || 0) * 10) * 0.06 : 0;
    // 카메라 모드별 매 프레임 갱신(고정은 정적이라 불필요).
    if (camMode === 'orbit') orbit.update();
    else if (camMode === 'chase') {
      // 추격 3인칭: 주인공 주위를 돌며 따라감 — 드래그로 yaw(둘레)·pitch(상하). 기본=뒤(-z)·위.
      const A = Math.PI + lookYaw;
      const E = Math.max(0.25, Math.min(1.2, 0.6 + lookPitch)); // 하한↑(셰프 모델 관통/near-clip 방지 — QA)
      const R = 9.0, cx = state.player.x, cz = state.player.z;   // 반경↑(전경 적색 덩어리 해소)
      _chasePos.set(cx + R * Math.cos(E) * Math.sin(A), R * Math.sin(E) + 0.5, cz + R * Math.cos(E) * Math.cos(A));
      camera.position.lerp(_chasePos, 0.25);                      // 진입 시 더 빨리 정착(관통 프레임 단축)
      _chaseLook.set(cx, 1.4, cz);                                // 시선을 카운터/그릇 높이로(바닥 과점유 완화)
      camera.lookAt(_chaseLook);
    } else if (camMode === 'first') {
      // 1인칭: 주인장 눈높이에서 마우스로 고개 돌리기. 기본 시선 살짝 아래(손/그릇/작업대 보이게).
      const bob = (RM || !moving) ? 0 : Math.sin((t || 0) * 9) * 0.025; // 걷기 헤드밥(수직만, 멀미 방지)
      const ex = state.player.x, ey = 1.66 + bob, ez = state.player.z;  // 눈높이 ↑(서있는 키 — 코 박는 느낌 해소)
      const P = lookPitch - 0.08, cp = Math.cos(P);                      // 기본 시선 살짝만 아래(과한 부감 완화)
      camera.position.set(ex, ey, ez);
      _chaseLook.set(ex + Math.sin(lookYaw) * cp, ey + Math.sin(P), ez + Math.cos(lookYaw) * cp);
      camera.lookAt(_chaseLook);
    }
    // 동작 모션(조리/서빙/놓기) — 시간 기반 sin, 1인칭+3인칭 공용. RM이면 0(스냅).
    let mdx = 0, mdy = 0, mdz = 0, mtX = 0, mtZ = 0;
    if (cookAnim && !RM) {
      const a = ((t || 0) - cookAnim.t0) / cookAnim.dur;
      if (a >= 1) cookAnim = null;
      else {
        const PI = Math.PI, k = cookAnim.kind;
        if (k === 'blanch') { mdx = Math.sin(a * PI * 4) * 0.12; mdy = -Math.sin(a * PI) * 0.05; }                  // 면 털기(좌우)
        else if (k === 'pour') { mdy = -Math.sin(a * PI) * 0.05; mtZ = -Math.sin(a * PI) * 0.7; }                  // 육수 붓기(손목 기울임)
        else if (k === 'spice') { mdy = Math.abs(Math.sin(a * PI * 3)) * 0.08; mtX = Math.sin(a * PI * 3) * 0.22; } // 양념 톡톡
        else if (k === 'serve') { mdz = Math.sin(a * PI) * 0.45; mtX = Math.sin(a * PI) * 0.3; }                   // 손님께 내밀기(전방)
        else if (k === 'place') { mdy = -Math.sin(a * PI) * 0.3; }                                                 // 진열대에 내려놓기
        else { mdy = -Math.sin(a * PI) * 0.18; }                                                                   // noodle: 면 담그기
      }
    }
    // 1인칭 손 idle 호흡 / 걷기 bob(moving 재사용). RM이면 0.
    const bobH = RM ? 0 : moving ? Math.abs(Math.sin((t || 0) * 9)) * 0.03 : Math.sin((t || 0) * 2) * 0.012;
    const swayX = (RM || !moving) ? 0 : Math.sin((t || 0) * 4.5) * 0.02;
    if (camMode === 'first') {
      // 1인칭: 손·그릇이 보는 방향(yaw)을 따라가고, 동작/걷기 모션은 시야 프레임으로 적용.
      const sy = Math.sin(lookYaw), cy = Math.cos(lookYaw);
      if (fpHands) {
        fpHands.position.set(mdx * cy + mdz * sy + swayX, mdy + bobH, -mdx * sy + mdz * cy);
        fpHands.rotation.set(mtX, lookYaw, mtZ);
      }
      const fwd = 0.56 + mdz;
      heldBowl.position.set(fwd * sy + mdx * cy, 1.26 + mdy + bobH, fwd * cy - mdx * sy); // 손목(±0.20,1.28,0.60) 높이에 맞춰 양손이 테두리 그립(QA)
      heldBowl.rotation.set(mtX, lookYaw, mtZ);
    } else { // 3인칭/고정: 그릇은 가슴 정면 + 동작 모션.
      heldBowl.position.set(mdx, 1.18 + mdy, 0.42 + mdz); heldBowl.rotation.set(mtX, 0, mtZ);
    }
    const holding = state.player.holding;
    heldBowl.visible = holding !== null;
    if (holding) {
      const isDone = holding.stage === 'done';
      const useAI = isDone && aiBowl && aiBowl.children.length > 0; // 완성 시에만 AI 그릇
      if (procBowl) procBowl.visible = !useAI;
      if (aiBowl) aiBowl.visible = useAI;
      if (!useAI) { // 조리 단계: 절차적 그릇 + 단계별 음식 레이어로 진행 상황 표시
        if (foodNoodle) foodNoodle.visible = true;
        if (foodBroth) foodBroth.visible = holding.stage === 'brothed' || isDone;
        if (foodGarnish) foodGarnish.visible = isDone;
      }
    }
    // 진열대에 놓인 그릇들 — state.placed 로 표시/단계 토글.
    placedBowls.forEach((pb, i) => {
      const b = state.placed[i];
      pb.mesh.visible = !!b;
      if (!b) return;
      const isDone = b.stage === 'done';
      const useAI = isDone && pb.ai && pb.ai.children.length > 0;
      if (pb.proc) pb.proc.visible = !useAI;
      if (pb.ai) pb.ai.visible = useAI;
      if (!useAI) {
        if (pb.fn) pb.fn.visible = true;
        if (pb.fb) pb.fb.visible = b.stage === 'brothed' || isDone;
        if (pb.fg) pb.fg.visible = isDone;
      }
    });

    // customers by slot
    const bySlot = new Map(state.customers.map((c) => [c.slot, c]));
    slotCustomers.forEach((sc, i) => {
      const c = bySlot.get(i);
      sc.mesh.visible = !!c;
      sc.gauge.visible = !!c;
      sc.order.visible = !!c;
      if (c) {
        sc.order.userData.setSpice(c.order.spice);
        // AI 캐릭터 GLB 가 로드돼 있으면 그걸 쓰고 절차적은 숨김; 없으면 절차적 몸통+소품 폴백.
        const aiHolder = sc.ai[c.archetype];
        const useAI = !!(aiHolder && aiHolder.children.length);
        sc.proc.visible = !useAI;
        for (const k in sc.ai) { const h = sc.ai[k]; if (h) h.visible = useAI && k === c.archetype; }
        if (!useAI) {
          sc.body.material.color.setHex(ARCH_COLOR[c.archetype] ?? 0x4a6a8a);
          for (const k in sc.props) { const pr = sc.props[k]; if (pr) pr.visible = (c.archetype === k); }
        }
        const pp = patienceProgress(c);
        // patience: green when calm → red when about to leave
        setGaugeFill(sc.fill, pp, pp > 0.75 ? 0xff5a5a : pp > 0.5 ? 0xffcf6a : 0x6dff8f);
        // idle bob + anxious shake when patience high
        sc.mesh.position.y = RM ? 0 : Math.sin((t || 0) * 2.5 + i) * 0.04;
        const pp2 = patienceProgress(c);
        sc.mesh.rotation.z = RM ? 0 : pp2 > 0.7 ? Math.sin((t || 0) * 14) * 0.12 : 0;
      }
    });

    // blancher slots
    slotGauges.forEach((sg, i) => {
      const slot = state.blancher.slots[i];
      sg.group.visible = !!slot;
      if (slot) { const p = slotProgress(slot); setGaugeFill(sg.fill, p, gaugeColor(p)); }
    });
  }
  function render() { renderer.render(scene, camera); }
  function dispose() { orbit.dispose(); renderer.dispose(); }

  // 이동을 시점 기준으로 회전시키기 위한 현재 시점 yaw(1인칭/추격에서만, 그 외 0).
  function getViewYaw() { return (camMode === 'first' || camMode === 'chase') ? lookYaw : 0; }
  const _now = () => (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  // 동작 모션 트리거 — kind: 'noodle'|'blanch'|'pour'|'spice'|'serve'|'place'. 기본 0.5s, 서빙/놓기는 0.45s.
  function cookMotion(kind = 'noodle') { cookAnim = { kind, t0: _now(), dur: (kind === 'serve' || kind === 'place') ? 0.45 : 0.5 }; }
  return { sync, render, dispose, cycleCamMode, getCamMode: () => camMode, requestLook, isLooking: () => pointerLocked, cookMotion, getViewYaw };
}
