import * as THREE from 'three';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf0a45a, 1); // sandy clear color — proves Three.js works
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 5, 10);
renderer.render(scene, camera);
console.log('[desert-game] boot ok');
