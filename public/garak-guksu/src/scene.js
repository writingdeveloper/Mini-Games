import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer, createGauge } from './models.js';
import { STATIONS, CUSTOMER_SLOTS, ARCHETYPES, slotProgress, patienceProgress, BLANCH_SLOTS } from './logic.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const LOW = typeof matchMedia === 'function' &&
    (matchMedia('(max-width: 560px)').matches || matchMedia('(pointer: coarse)').matches);
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

  scene.add(new THREE.HemisphereLight(0x404a6a, 0x101018, 0.5));
  const lamp = new THREE.PointLight(0xffcf6a, 1.4, 24, 1.5);
  lamp.position.set(0, 6, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(LOW ? 512 : 1024, LOW ? 512 : 1024);
  scene.add(lamp);

  scene.add(createFloor());
  for (const [kind, pos] of Object.entries(STATIONS)) {
    const s = createStation(kind);
    s.position.set(pos.x, 0, pos.z);
    scene.add(s);
  }

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

  function sync(state) {
    chef.position.set(state.player.x, 0, state.player.z);
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
