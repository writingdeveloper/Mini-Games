export function applyRetro(material, { snap = 160, affine = false } = {}) {
  if (!material || material.userData.__retro) return material;
  material.userData.__retro = true;
  material.flatShading = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: snap };

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
