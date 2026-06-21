import * as THREE from 'three';

// 역전국수 플랫폼 장면 — 1980년대 한국 기차역 가락국수 컨셉.
// scene.js / logic.js 를 건드리지 않고 분리한 "무대 장식" 모듈.
//
// 카메라 사실(불변): scene.js camera.position=(0,7.5,-7), lookAt=(0,0.5,1.5)
//   → 카메라가 -z 에서 +z 를 본다.
//   화면 위    = 월드 +z   (손님 카운터 z≈3.2, 더 멀리 배경판 z≈+12)
//   화면 아래  = 월드 -z   (조리대 z=-1.5, 카메라 근접)
//   화면 오른쪽 = 월드 -x
// PlaneGeometry 의 앞면 법선은 +z 라서, +z 를 보는 카메라에는 뒷면이 보인다.
// → 배경판/사인판은 rotation.y=Math.PI 로 돌려 앞면이 카메라(-z)를 향하게 한다.

// 에라(웨이브군)별 무드 — 배경 틴트 / 스팀 농도 / 등 밝기.
// scene.js 의 ERA_MOOD 와 별개(이 모듈은 setEra(era) 로 받아 무대만 조정).
// 막차에도 플레이영역이 읽히도록 배경을 과하게 어둡히지 않는다.
const STATION_MOOD = {
  '증기': { tint: 0xc9ad86, steam: 1.0, bulb: 1.0 }, // 따뜻·증기 진함
  '디젤': { tint: 0xa88a6e, steam: 0.75, bulb: 0.95 },
  '막차': { tint: 0x8a7458, steam: 0.55, bulb: 1.1 }, // 늦은 밤·등불만 또렷
};

// 매달린 백열등 위치(소수만 — 성능). x는 화면 양옆, z는 카운터 근처~중앙.
const BULB_SPOTS = [
  { x: -3.4, z: 1.4 },
  { x: 3.4, z: 1.4 },
  { x: 0, z: -0.4 },
];

// 근경 기둥 위치(양옆 — 화면 좌우 프레이밍).
const PILLAR_SPOTS = [
  { x: -4.6, z: 0.6 },
  { x: 4.6, z: 0.6 },
  { x: -4.6, z: -3.0 },
  { x: 4.6, z: -3.0 },
];

// ---- 캔버스 텍스처 헬퍼 ----------------------------------------------------

// 고전 역명판: 청색 바탕 + 흰 테두리 + 한글/영문. 가로로 긴 보드.
function makeSignTexture(ko, en) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  // 짙은 철도청 청색
  x.fillStyle = '#0d3b66';
  x.fillRect(0, 0, c.width, c.height);
  // 흰 테두리 두 줄
  x.strokeStyle = '#f3f4ef';
  x.lineWidth = 10;
  x.strokeRect(14, 14, c.width - 28, c.height - 28);
  x.lineWidth = 3;
  x.strokeRect(28, 28, c.width - 56, c.height - 56);
  x.fillStyle = '#f6f7f1';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  // 한글(크게)
  x.font = '900 110px "Malgun Gothic", system-ui, sans-serif';
  x.fillText(ko, c.width / 2, 108);
  // 영문(작게)
  x.font = '700 44px system-ui, sans-serif';
  x.fillText(en, c.width / 2, 196);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 발차 안내판: 어두운 보드 + 호박색 글씨(전광판 느낌). setDwell 로 갱신.
function drawDwellCanvas(c, text) {
  const x = c.getContext('2d');
  x.fillStyle = '#10130c';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#3a3320';
  x.lineWidth = 8;
  x.strokeRect(8, 8, c.width - 16, c.height - 16);
  x.fillStyle = '#ffb12e';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 52px "Malgun Gothic", system-ui, sans-serif';
  x.fillText(text, c.width / 2, c.height / 2);
}

// 포장마차 간판: 호박/적색 천막 톤 + 한글 "역전 가락국수".
function makeStallSignTexture() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 200;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#7a1f14');
  g.addColorStop(1, '#a8331b');
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  // 위아래 호박색 띠
  x.fillStyle = '#ffcf6a';
  x.fillRect(0, 0, c.width, 14);
  x.fillRect(0, c.height - 14, c.width, 14);
  x.fillStyle = '#fff4dc';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 92px "Malgun Gothic", system-ui, sans-serif';
  x.fillText('역전 가락국수', c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 카메라(-z)를 향하는 캔버스 보드 메시(언릿).
function makeBoardMesh(tex, w, h, { emissive = false } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.rotation.y = Math.PI; // 앞면이 카메라(-z)를 보게
  if (emissive) mesh.renderOrder = 1;
  return mesh;
}

// ---- 메인 빌더 -------------------------------------------------------------

export function buildStation(scene, opts = {}) {
  const reducedMotion = !!opts.reducedMotion;
  const group = new THREE.Group();
  group.name = 'station';
  scene.add(group);

  const lights = [];     // 백열등 PointLight 핸들(setEra 밝기 조정)
  const bulbMats = [];   // 갓 emissive 머티리얼
  let bgMat = null;      // 배경판 머티리얼(setEra 틴트 조정)

  // 1) 배경판 — 실사 매트 플레이트.
  //    텍스처 로드 실패해도 throw 금지: onError 시 어두운 폴백색.
  {
    const W = 44, H = 24.75; // 2400x1350 비율 유지
    // 폴백 머티리얼(따뜻한 야간 톤). 로드 성공 시 map 채움.
    bgMat = new THREE.MeshBasicMaterial({ color: 0x2a2433, fog: true, toneMapped: false });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
    bg.rotation.y = Math.PI;       // 앞면이 카메라를 향하게
    bg.position.set(0, 9, 12);     // 카운터 뒤 멀리, 위로
    bg.name = 'platformBg';
    group.add(bg);

    try {
      const loader = new THREE.TextureLoader();
      loader.load(
        '/garak-guksu/img/platform-bg.jpg',
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          bgMat.map = tex;
          // 살짝 어둡고 따뜻한 틴트 → 전경/안개와 블렌드.
          bgMat.color.setHex(STATION_MOOD[curEra]?.tint ?? 0xb89878);
          bgMat.needsUpdate = true;
        },
        undefined,
        () => { /* onError: 폴백색 유지 */ bgMat.color.setHex(0x241f2e); }
      );
    } catch {
      bgMat.color.setHex(0x241f2e); // TextureLoader 자체 실패 가드
    }

    // 하단 그라데이션 판 — 배경 밑동을 바닥(어두운 보라)과 자연 블렌드.
    const grad = makeFloorBlend();
    grad.position.set(0, 1.6, 11.4);
    group.add(grad);
  }

  // 2) 전경 소품 ----------------------------------------------------------

  // 근경 기둥(저폴리 박스 기둥 + 받침).
  for (const p of PILLAR_SPOTS) {
    group.add(makePillar(p.x, p.z));
  }

  // 상단 캐노피 빔(카운터 위를 가로지르는 굵은 보).
  {
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.85 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.4, 0.5), beamMat);
    beam.position.set(0, 4.4, 2.4);
    beam.castShadow = true;
    group.add(beam);
    // 가로 보를 받치는 세로 짧은 기둥 2개
    for (const sx of [-4.8, 4.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 0.3), beamMat);
      post.position.set(sx, 2.2, 2.4);
      post.castShadow = true;
      group.add(post);
    }
  }

  // 매달린 백열등 갓(emissive) + 소수 PointLight.
  for (const s of BULB_SPOTS) {
    const { lampGroup, bulbMat, light } = makeHangingBulb(s.x, s.z);
    group.add(lampGroup);
    bulbMats.push(bulbMat);
    lights.push(light);
  }

  // 플랫폼 가장자리 턱 + 노란 안전선(카운터 앞, 화면 상단 쪽 z>카운터).
  {
    const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x39322c, roughness: 0.95 });
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 0.6), ledgeMat);
    ledge.position.set(0, 0.15, 3.9);
    ledge.receiveShadow = true;
    group.add(ledge);
    // 노란 안전선(언릿 가는 띠)
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.02, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xf2c12e, fog: true })
    );
    line.position.set(0, 0.31, 3.62);
    group.add(line);
  }

  // 3) 역 사인: 역명판 "대전 / DAEJEON" + 발차 안내판 -----------------------

  // 역명판 — 카운터 위/뒤, 잘 보이게.
  {
    const sign = makeBoardMesh(makeSignTexture('대전', 'DAEJEON'), 3.2, 1.6);
    sign.position.set(-3.5, 3.85, 3.7);
    group.add(sign);
    // 사인 받침 프레임(짧은 박스)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.8, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.8 })
    );
    frame.rotation.y = Math.PI;
    frame.position.set(-3.5, 3.85, 3.82);
    group.add(frame);
  }

  // 발차 안내판(전광판). setDwell(text) 로 갱신.
  const dwellCanvas = document.createElement('canvas');
  dwellCanvas.width = 384; dwellCanvas.height = 128;
  drawDwellCanvas(dwellCanvas, '발차 0:00');
  const dwellTex = new THREE.CanvasTexture(dwellCanvas);
  dwellTex.colorSpace = THREE.SRGBColorSpace;
  {
    const board = makeBoardMesh(dwellTex, 2.6, 0.87);
    board.position.set(3.5, 3.85, 3.7);
    group.add(board);
  }

  // 4) 가락국수 포장마차 간판 — 조리 카운터 전경 상단(컨셉 명확화). --------
  {
    const stall = makeBoardMesh(makeStallSignTexture(), 3.0, 0.94);
    // 캐노피 빔 앞에 작게 매달린 느낌 — 배경·손님·역명판을 가리지 않게.
    stall.position.set(0, 3.85, 2.2);
    group.add(stall);
  }

  // 5) 증기 파티클 — 배경/기차 근처에서 위로 상승 + 알파 페이드 루프. ------
  const steam = makeSteam(reducedMotion);
  group.add(steam.points);

  // ---- 핸들 메서드 --------------------------------------------------------

  // setEra(era): '증기'|'디젤'|'막차'(또는 무드 객체). 배경 틴트/스팀/등 밝기.
  function setEra(era) {
    const key = typeof era === 'string' ? era : era?.era;
    const m = STATION_MOOD[key];
    if (!m) return;
    curEra = key;
    if (bgMat && bgMat.map) bgMat.color.setHex(m.tint);
    for (const mat of bulbMats) mat.emissiveIntensity = m.bulb;
    for (const l of lights) l.intensity = 1.0 * m.bulb;
    steam.setDensity(m.steam);
  }

  // setDwell(text): 발차 안내판 갱신. text 없으면 초 숫자 등 호출측 자유.
  function setDwell(text) {
    drawDwellCanvas(dwellCanvas, String(text));
    dwellTex.needsUpdate = true;
  }

  // setSteam(d): 0~1 스팀 농도 직접 조정.
  function setSteam(d) { steam.setDensity(d); }

  return { setEra, setDwell, setSteam, group, _steam: steam };
}

// 매 프레임 시간기반 애니메이션(t=초). 스팀 상승/페이드.
let _steamRef = null;
export function tickStation(t) {
  if (_steamRef) _steamRef.update(t);
}

// ---- 내부 빌더들 -----------------------------------------------------------

let curEra = '증기'; // 배경 로드 콜백/초기 틴트 기본값

// 근경 기둥(저폴리).
function makePillar(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.9 });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), mat);
  shaft.position.y = 2.6; shaft.castShadow = true; shaft.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), mat);
  base.position.y = 0.2; base.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), mat);
  cap.position.y = 5.1; cap.castShadow = true;
  g.add(shaft, base, cap);
  g.position.set(x, 0, z);
  return g;
}

// 매달린 백열등: 코드(가는 실린더) + 갓(원뿔) + 발광 전구 + 소수 PointLight.
function makeHangingBulb(x, z) {
  const g = new THREE.Group();
  // 천장에서 내려오는 코드
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
  );
  cord.position.y = 4.0;
  g.add(cord);
  // 갓(원뿔, 열린 아래) — emissive 살짝
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x6a4a2a, emissive: 0xffb24a, emissiveIntensity: 1.0,
    roughness: 0.6, side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.42, 16, 1, true), shadeMat);
  shade.position.y = 3.34;
  g.add(shade);
  // 전구(작은 발광 구)
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8, fog: false })
  );
  bulb.position.y = 3.18;
  g.add(bulb);
  // 따뜻한 PointLight(소수·성능). distance 제한.
  const light = new THREE.PointLight(0xffcf6a, 1.0, 10, 1.4);
  light.position.y = 3.1;
  g.add(light);

  g.position.set(x, 0, z);
  return { lampGroup: g, bulbMat: shadeMat, light };
}

// 배경 밑동 ↔ 바닥 블렌드용 그라데이션 판(아래로 갈수록 짙음, 위는 투명).
function makeFloorBlend() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, 'rgba(18,14,24,0)');     // 위: 투명
  grd.addColorStop(1, 'rgba(14,11,20,0.95)');  // 아래: 짙은 바닥색
  x.fillStyle = grd;
  x.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true })
  );
  mesh.rotation.y = Math.PI;
  return mesh;
}

// 증기 파티클. THREE.Points — 위로 상승하며 알파 페이드 후 바닥에서 재생성.
// reducedMotion 이면 정적/최소(움직임 없음, 옅게).
function makeSteam(reducedMotion) {
  const COUNT = reducedMotion ? 40 : 160;
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);   // 상승 속도
  const phase = new Float32Array(COUNT);    // 0~1 수명 위상
  const baseX = new Float32Array(COUNT);
  const baseZ = new Float32Array(COUNT);
  const swayAmp = new Float32Array(COUNT);

  // 배경/기차 근처(z 5~13, 화면 위쪽 멀리)에서 피어오르게.
  for (let i = 0; i < COUNT; i++) {
    const bx = (Math.random() - 0.5) * 24;
    const bz = 5 + Math.random() * 8;
    baseX[i] = bx; baseZ[i] = bz;
    speeds[i] = 0.5 + Math.random() * 0.7;
    phase[i] = Math.random();
    swayAmp[i] = 0.3 + Math.random() * 0.5;
    positions[i * 3] = bx;
    positions[i * 3 + 1] = 1 + phase[i] * 7;
    positions[i * 3 + 2] = bz;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // 부드러운 원형 스프라이트(캔버스 방사형 그라데이션).
  const sprite = makeSteamSprite();
  const mat = new THREE.PointsMaterial({
    map: sprite,
    color: 0xe9e2d4,
    size: 2.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.0, // setDensity 로 켬
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'steam';
  points.frustumCulled = false;

  let density = 1.0;
  const baseOpacity = 0.32;

  function setDensity(d) {
    density = Math.max(0, Math.min(1, d));
    mat.opacity = reducedMotion ? baseOpacity * density * 0.5 : baseOpacity * density;
  }
  setDensity(1.0);

  let lastT = 0;
  function update(t) {
    if (reducedMotion) return; // 정적
    const dt = Math.min(0.05, t - lastT || 0);
    lastT = t;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      phase[i] += dt * speeds[i] * 0.14;
      if (phase[i] > 1) phase[i] -= 1; // 수명 루프 → 바닥에서 재생성
      const life = phase[i];
      const y = 1 + life * 7;               // 1 → 8 상승
      const sway = Math.sin(t * 0.6 + i) * swayAmp[i] * life;
      pos[i * 3] = baseX[i] + sway;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = baseZ[i];
    }
    geo.attributes.position.needsUpdate = true;
    // 위로 갈수록 옅어지는 느낌은 사이즈/머티리얼로 충분 — 전체 페이드는 density.
  }

  const handle = { points, setDensity, update };
  _steamRef = handle; // tickStation 이 참조
  return handle;
}

// 증기 입자용 부드러운 원형 스프라이트.
function makeSteamSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(235,226,212,0.45)');
  g.addColorStop(1, 'rgba(235,226,212,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
