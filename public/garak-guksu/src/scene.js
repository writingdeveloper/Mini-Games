import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer, createGauge } from './models.js';
import { STATIONS, CUSTOMER_SLOT, blancherProgress } from './logic.js';

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
  const gauge = createGauge();
  gauge.position.set(STATIONS.blancher.x, 1.6, STATIONS.blancher.z);
  gauge.rotation.x = -0.35;
  scene.add(gauge);

  const customer = createCustomer();
  customer.position.set(CUSTOMER_SLOT.x, 0, CUSTOMER_SLOT.z);
  scene.add(customer);
  const chef = createChef();
  scene.add(chef);
  const heldBowl = chef.getObjectByName('heldBowl');
  const gaugeFill = gauge.getObjectByName('fill');

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function sync(state) {
    chef.position.set(state.player.x, 0, state.player.z);
    heldBowl.visible = state.player.holding !== null;
    customer.visible = state.customer.present;
    const p = blancherProgress(state);
    gauge.visible = state.blancher.bowl !== null;
    if (gauge.visible) {
      gaugeFill.scale.x = Math.min(1, p);
      gaugeFill.position.x = -(1 - Math.min(1, p)) * 0.5;
      const inBand = p >= 0.7 && p <= 0.9;
      gaugeFill.material.color.setHex(p > 0.9 ? 0xff5a5a : inBand ? 0x6dff8f : 0xffcf6a);
    }
  }
  function render() { renderer.render(scene, camera); }
  function dispose() { renderer.dispose(); }

  return { sync, render, dispose };
}
