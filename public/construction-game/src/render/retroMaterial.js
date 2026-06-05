import { SETTINGS } from '../logic/settings.js';

// uSnap quantizes NDC xy to a grid of `uSnap` divisions: higher = finer grid = less visible
// vertex wobble. A very large value effectively disables the snap (and thus the jitter motion)
// while keeping the dither/posterize/low-res retro LOOK (those live in the post-process pipeline).
export const NO_JITTER_SNAP = 1e6;

export function applyRetro(material, { snap = 160, affine = false } = {}) {
  if (!material || material.userData.__retro) return material;
  material.userData.__retro = true;
  material.flatShading = true;

  // Reduced-motion gate at creation: pick the no-jitter snap so vertices don't wobble.
  // Keep the original requested snap so a live toggle (main.js) can restore the wobble.
  material.userData.__snapBase = snap;
  const effSnap = SETTINGS.reducedMotion ? NO_JITTER_SNAP : snap;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: effSnap };
    material.userData.__snapUniform = shader.uniforms.uSnap; // handle for live reduced-motion toggling

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uSnap;
         ${affine ? 'varying vec2 vAffineUv; varying float vAffineW;' : ''}`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         {
           vec4 snapped = gl_Position;
           snapped.xyz /= snapped.w;
           snapped.xy = floor(snapped.xy * uSnap) / uSnap;
           snapped.xyz *= snapped.w;
           gl_Position = snapped;
           ${affine ? 'vAffineW = gl_Position.w; vAffineUv = uv * gl_Position.w;' : ''}
         }`
      );

    if (affine) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vAffineUv; varying float vAffineW;`)
        .replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vAffineUv / vAffineW );
            diffuseColor *= sampledDiffuseColor;
          #endif`);
    }
  };
  material.needsUpdate = true;
  return material;
}

export function applyRetroToObject(root, opts) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => applyRetro(m, opts));
  });
}

// Best-effort live reduced-motion toggle: rewrite the snap uniform on already-compiled retro
// materials in a scene (no recompile). Falls back gracefully if a material hasn't compiled yet —
// its jitter takes effect at the next material rebuild (startGame -> buildWorld).
export function setReducedMotionForScene(root, reduced) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.userData.__retro) continue;
      const base = m.userData.__snapBase ?? 160;
      const u = m.userData.__snapUniform;
      if (u) u.value = reduced ? NO_JITTER_SNAP : base;
    }
  });
}
