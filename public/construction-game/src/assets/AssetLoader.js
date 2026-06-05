import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { applyRetroToObject } from '../render/retroMaterial.js';

export class AssetLoader {
  constructor(onWarn) {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.onWarn = onWarn || (() => {});
  }

  async load(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    try {
      const gltf = await this.loader.loadAsync(url);
      gltf.scene.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; }
          }
        }
      });
      // affine:false on purpose — see file header note.
      applyRetroToObject(gltf.scene, { snap: 160, affine: false });
      const entry = { scene: gltf.scene, animations: gltf.animations || [] };
      this.cache.set(url, entry);
      return entry;
    } catch (err) {
      console.warn('[construction-game] asset load failed, using primitive', url, err);
      this.onWarn(`에셋 로드 실패: ${url.split('/').pop()} (기본 모델 사용)`);
      return null;
    }
  }

  instance(entry) {
    if (!entry) return null;
    const obj = skeletonClone(entry.scene);
    const mixer = entry.animations.length ? new THREE.AnimationMixer(obj) : null;
    return { obj, mixer, animations: entry.animations };
  }
}
