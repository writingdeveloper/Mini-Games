import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer } from './models.js';
import { COOK_STATION, CUSTOMER_SLOT } from './logic.js';

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
  const station = createStation();
  station.position.set(COOK_STATION.x, 0, COOK_STATION.z);
  scene.add(station);
  const customer = createCustomer();
  customer.position.set(CUSTOMER_SLOT.x, 0, CUSTOMER_SLOT.z);
  scene.add(customer);
  const chef = createChef();
  scene.add(chef);
  const heldBowl = chef.getObjectByName('heldBowl');

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function sync(state) {
    chef.position.set(state.player.x, 0, state.player.z);
    heldBowl.visible = state.player.holding === 'bowl';
    customer.visible = state.customer.present;
  }
  function render() { renderer.render(scene, camera); }
  function dispose() { renderer.dispose(); }

  return { sync, render, dispose };
}
