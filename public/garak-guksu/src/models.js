import * as THREE from 'three';

// 모든 팩토리는 THREE.Group 을 반환(추후 glTF 교체 시 scene/logic 불변).

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
  bowl.position.set(0, 1.1, 0.45); bowl.scale.setScalar(1.7);
  bowl.name = 'heldBowl'; bowl.visible = false;
  g.add(bowl);
  return g;
}

// 그릇 + 단계별 음식 레이어(scene.js 가 holding.stage 로 토글).
//   food_noodle  : 면(noodle 이상 항상)
//   food_broth   : 멸치육수(brothed/done)
//   food_garnish : 쑥갓·김·고춧가루(done)
export function createBowl() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.15, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x8f9398, metalness: 0.55, roughness: 0.35 })
  );
  bowl.castShadow = true; g.add(bowl);

  // 면 — 굵은 가락면 다발(납작한 흰 덩이).
  const noodle = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.8 })
  );
  noodle.scale.set(1, 0.45, 1); noodle.position.y = 0.08;
  noodle.name = 'food_noodle'; noodle.visible = false; g.add(noodle);

  // 멸치육수 — 반투명 갈색 국물 표면.
  const broth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.16, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.4, transparent: true, opacity: 0.9 })
  );
  broth.position.y = 0.07; broth.name = 'food_broth'; broth.visible = false; g.add(broth);

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
  garnish.name = 'food_garnish'; garnish.visible = false; g.add(garnish);
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
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: STATION_COLORS[kind] ?? 0x9aa3ad, metalness: 0.4, roughness: 0.5 })
  );
  pot.position.y = 0.55; pot.castShadow = true; pot.receiveShadow = true; g.add(pot);

  if (kind === 'setting') {
    // 흰 생면 사리 더미(꼬인 토러스).
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.85 });
    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 8, 16), mat);
      coil.position.set((i - 1) * 0.2, 0.98 + (i % 2) * 0.08, 0); coil.rotation.x = Math.PI / 2; g.add(coil);
    }
  } else if (kind === 'blancher') {
    // 스테인리스 채반 림 + 안의 면 + 물.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.7, roughness: 0.3 }));
    rim.position.y = 0.92; rim.rotation.x = Math.PI / 2; g.add(rim);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18),
      new THREE.MeshStandardMaterial({ color: 0xcfe0d6, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.7 }));
    water.position.y = 0.9; g.add(water);
  } else if (kind === 'broth') {
    // 멸치육수 가마솥 — 검은 솥 림 + 갈색 국물.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0x161318, roughness: 0.8 }));
    rim.position.y = 0.92; rim.rotation.x = Math.PI / 2; g.add(rim);
    const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 20),
      new THREE.MeshStandardMaterial({ color: 0x6a4422, roughness: 0.35 }));
    soup.position.y = 0.91; g.add(soup);
  } else if (kind === 'garnish') {
    // 고춧가루 통(빨강 유지) + 쑥갓 묶음(초록) + 김 더미(검정).
    const chili = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xd23b2a, roughness: 0.6 }));
    chili.position.set(-0.22, 1.05, 0); g.add(chili);
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.8 });
    for (let i = 0; i < 3; i++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), greenMat);
      stalk.position.set(0.18 + (i - 1) * 0.05, 1.05, 0.05); stalk.rotation.z = (i - 1) * 0.2; g.add(stalk);
    }
    const gim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x14140f, roughness: 0.9 }));
    gim.position.set(0.2, 0.96, -0.18); g.add(gim);
  }
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
  g.add(body, head);

  // soldier — 카키 군모(납작 + 챙).
  {
    const p = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5e3a, roughness: 0.8 }));
    cap.position.y = 1.66;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x4a4e30, roughness: 0.8 }));
    brim.position.set(0, 1.6, -0.18);
    p.add(cap, brim); p.name = 'prop_soldier'; p.visible = false; g.add(p);
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
    p.add(crown, brim); p.name = 'prop_worker'; p.visible = false; g.add(p);
  }
  // student — 네모 책가방(등).
  {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x394a7a, roughness: 0.7 }));
    bag.position.set(0, 0.95, 0.34); bag.name = 'prop_student'; bag.visible = false; g.add(bag);
  }
  // granny — 회백 머릿수건.
  {
    const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.9 }));
    scarf.position.y = 1.5; scarf.name = 'prop_granny'; scarf.visible = false; g.add(scarf);
  }
  // couple — 머리 위 분홍 하트.
  {
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5a8a }));
    heart.scale.set(1, 0.9, 0.6); heart.position.y = 1.95; heart.name = 'prop_couple'; heart.visible = false; g.add(heart);
  }
  return g;
}
