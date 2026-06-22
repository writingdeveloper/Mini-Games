import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 모든 팩토리는 THREE.Group 을 반환(추후 glTF 교체 시 scene/logic 불변).

// ---- 3D 에셋(glTF) 로더 — 있으면 절차적 메시를 대체, 404/실패면 절차적 폴백 ----
// 3d-asset-studio 로 생성한 .glb 를 public/garak-guksu/models/ 에 두면 자동 사용.
const _loadedModels = {};   // key -> 정규화된 템플릿(clone 해서 사용)
const _modelWaiters = {};   // key -> [로드 후 콜백]

// 바운딩박스 중심을 원점에 두고 targetSize 로 스케일(+그림자).
// opts.byHeight: maxDim 대신 높이(y)를 targetSize 에 맞춤(서있는 캐릭터용).
// opts.ground: 스케일 후 발(min.y)을 y=0 에 정렬(바닥 위에 세움; 캐릭터/탈것용).
// opts.rotateY: Y축 회전(rad). 생성된 캐릭터 정면 방향을 게임 기준에 맞춤(손님=카메라 응시).
function normalizeModel(scene, targetSize, opts = {}) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const denom = (opts.byHeight ? size.y : Math.max(size.x, size.y, size.z)) || 1;
  scene.position.sub(center);
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const wrap = new THREE.Group();
  wrap.add(scene);
  wrap.scale.setScalar(targetSize / denom);
  if (opts.rotateY) wrap.rotation.y = opts.rotateY; // Y회전은 높이 불변 → ground 정렬 전 적용 OK
  if (opts.ground) {
    const b2 = new THREE.Box3().setFromObject(wrap);
    wrap.position.y -= b2.min.y; // 발/바닥을 y=0 으로
  }
  return wrap;
}

export function preloadModel(key, url, targetSize, opts = {}) {
  try {
    new GLTFLoader().load(
      url,
      (gltf) => {
        _loadedModels[key] = normalizeModel(gltf.scene, targetSize, opts);
        (_modelWaiters[key] || []).forEach((fn) => fn());
        _modelWaiters[key] = [];
      },
      undefined,
      () => { /* 로드 실패 → 절차적 폴백 유지 */ }
    );
  } catch { /* GLTFLoader 미가용 → 폴백 */ }
}

// procGroup(절차적 버전)을 가진 group 에 로드된 에셋을 끼우고 절차적은 숨김.
function attachModel(key, group, procGroup) {
  const apply = () => {
    const tpl = _loadedModels[key];
    if (!tpl) return;
    group.add(tpl.clone(true));
    procGroup.visible = false;
  };
  if (_loadedModels[key]) apply();
  else (_modelWaiters[key] = _modelWaiters[key] || []).push(apply);
}

// holder 그룹에 로드된 GLB 클론만 주입(가시성은 호출부 sync 가 결정). 없으면 비워둠(폴백).
function attachInto(key, holder) {
  const apply = () => { const tpl = _loadedModels[key]; if (tpl) holder.add(tpl.clone(true)); };
  if (_loadedModels[key]) apply();
  else (_modelWaiters[key] = _modelWaiters[key] || []).push(apply);
}

// 손님 아키타입 키(절차적 소품 / AI GLB 공통).
const CUSTOMER_ARCHES = ['soldier', 'worker', 'student', 'couple', 'granny'];

// 모듈 로드 시 에셋 프리로드(없으면 절차적 폴백).
preloadModel('bowl', '/garak-guksu/models/garak_bowl.glb', 0.42);
// 셰프(주인장): 서있는 캐릭터 → 키 기준 + 발을 바닥(y=0)에 정렬.
preloadModel('chef', '/garak-guksu/models/garak_chef.glb', 1.5, { ground: true, byHeight: true });
// 손님 5종: 서있는 캐릭터 + 카메라(셰프)를 마주보도록 180° 회전.
for (const key of CUSTOMER_ARCHES) {
  preloadModel(`cust_${key}`, `/garak-guksu/models/garak_cust_${key}.glb`, 1.7, { ground: true, byHeight: true, rotateY: Math.PI });
}
// 조리대 4종 장비: 카운터 위 → 발(min.y)을 바닥에 정렬.
for (const kind of ['setting', 'blancher', 'broth', 'garnish']) {
  preloadModel(`station_${kind}`, `/garak-guksu/models/garak_st_${kind}.glb`, 1.2, { ground: true });
}
// 주방 화덕(AI 복잡 객체) — 작업대 위 끓는 육수솥. 없으면 절차적 폴백.
preloadModel('kit_stove', '/garak-guksu/models/garak_kit_stove.glb', 1.1, { ground: true });

export function createFloor() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.9 })
  );
  floor.position.y = -0.2; floor.receiveShadow = true; g.add(floor);
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 })
  );
  counter.position.set(0, 0.5, 2.7);
  counter.castShadow = true; counter.receiveShadow = true; g.add(counter);
  return g;
}

// 주방 화덕(garak_kit_stove.glb, AI 복잡 객체) — 절차적 폴백(가스링+솥). scene.js 가 작업대에 배치.
export function createKitchenStove() {
  const g = new THREE.Group();
  const proc = new THREE.Group(); proc.name = 'procStove';
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.4 }));
  ring.position.y = 0.09; proc.add(ring);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.55, 18),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.4 }));
  pot.position.y = 0.45; pot.castShadow = true; proc.add(pot);
  g.add(proc);
  attachModel('kit_stove', g, proc);
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
  const proc = new THREE.Group(); proc.name = 'procChef'; // garak_chef.glb 로드되면 숨겨짐
  proc.add(body, head);
  const chefBody = new THREE.Group(); chefBody.name = 'chefBody'; // 1인칭에서 숨길 본체
  chefBody.add(proc);
  attachModel('chef', chefBody, proc); // garak_chef.glb 있으면 절차적 셰프를 대체(chefBody 안)
  g.add(chefBody);
  const bowl = createBowl();
  bowl.position.set(0, 1.18, 0.42); bowl.scale.setScalar(1.7);
  bowl.name = 'heldBowl'; bowl.visible = false;
  g.add(bowl);
  // 1인칭 손 — 그릇 양옆 둥근 손 + 흰 소매(평소 숨김, FP 에서만 표시).
  const hands = new THREE.Group(); hands.name = 'fpHands'; hands.visible = false;
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.75 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  for (const hx of [-0.4, 0.4]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
    hand.scale.set(1, 0.8, 1.25); hand.position.set(hx, 1.14, 0.48); hand.castShadow = true; hands.add(hand);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.34, 10), sleeve);
    cuff.position.set(hx * 1.18, 1.02, 0.28); cuff.rotation.x = 0.6; cuff.castShadow = true; hands.add(cuff);
  }
  g.add(hands);
  return g;
}

// 그릇 + 단계별 음식 레이어(scene.js 가 holding.stage 로 토글).
//   food_noodle  : 면(noodle 이상 항상)
//   food_broth   : 멸치육수(brothed/done)
//   food_garnish : 쑥갓·김·고춧가루(done)
export function createBowl() {
  const g = new THREE.Group();
  const proc = new THREE.Group(); proc.name = 'procBowl'; // garak_bowl.glb 로드되면 숨겨짐
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.15, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x8f9398, metalness: 0.55, roughness: 0.35 })
  );
  bowl.castShadow = true; proc.add(bowl);

  // 면 — 굵은 가락면 다발(납작한 흰 덩이).
  const noodle = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.8 })
  );
  noodle.scale.set(1, 0.45, 1); noodle.position.y = 0.08;
  noodle.name = 'food_noodle'; noodle.visible = false; proc.add(noodle);

  // 멸치육수 — 반투명 갈색 국물 표면.
  const broth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.16, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.4, transparent: true, opacity: 0.9 })
  );
  broth.position.y = 0.07; broth.name = 'food_broth'; broth.visible = false; proc.add(broth);

  // 고명 — 쑥갓(초록) + 김(검정) + 고춧가루(빨강).
  const garnish = new THREE.Group();
  const ssukgat = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 5),
    new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.7 }));
  ssukgat.position.set(-0.05, 0.13, 0.03); ssukgat.rotation.z = 0.4; garnish.add(ssukgat);
  const ssukgat2 = ssukgat.clone(); ssukgat2.position.set(0.04, 0.13, -0.04); ssukgat2.rotation.z = -0.3; garnish.add(ssukgat2);
  const gim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x14140f, roughness: 0.9 }));
  gim.position.set(0.04, 0.11, 0.05); gim.rotation.y = 0.5; garnish.add(gim);
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xd23b2a, roughness: 0.6 }));
    dot.position.set((i - 1.5) * 0.05, 0.12, 0.0 + (i % 2) * 0.05); garnish.add(dot);
  }
  garnish.name = 'food_garnish'; garnish.visible = false; proc.add(garnish);

  g.add(proc);
  // AI 완성 그릇(garak_bowl.glb)은 별도 홀더 — scene.js 가 'done' 단계에서만 표시.
  // (그 전 단계는 절차적 그릇 + 단계별 음식 레이어로 진행 상황을 보여줌.)
  const aiBowl = new THREE.Group(); aiBowl.name = 'aiBowl'; aiBowl.visible = false;
  g.add(aiBowl);
  attachInto('bowl', aiBowl); // 로드되면 클론 주입(절차적은 숨기지 않음 — 가시성은 scene sync)
  return g;
}

const STATION_COLORS = {
  setting:  0xb08d57,
  blancher: 0x9aa3ad,
  broth:    0x7a5a3a,
  garnish:  0xc23b3b,
};

// 조리대 + kind별 토핑(식별성·고증). logic 불변 — 색만 아니라 정체성을 보이게.
export function createStation(kind = 'blancher') {
  const g = new THREE.Group();
  const proc = new THREE.Group(); proc.name = 'procStation'; // garak_st_<kind>.glb 로드되면 숨겨짐
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: STATION_COLORS[kind] ?? 0x9aa3ad, metalness: 0.4, roughness: 0.5 })
  );
  pot.position.y = 0.55; pot.castShadow = true; pot.receiveShadow = true; proc.add(pot);

  if (kind === 'setting') {
    // 흰 생면 사리 더미(꼬인 토러스).
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.85 });
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 8, 16), mat);
      coil.position.set((i - 1) * 0.2, 0.98 + (i % 2) * 0.08, 0); coil.rotation.x = Math.PI / 2; proc.add(coil);
    }
  } else if (kind === 'blancher') {
    // 스테인리스 채반 림 + 안의 면 + 물.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.7, roughness: 0.3 }));
    rim.position.y = 0.92; rim.rotation.x = Math.PI / 2; proc.add(rim);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18),
      new THREE.MeshStandardMaterial({ color: 0xcfe0d6, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.7 }));
    water.position.y = 0.9; proc.add(water);
  } else if (kind === 'broth') {
    // 멸치육수 가마솥 — 검은 솥 림 + 갈색 국물.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0x161318, roughness: 0.8 }));
    rim.position.y = 0.92; rim.rotation.x = Math.PI / 2; proc.add(rim);
    const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 20),
      new THREE.MeshStandardMaterial({ color: 0x6a4422, roughness: 0.35 }));
    soup.position.y = 0.91; proc.add(soup);
  } else if (kind === 'garnish') {
    // 고춧가루 통(빨강 유지) + 쑥갓 묶음(초록) + 김 더미(검정).
    const chili = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xd23b2a, roughness: 0.6 }));
    chili.position.set(-0.22, 1.05, 0); proc.add(chili);
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.8 });
    for (let i = 0; i < 3; i++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), greenMat);
      stalk.position.set(0.18 + (i - 1) * 0.05, 1.05, 0.05); stalk.rotation.z = (i - 1) * 0.2; proc.add(stalk);
    }
    const gim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x14140f, roughness: 0.9 }));
    gim.position.set(0.2, 0.96, -0.18); proc.add(gim);
  }
  g.add(proc);
  attachModel('station_' + kind, g, proc); // garak_st_<kind>.glb 있으면 절차적 조리대를 대체
  return g;
}

export function createGauge() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0x222831 }));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xffcf6a }));
  fill.name = 'fill'; fill.position.z = 0.01;
  g.add(bg, fill); g.visible = false;
  return g;
}

// 손님 + 5아키타입 시그니처 소품(scene.js 가 archetype 으로 토글).
// 카메라는 손님 뒤(+z)에서 보므로 머리/등/위쪽 소품이 잘 보인다.
export function createCustomer(color = 0x4a6a8a) {
  const g = new THREE.Group();
  const proc = new THREE.Group(); proc.name = 'procCust'; // garak_cust_*.glb 로드되면 sync 가 숨김
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.7, 6, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  body.position.y = 0.75; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.7 })
  );
  head.position.y = 1.45; head.castShadow = true;
  proc.add(body, head);

  // soldier — 카키 군모(납작 + 챙).
  {
    const p = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5e3a, roughness: 0.8 }));
    cap.position.y = 1.66;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x4a4e30, roughness: 0.8 }));
    brim.position.set(0, 1.6, -0.18);
    p.add(cap, brim); p.name = 'prop_soldier'; p.visible = false; proc.add(p);
  }
  // worker — 진회색 중절모.
  {
    const p = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.22, 14),
      new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.7 }));
    crown.position.y = 1.7;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0x24242b, roughness: 0.7 }));
    brim.position.y = 1.6;
    p.add(crown, brim); p.name = 'prop_worker'; p.visible = false; proc.add(p);
  }
  // student — 네모 책가방(등).
  {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x394a7a, roughness: 0.7 }));
    bag.position.set(0, 0.95, 0.34); bag.name = 'prop_student'; bag.visible = false; proc.add(bag);
  }
  // granny — 회백 머릿수건.
  {
    const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.9 }));
    scarf.position.y = 1.5; scarf.name = 'prop_granny'; scarf.visible = false; proc.add(scarf);
  }
  // couple — 머리 위 분홍 하트.
  {
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5a8a }));
    heart.scale.set(1, 0.9, 0.6); heart.position.y = 1.95; heart.name = 'prop_couple'; heart.visible = false; proc.add(heart);
  }
  g.add(proc);

  // 아키타입별 AI 캐릭터 홀더 — GLB 있으면 채워지고, 없으면 비어 폴백. 가시성은 scene sync 가 결정.
  for (const key of CUSTOMER_ARCHES) {
    const holder = new THREE.Group(); holder.name = 'ai_' + key; holder.visible = false;
    g.add(holder); attachInto('cust_' + key, holder);
  }
  return g;
}
