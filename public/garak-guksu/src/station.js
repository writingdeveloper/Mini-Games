import * as THREE from 'three';

// 역전국수 플랫폼 장면 — 1970-80년대 한국 기차역 가락국수 컨셉.
// scene.js / logic.js 를 건드리지 않는 "무대 장식" 모듈.
//
// 카메라 사실(불변): scene.js camera.position=(0,7.5,-7), lookAt=(0,0.5,1.5)
//   → 카메라가 -z 에서 +z 를 본다.
//   화면 위    = 월드 +z   (손님 카운터 z≈3.2, 그 뒤 선로/기관차 z≈8.5, 맞은편 승강장 z≈12.6)
//   화면 아래  = 월드 -z   (조리대 z=-1.5, 카메라 근접)
//   화면 오른쪽 = 월드 -x
// PlaneGeometry 앞면 법선은 +z 라서, +z 를 보는 카메라엔 뒷면이 보인다 → 보드/배경은 rotation.y=Math.PI.
//
// 컨셉 오버홀(페르소나 검토 반영): 유럽풍 실사 배경 제거 → 절차적 한국 야간 플랫폼 +
//   에라별 저폴리 기관차(증기/디젤/막차)를 세우고 증기를 기관차 굴뚝에서 피운다.

const STATION_MOOD = {
  '증기': { steam: 1.0, bulb: 1.0 },
  '디젤': { steam: 0.7, bulb: 0.95 },
  '막차': { steam: 0.5, bulb: 1.1 },
};
let curEra = '증기';

// 굴뚝(증기 발생 원점) 월드 좌표 — 기관차 그룹 z=6.6 + 증기기관차 굴뚝 로컬(-2.2, ~3.0).
const CHIMNEY = { x: -2.2, z: 6.6 };

// 매달린 백열등 위치(소수 — 성능). x는 화면 양옆, z는 카운터 근처.
const BULB_SPOTS = [
  { x: -3.4, z: 1.4 },
  { x: 3.4, z: 1.4 },
  { x: 0, z: -0.4 },
];

// 근경 기둥 위치(양옆 — 화면 좌우 프레이밍).
const PILLAR_SPOTS = [
  { x: -4.6, z: 0.6 }, { x: 4.6, z: 0.6 },
  { x: -4.6, z: -3.0 }, { x: 4.6, z: -3.0 },
];

// ---- 캔버스 텍스처 헬퍼 ----------------------------------------------------

// 고전 역명판: 청색 바탕 + 흰 테두리 + 한글/영문.
function makeSignTexture(ko, en) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#0d3b66'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#f3f4ef'; x.lineWidth = 10; x.strokeRect(14, 14, c.width - 28, c.height - 28);
  x.lineWidth = 3; x.strokeRect(28, 28, c.width - 56, c.height - 56);
  x.fillStyle = '#f6f7f1'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 110px "Malgun Gothic", system-ui, sans-serif';
  x.fillText(ko, c.width / 2, 108);
  x.font = '700 44px system-ui, sans-serif';
  x.fillText(en, c.width / 2, 196);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// 맞은편 승강장 행선(行先) 안내판: 어두운 녹색 + 흰 글씨 + 방면 화살표.
function makeDestTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#13322a'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#eef2ea'; x.lineWidth = 8; x.strokeRect(10, 10, c.width - 20, c.height - 20);
  x.fillStyle = '#f3f7f0'; x.textBaseline = 'middle';
  x.font = '900 86px "Malgun Gothic", system-ui, sans-serif';
  x.textAlign = 'left';  x.fillText('← 목포', 60, 100);
  x.textAlign = 'center'; x.fillText('대전 ·  DAEJEON', c.width / 2, 100);
  x.textAlign = 'right'; x.fillText('서울 →', c.width - 60, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// 발차 안내판(전광판). setDwell 로 갱신. color 인자로 임박 시 적색 전환.
function drawDwellCanvas(c, text, color = '#ffb12e') {
  const x = c.getContext('2d');
  x.fillStyle = '#10130c'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#3a3320'; x.lineWidth = 8; x.strokeRect(8, 8, c.width - 16, c.height - 16);
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 52px "Malgun Gothic", system-ui, sans-serif';
  x.fillText(text, c.width / 2, c.height / 2);
}

// 포장마차 간판: 적색 천막 + 한글 "역전 가락국수".
function makeStallSignTexture() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 200;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#7a1f14'); g.addColorStop(1, '#a8331b');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#ffcf6a'; x.fillRect(0, 0, c.width, 14); x.fillRect(0, c.height - 14, c.width, 14);
  x.fillStyle = '#fff4dc'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 92px "Malgun Gothic", system-ui, sans-serif';
  x.fillText('역전 가락국수', c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// 카메라(-z)를 향하는 캔버스 보드 메시(언릿).
function makeBoardMesh(tex, w, h) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.rotation.y = Math.PI; // 앞면이 카메라(-z)를 보게
  return mesh;
}

// 작은 조리대 라벨 보드(역명판 톤). createScene/scene.js 가 STATIONS 좌표에 배치.
export function makeStationLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(13,28,48,0.92)'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#ffcf6a'; x.lineWidth = 6; x.strokeRect(6, 6, c.width - 12, c.height - 12);
  x.fillStyle = '#fff4dc'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '800 46px "Malgun Gothic", system-ui, sans-serif';
  x.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const board = makeBoardMesh(tex, 1.5, 0.56);
  return board;
}

// ---- 메인 빌더 -------------------------------------------------------------

export function buildStation(scene, opts = {}) {
  const reducedMotion = !!opts.reducedMotion;
  const group = new THREE.Group();
  group.name = 'station';
  scene.add(group);

  const lights = [];     // 백열등 PointLight 핸들
  const bulbMats = [];   // 갓 emissive 머티리얼

  // 1) 절차적 한국 야간 플랫폼 배경(유럽 실사 대체) ------------------------
  buildKoreanPlatform(group);

  // 2) 전경 소품(플레이어 측) --------------------------------------------
  for (const p of PILLAR_SPOTS) group.add(makePillar(p.x, p.z));

  // 상단 캐노피 빔(카운터 위).
  {
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.85 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.4, 0.5), beamMat);
    beam.position.set(0, 4.4, 2.4); beam.castShadow = true; group.add(beam);
    for (const sx of [-4.8, 4.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 0.3), beamMat);
      post.position.set(sx, 2.2, 2.4); post.castShadow = true; group.add(post);
    }
  }

  // 매달린 백열등.
  for (const s of BULB_SPOTS) {
    const { lampGroup, bulbMat, light } = makeHangingBulb(s.x, s.z);
    group.add(lampGroup); bulbMats.push(bulbMat); lights.push(light);
  }

  // 플랫폼 가장자리 턱 + 노란 안전선(카운터 앞).
  {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x39322c, roughness: 0.95 }));
    ledge.position.set(0, 0.15, 3.9); ledge.receiveShadow = true; group.add(ledge);
    const line = new THREE.Mesh(new THREE.BoxGeometry(11, 0.02, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xf2c12e, fog: true }));
    line.position.set(0, 0.31, 3.62); group.add(line);
  }

  // 3) 역 사인: 역명판 + 발차 안내판 ------------------------------------
  {
    const sign = makeBoardMesh(makeSignTexture('대전', 'DAEJEON'), 3.2, 1.6);
    sign.position.set(-3.5, 3.85, 3.7); group.add(sign);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.8 }));
    frame.rotation.y = Math.PI; frame.position.set(-3.5, 3.85, 3.82); group.add(frame);
  }
  const dwellCanvas = document.createElement('canvas');
  dwellCanvas.width = 384; dwellCanvas.height = 128;
  drawDwellCanvas(dwellCanvas, '발차 0:00');
  const dwellTex = new THREE.CanvasTexture(dwellCanvas);
  dwellTex.colorSpace = THREE.SRGBColorSpace;
  {
    const board = makeBoardMesh(dwellTex, 2.6, 0.87);
    board.position.set(3.5, 3.85, 3.7); group.add(board);
  }

  // 4) 가락국수 포장마차 간판 ----------------------------------------------
  {
    const stall = makeBoardMesh(makeStallSignTexture(), 2.8, 0.88);
    stall.position.set(0, 3.5, 2.2); group.add(stall);
  }

  // 5) 에라별 기관차(증기/디젤/막차) — 컨셉의 핵심. -----------------------
  const loco = makeLocomotive();
  group.add(loco.group);

  // 6) 증기 — 기관차 굴뚝에서 피어오름. -----------------------------------
  const steam = makeSteam(reducedMotion, CHIMNEY);
  group.add(steam.points);

  // ---- 기관차 발차/도착 애니메이션 -----------------------------------------
  let locoX = 0, locoState = 'idle', locoPending = null;
  function showLocoEra(key) {
    for (const [k, mesh] of Object.entries(loco.byEra)) mesh.visible = (k === key);
    loco.group.visible = !!STATION_MOOD[key];
  }
  function tickLoco(dt) {
    if (locoState === 'idle' || locoState === 'gone') return;
    if (locoState === 'departing') {
      locoX -= (8 + (-locoX) * 0.85) * dt;                  // 천천히 출발 → 가속하며 빠져나감
      if (locoX <= -50) {
        if (locoPending == null) { locoState = 'gone'; loco.group.visible = false; return; }
        showLocoEra(locoPending); locoX = 50; locoState = 'arriving'; // 다음 열차가 반대편에서 진입
      }
    } else if (locoState === 'arriving') {
      locoX -= (9 + locoX * 0.5) * dt;                      // 미끄러져 들어와 감속 정차
      if (locoX <= 0.05) { locoX = 0; locoState = 'idle'; steam.setDensity(STATION_MOOD[curEra]?.steam ?? 1); }
    }
    loco.group.position.x = locoX;
  }
  _locoRef = tickLoco;

  // ---- 핸들 메서드 --------------------------------------------------------
  // setEra: 등/증기 무드만 갱신(기관차 교체는 발차 애니메이션이 담당).
  function setEra(era) {
    const key = typeof era === 'string' ? era : era?.era;
    const m = STATION_MOOD[key];
    if (!m) return;
    curEra = key;
    for (const mat of bulbMats) mat.emissiveIntensity = m.bulb;
    for (const l of lights) l.intensity = 1.0 * m.bulb;
    if (locoState === 'idle') steam.setDensity(m.steam);
  }
  function setDwell(text, urgent = false) {
    drawDwellCanvas(dwellCanvas, String(text), urgent ? '#ff4d3a' : '#ffb12e');
    dwellTex.needsUpdate = true;
  }
  function setSteam(d) { steam.setDensity(d); }
  // departTrain: 발차! 정차 열차가 미끄러져 나가고 다음 era 열차가 진입. null=막차 후 영영 떠남.
  function departTrain(nextEra) {
    if (locoState !== 'idle') return;
    locoPending = (nextEra && STATION_MOOD[nextEra]) ? nextEra : null;
    locoState = 'departing';
    steam.setDensity(0);
  }
  // resetTrain: 리플레이 시 기관차를 초기 정차 상태로 복구.
  function resetTrain(era) {
    const key = (era && STATION_MOOD[era]) ? era : '증기';
    locoState = 'idle'; locoPending = null; locoX = 0;
    loco.group.position.x = 0; loco.group.visible = true;
    showLocoEra(key);
    steam.setDensity(STATION_MOOD[key].steam);
  }

  // 초기 가시성: 현재 에라 기관차만.
  showLocoEra(curEra);

  return { setEra, setDwell, setSteam, departTrain, resetTrain, group, loco: loco.group };
}

// 매 프레임(t=초). 증기 상승 + 기관차 발차/도착 애니메이션.
let _steamRef = null;
let _locoRef = null;
let _lastT = 0;
export function tickStation(t) {
  const dt = Math.min(0.05, t - _lastT || 0); _lastT = t;
  if (_steamRef) _steamRef.update(t);
  if (_locoRef) _locoRef(dt);
}

// ---- 절차적 한국 플랫폼 배경 -----------------------------------------------

function buildKoreanPlatform(group) {
  // 야간 배경 벽(실사 대체) — 매우 어둡게, 안개에 잠김.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 36),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), fog: true, toneMapped: false }));
  wall.rotation.y = Math.PI; wall.position.set(0, 12, 16.5); group.add(wall);

  // 선로 자갈(ballast) — 기관차 아래.
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(46, 0.12, 3.6),
    new THREE.MeshStandardMaterial({ color: 0x1b1920, roughness: 1.0 }));
  ballast.position.set(0, 0.05, 6.6); ballast.receiveShadow = true; group.add(ballast);
  // 레일 2줄.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6b6b74, metalness: 0.6, roughness: 0.4 });
  for (const rz of [5.9, 7.3]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(46, 0.08, 0.1), railMat);
    rail.position.set(0, 0.14, rz); group.add(rail);
  }

  // 맞은편 콘크리트 승강장 슬래브.
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x3c3c44, roughness: 0.95 });
  const opp = new THREE.Mesh(new THREE.BoxGeometry(46, 0.7, 3.6), concreteMat);
  opp.position.set(0, 0.35, 12.7); opp.receiveShadow = true; group.add(opp);

  // 맞은편 캐노피(직선 H빔 기둥 + 평지붕) — 소박한 한국 역.
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x33333b, roughness: 0.85 });
  for (const px of [-14, -6, 2, 10, 18]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 0.35), beamMat);
    post.position.set(px, 2.5, 13.1); group.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(44, 0.45, 3.8), beamMat);
  roof.position.set(0, 4.8, 12.7); group.add(roof);

  // 맞은편 캐노피에 한글 행선(行先) 안내판.
  const dest = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.58),
    new THREE.MeshBasicMaterial({ map: makeDestTexture(), fog: true, toneMapped: false }));
  dest.rotation.y = Math.PI; dest.position.set(0, 3.55, 11.1); group.add(dest);

  // 맞은편 등불 몇 개(따뜻한 점광 대신 발광 구 — 성능).
  for (const lx of [-10, 2, 14]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd9a, fog: true }));
    bulb.position.set(lx, 4.0, 12.9); group.add(bulb);
  }

  // 기관차/선로를 비추는 따뜻한 키라이트(그림자 없음 — 성능). 주인공이 어둠에 묻히지 않게.
  const trainKey = new THREE.PointLight(0xffd2a0, 2.2, 22, 1.4);
  trainKey.position.set(0, 4.6, 6.0); group.add(trainKey);
}

// ---- 기관차 -----------------------------------------------------------------

function wheel(r, x, y) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.8, metalness: 0.3 }));
  w.rotation.x = Math.PI / 2; w.position.set(x, y, 0);
  return w;
}

function makeLocomotive() {
  const group = new THREE.Group();
  group.position.set(0, 0, 6.6); // 플랫폼 가장자리 바로 앞에 정차(크고 또렷하게).
  group.scale.setScalar(1.12);
  const steam = makeSteamLoco();
  const diesel = makeDieselLoco(false);
  const last = makeDieselLoco(true);
  group.add(steam, diesel, last);
  return { group, byEra: { '증기': steam, '디젤': diesel, '막차': last } };
}

// 증기기관차(미카급 실루엣) — 보일러가 X축으로 누움. 굴뚝이 증기 발생점.
function makeSteamLoco() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x32323e, roughness: 0.5, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3c3c48, roughness: 0.7 });
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 5.2, 18), iron);
  boiler.rotation.z = Math.PI / 2; boiler.position.set(-0.2, 1.6, 0); boiler.castShadow = true; g.add(boiler);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 18), iron);
  cap.rotation.z = Math.PI / 2; cap.position.set(-2.9, 1.6, 0); g.add(cap);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.0, 12), iron);
  chimney.position.set(-2.2, 2.55, 0); g.add(chimney);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), iron);
  dome.position.set(0.2, 2.3, 0); g.add(dome);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.8, 2.1), dark);
  cab.position.set(2.4, 1.95, 0); cab.castShadow = true; g.add(cab);
  // 운전실 점등창(어둠 속에서도 기차가 읽히는 따뜻한 등불).
  const cabWin = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.62, 1.5),
    new THREE.MeshBasicMaterial({ color: 0xffb24a, fog: true }));
  cabWin.position.set(2.4, 2.24, 0); g.add(cabWin);
  // 화실(firebox) 불빛.
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.5),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, fog: true }));
  glow.position.set(1.55, 0.95, 0); g.add(glow);
  const fireLight = new THREE.PointLight(0xff7a30, 0.8, 8, 1.8);
  fireLight.position.set(1.6, 1.0, 0); g.add(fireLight);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 1.6), iron);
  frame.position.set(0, 0.95, 0); g.add(frame);
  const pilot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.2), iron);
  pilot.position.set(-3.35, 0.7, 0); g.add(pilot);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
  lamp.position.set(-3.0, 2.05, 0); g.add(lamp);
  for (const x of [-1.6, -0.2, 1.2]) g.add(wheel(0.7, x, 0.7));
  g.add(wheel(0.45, 2.3, 0.55));
  return g;
}

// 디젤/막차 기관차(박스 노즈). isLast=막차(어두운 실루엣 + 강한 전조등).
function makeDieselLoco(isLast) {
  const g = new THREE.Group();
  const bodyColor = isLast ? 0x15171e : 0x5a2630; // 막차 어둠 / 디젤 마룬
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.9, 1.7), bodyMat);
  body.position.set(0, 1.7, 0); body.castShadow = true; g.add(body);
  if (!isLast) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.62, 0.32, 1.72),
      new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.7 }));
    stripe.position.set(0, 1.95, 0); g.add(stripe);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 1.6), bodyMat);
  nose.position.set(-3.0, 1.4, 0); g.add(nose);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.3, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 }));
  roof.position.set(0.2, 2.75, 0); g.add(roof);
  const winMat = new THREE.MeshBasicMaterial({ color: isLast ? 0x5a4a26 : 0xffd98a, fog: true });
  for (const x of [-1.2, 0.4, 2.0]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.72), winMat);
    w.position.set(x, 2.05, 0); g.add(w);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(isLast ? 0.26 : 0.18, 12, 10),
    new THREE.MeshBasicMaterial({ color: isLast ? 0xffffff : 0xfff2c0, fog: false }));
  lamp.position.set(-3.45, 1.5, 0); g.add(lamp);
  if (isLast) { const hl = new THREE.PointLight(0xfff0d0, 1.2, 16, 1.6); hl.position.set(-4.4, 1.5, 0); g.add(hl); }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.4, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.8 }));
  frame.position.set(0, 0.85, 0); g.add(frame);
  for (const bx of [-1.8, 1.8]) {
    const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.8 }));
    bogie.position.set(bx, 0.6, 0); g.add(bogie);
    g.add(wheel(0.42, bx - 0.5, 0.45)); g.add(wheel(0.42, bx + 0.5, 0.45));
  }
  return g;
}

// ---- 내부 빌더들 -----------------------------------------------------------

function makePillar(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.9 });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), mat);
  shaft.position.y = 2.6; shaft.castShadow = true; shaft.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), mat);
  base.position.y = 0.2; base.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), mat);
  cap.position.y = 5.1; cap.castShadow = true;
  g.add(shaft, base, cap); g.position.set(x, 0, z);
  return g;
}

function makeHangingBulb(x, z) {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }));
  cord.position.y = 4.0; g.add(cord);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x6a4a2a, emissive: 0xffb24a, emissiveIntensity: 1.0, roughness: 0.6, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.42, 16, 1, true), shadeMat);
  shade.position.y = 3.34; g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8, fog: false }));
  bulb.position.y = 3.18; g.add(bulb);
  const light = new THREE.PointLight(0xffcf6a, 1.0, 10, 1.4);
  light.position.y = 3.1; g.add(light);
  g.position.set(x, 0, z);
  return { lampGroup: g, bulbMat: shadeMat, light };
}

// 증기 파티클 — 굴뚝(origin)에서 위로 상승 + 알파 페이드. reducedMotion이면 정적/최소.
function makeSteam(reducedMotion, origin) {
  const COUNT = reducedMotion ? 36 : 150;
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  const baseX = new Float32Array(COUNT);
  const baseZ = new Float32Array(COUNT);
  const swayAmp = new Float32Array(COUNT);
  const Y0 = 2.4, RISE = 4.6;
  for (let i = 0; i < COUNT; i++) {
    const bx = origin.x + (Math.random() - 0.5) * 2.8;
    const bz = origin.z + (Math.random() - 0.5) * 1.3;
    baseX[i] = bx; baseZ[i] = bz;
    speeds[i] = 0.5 + Math.random() * 0.7;
    phase[i] = Math.random();
    swayAmp[i] = 0.3 + Math.random() * 0.6;
    positions[i * 3] = bx; positions[i * 3 + 1] = Y0 + phase[i] * RISE; positions[i * 3 + 2] = bz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: makeSteamSprite(), color: 0xeef0ea, size: 3.8, sizeAttenuation: true,
    transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const points = new THREE.Points(geo, mat);
  points.name = 'steam'; points.frustumCulled = false;

  let density = 1.0; const baseOpacity = 0.56;
  function setDensity(d) {
    density = Math.max(0, Math.min(1, d));
    mat.opacity = reducedMotion ? baseOpacity * density * 0.5 : baseOpacity * density;
  }
  setDensity(1.0);

  let lastT = 0;
  function update(t) {
    if (reducedMotion) return;
    const dt = Math.min(0.05, t - lastT || 0); lastT = t;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      phase[i] += dt * speeds[i] * 0.14;
      if (phase[i] > 1) phase[i] -= 1;
      const life = phase[i];
      pos[i * 3] = baseX[i] + Math.sin(t * 0.6 + i) * swayAmp[i] * life;
      pos[i * 3 + 1] = Y0 + life * RISE;
      pos[i * 3 + 2] = baseZ[i];
    }
    geo.attributes.position.needsUpdate = true;
  }
  const handle = { points, setDensity, update };
  _steamRef = handle;
  return handle;
}

// 야간 하늘/지평선 — 위는 칠흑, 기차 높이(아래쪽)에 따뜻한 글로우 띠 → 기차 실루엣 백라이트.
function makeSkyTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0.00, '#04050a');
  g.addColorStop(0.58, '#0b0e1a');
  g.addColorStop(0.74, '#2a1e2a');
  g.addColorStop(0.84, '#4a3326');
  g.addColorStop(0.92, '#241a1e');
  g.addColorStop(1.00, '#0a0a12');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSteamSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(235,226,212,0.45)');
  g.addColorStop(1, 'rgba(235,226,212,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
