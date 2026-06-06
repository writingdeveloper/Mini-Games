import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { spawnProps, spawnSkyline } from '../logic/spawn.js';
import { AssetLoader } from '../assets/AssetLoader.js';

const PROP_GEO = {
  barrel: () => new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8),
  crate: () => new THREE.BoxGeometry(1, 1, 1),
  cone: () => new THREE.ConeGeometry(0.45, 1, 8),
  pipe: () => new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6),
  scaffold: () => new THREE.BoxGeometry(0.3, 3, 0.3),
};
const PROP_COLOR = { barrel: 0x9a6b3a, crate: 0xb59148, cone: 0xff7a2a, pipe: 0x8893a0, scaffold: 0xb0b6bd };

// Real CC0 prop placements: { url, targetHeight (world units), x, z, ry (radians) }
// Avoid building row (z≈-6, x∈[-18,18]) and foreman start (z≈8).
// site is 44x44; edges at x=±22, z=±22. Barricades sit at ±22.
// We place props just inside the edges (x ≈ ±19, z ≈ ±17..0).
const REAL_PROP_TABLE = [
  // Back-left corner: crane tower
  { url: './assets/props/crane.glb',       targetHeight: 9,   x: -18, z: -18, ry: Math.PI * 0.25 },
  // Left edge mid: metal-fence row (3 copies along z)
  { url: './assets/props/metal-fence.glb', targetHeight: 1.5, x: -19, z:  -4, ry: 0 },
  { url: './assets/props/metal-fence.glb', targetHeight: 1.5, x: -19, z:   0, ry: 0, _clone: true },
  { url: './assets/props/metal-fence.glb', targetHeight: 1.5, x: -19, z:   4, ry: 0, _clone: true },
  // Right edge: fence panel + cinder block stack
  { url: './assets/props/fence.glb',       targetHeight: 1.5, x:  19, z:  -4, ry: Math.PI },
  { url: './assets/props/cinder-block.glb',targetHeight: 1.0, x:  19, z:  -8, ry: 0 },
  // Front-left: traffic cones (2)
  { url: './assets/props/traffic-cone.glb',targetHeight: 1.2, x: -10, z:  16, ry: 0 },
  { url: './assets/props/traffic-cone.glb',targetHeight: 1.2, x:  -7, z:  16, ry: 0.4, _clone: true },
  // Front-right: construction barrier
  { url: './assets/props/barrier.glb',     targetHeight: 1.4, x:  10, z:  16, ry: 0 },
];

export class Site {
  constructor() {
    this.object3d = new THREE.Group();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.site.width, CONFIG.site.depth),
      new THREE.MeshLambertMaterial({ color: 0x8a8170 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.object3d.add(ground);

    const barMat = new THREE.MeshLambertMaterial({ color: 0xd8a93a });
    const w = CONFIG.site.width, d = CONFIG.site.depth;
    const edges = [
      [0, -d / 2, w, 0.4], [0, d / 2, w, 0.4],
      [-w / 2, 0, 0.4, d], [w / 2, 0, 0.4, d],
    ];
    for (const [x, z, sx, sz] of edges) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, 1, sz), barMat);
      bar.position.set(x, 0.5, z);
      this.object3d.add(bar);
    }

    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.1, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2ec16b })
    );
    gate.position.set(CONFIG.exit.x, 0.06, CONFIG.exit.z);
    this.object3d.add(gate);

    const props = spawnProps(CONFIG.seed, 16);
    const byKind = {};
    for (const p of props) (byKind[p.kind] ||= []).push(p);
    const m4 = new THREE.Matrix4();
    for (const kind of Object.keys(byKind)) {
      const list = byKind[kind];
      const mesh = new THREE.InstancedMesh(
        PROP_GEO[kind](),
        new THREE.MeshLambertMaterial({ color: PROP_COLOR[kind], flatShading: true }),
        list.length
      );
      list.forEach((p, i) => {
        m4.makeTranslation(p.x, 0.6, p.z);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.object3d.add(mesh);
    }

    // Async: load real CC0 prop models and place them at the site edges/corners.
    // Each prop loads independently; a failure just means that prop is absent.
    this._loadRealProps();

    // Static exterior set-dressing (S5): fills the void outside the fence so the lot doesn't float in
    // space. Built once into the persistent Site group (survives restarts; auto-retro'd by the
    // scene-wide applyRetroToObject pass in startGame — except the skydome, which opts out).
    this._buildExterior();
  }

  _buildExterior() {
    const g = this.object3d;

    // --- gradient skydome (opts out of the retro vertex-snap; fog-matched horizon) ---
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x8fa6bb) }, horizon: { value: new THREE.Color(0xb9bda8) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = smoothstep(0.0,0.55, normalize(vP).y); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
    });
    skyMat.userData.__retro = true; // applyRetro short-circuits on this flag (no snap on a custom shader)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), skyMat);
    g.add(sky);

    // --- surrounding ground: y-staggered flat layers, all DARKER/less-saturated than the tan lot so
    // the active site stays the brightest focal plane. As they recede they're eaten by fog. ---
    const layer = (w, d, color, y, x = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m);
    };
    layer(180, 180, 0x83857b, -0.02);             // paved district apron (a touch darker than the tan lot)
    layer(180, 12, 0x44474a, -0.015, 0, 42);      // front road meeting the gate side (+z)
    layer(12, 180, 0x44474a, -0.015, -48, 0);     // a cross road on the -x flank (intersection for free)

    // --- distant city: 2 InstancedMesh draws (bodies + lit windows), deterministic via spawnSkyline ---
    const skyline = spawnSkyline(CONFIG.seed, 64);
    const UP = new THREE.Vector3(0, 1, 0);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
    const palette = [0x8b93a0, 0x7e88a0, 0x9aa0a6, 0x8a8478]; // hazy blue-greys that melt into the fog

    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), skyline.length);
    const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), skyline.length);
    skyline.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.ry);
      pos.set(b.x, b.h / 2, b.z); scl.set(b.w, b.h, b.d); m4.compose(pos, q, scl);
      bodies.setMatrixAt(i, m4); bodies.setColorAt(i, col.setHex(palette[i % palette.length]));
      // one lit window panel per building, facing inward (toward the lot/camera)
      const rad = Math.hypot(b.x, b.z) || 1;
      const inset = (b.d / 2 + 0.3) / rad;
      q.setFromAxisAngle(UP, Math.atan2(-b.x, -b.z));
      pos.set(b.x * (1 - inset), b.h * 0.55, b.z * (1 - inset)); scl.set(b.w * 0.7, b.h * 0.7, 1); m4.compose(pos, q, scl);
      windows.setMatrixAt(i, m4);
      const lit = ((i * 2654435761) >>> 0) % 100 < 55; // ~55% lit, deterministic (no extra RNG)
      windows.setColorAt(i, col.setHex(lit ? 0xffd98a : 0x20242e));
    });
    bodies.instanceMatrix.needsUpdate = true; if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    windows.instanceMatrix.needsUpdate = true; if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
    g.add(bodies); g.add(windows);
  }

  _loadRealProps() {
    const loader = new AssetLoader();
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    // Cache entries by URL so _clone copies share the loaded scene.
    const entryCache = new Map();

    for (const spec of REAL_PROP_TABLE) {
      const specCopy = { ...spec };
      // Load (or retrieve cached promise) for this URL.
      if (!entryCache.has(specCopy.url)) {
        entryCache.set(specCopy.url, loader.load(specCopy.url));
      }
      entryCache.get(specCopy.url).then((entry) => {
        if (!entry) return; // load failed — skip silently
        try {
          const obj = specCopy._clone ? entry.scene.clone() : entry.scene;
          // Normalise scale so bounding-box height == targetHeight.
          box.setFromObject(obj);
          box.getSize(size);
          if (size.y > 0) {
            const scale = specCopy.targetHeight / size.y;
            obj.scale.setScalar(scale);
            // Recompute box after scale to ground the model.
            box.setFromObject(obj);
          }
          obj.position.set(specCopy.x, -box.min.y, specCopy.z);
          obj.rotation.y = specCopy.ry;
          this.object3d.add(obj);
        } catch (err) {
          console.warn('[Site] prop placement error', specCopy.url, err);
        }
      }).catch((err) => {
        console.warn('[Site] prop load rejected', specCopy.url, err);
      });
    }
  }
}
