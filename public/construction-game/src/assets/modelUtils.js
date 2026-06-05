import * as THREE from 'three';

// Remove a group's placeholder children (keep sprites), disposing their NON-shared
// GPU resources, then scale + seat the glTF model into the group (feet at y=0).
export function swapInModel(group, obj, target = 2.8) {
  for (const c of [...group.children]) {
    if (c.isSprite) continue;
    group.remove(c);
    c.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) { if (m.userData.shared) continue; if (m.map) m.map.dispose(); m.dispose(); }
    });
  }
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const s = size.y > 0 ? target / size.y : 1;
  obj.scale.setScalar(s);
  obj.position.y = -box.min.y * s; // min scales with the uniform factor
  group.add(obj);
}
