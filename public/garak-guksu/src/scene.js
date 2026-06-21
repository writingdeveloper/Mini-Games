import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer, createGauge } from './models.js';
import { STATIONS, CUSTOMER_SLOTS, slotProgress, patienceProgress, BLANCH_SLOTS, WAVES } from './logic.js';
import { buildStation, tickStation } from './station.js';

// 가독성 상향(현 어두움 지적): hemi/lamp/fill 를 소폭 올려 막차에서도 조리대~카운터가 읽히게.
// 과노출 금지 — 무드는 유지하되 플레이영역만 들어올린다.
const ERA_MOOD = {
  '증기': { bg: 0x161b2a, amb: 1.05, lamp: 2.9, fill: 0.45, fogN: 16, fogF: 34 },
  '디젤': { bg: 0x1a1f2c, amb: 1.12, lamp: 3.1, fill: 0.45, fogN: 18, fogF: 38 },
  '막차': { bg: 0x0a0c14, amb: 0.95, lamp: 2.9, fill: 0.55, fogN: 12, fogF: 27 },
};
let curEra = null;
let lastDwellSec = -1;

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
  for (const [kind, pos] of Object.entries(STATIONS)) {
    const s = createStation(kind);
    s.position.set(pos.x, 0, pos.z);
    scene.add(s);
  }

  // 플랫폼 무대 장식(배경판/기둥/등/역사인/증기). scene/logic 불변, 별도 모듈.
  const station = buildStation(scene, { reducedMotion: RM });

  const chef = createChef();
  scene.add(chef);
  const heldBowl = chef.getObjectByName('heldBowl');

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
    return { mesh: c, body: c.children[0], gauge: pg, fill: pg.getObjectByName('fill') };
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
      hemi.intensity = m.amb;
      lamp.intensity = m.lamp;
      fillLight.intensity = m.fill;
      // 무대(배경 틴트/등/증기)도 같은 에라로 동기화. setEra 가 스팀 농도까지 처리.
      station.setEra(era);
    }
    // 발차 안내판 텍스트 = HUD 와 동일한 mm:ss. 초가 바뀔 때만 캔버스 재그림(매프레임 낭비 방지).
    const sec = Math.max(0, Math.ceil(state.dwellLeft));
    if (sec !== lastDwellSec) {
      lastDwellSec = sec;
      station.setDwell(`발차 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    }
    tickStation(t);
    // chef: gentle idle bob, stronger when moving
    const moving = Math.hypot(state.player.x - chef.position.x, state.player.z - chef.position.z) > 0.001;
    const bobY = RM ? 0 : moving ? Math.abs(Math.sin((t || 0) * 10)) * 0.08 : Math.sin((t || 0) * 2) * 0.03;
    chef.position.set(state.player.x, bobY, state.player.z);
    chef.rotation.z = RM ? 0 : moving ? Math.sin((t || 0) * 10) * 0.06 : 0;
    heldBowl.visible = state.player.holding !== null;

    // customers by slot
    const bySlot = new Map(state.customers.map((c) => [c.slot, c]));
    slotCustomers.forEach((sc, i) => {
      const c = bySlot.get(i);
      sc.mesh.visible = !!c;
      sc.gauge.visible = !!c;
      if (c) {
        sc.body.material.color.setHex(ARCH_COLOR[c.archetype] ?? 0x4a6a8a);
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
  function dispose() { renderer.dispose(); }

  return { sync, render, dispose };
}
