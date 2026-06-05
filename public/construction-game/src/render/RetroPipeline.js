import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform float uColorLevels;

  // 4x4 Bayer ordered-dither matrix, looked up without dynamic indexing
  float bayerValue(int idx) {
    if (idx == 0)  return 0.0;
    if (idx == 1)  return 8.0;
    if (idx == 2)  return 2.0;
    if (idx == 3)  return 10.0;
    if (idx == 4)  return 12.0;
    if (idx == 5)  return 4.0;
    if (idx == 6)  return 14.0;
    if (idx == 7)  return 6.0;
    if (idx == 8)  return 3.0;
    if (idx == 9)  return 11.0;
    if (idx == 10) return 1.0;
    if (idx == 11) return 9.0;
    if (idx == 12) return 15.0;
    if (idx == 13) return 7.0;
    if (idx == 14) return 13.0;
    return 5.0; // idx == 15
  }

  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    int xi = int(mod(gl_FragCoord.x, 4.0));
    int yi = int(mod(gl_FragCoord.y, 4.0));
    float threshold = bayerValue(yi * 4 + xi) / 16.0 - 0.5;
    c += threshold / uColorLevels;                     // dither before quantizing
    c = floor(c * uColorLevels + 0.5) / uColorLevels;  // posterize
    gl_FragColor = vec4(c, 1.0);
  }
`;

export class RetroPipeline {
  constructor(width = 320, height = 240, colorLevels = 16) {
    this.rt = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { tDiffuse: { value: this.rt.texture }, uColorLevels: { value: colorLevels } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quadScene.add(quad);
  }

  setSize(_w, _h) { /* low-res RT stays fixed; the upscale quad fills the canvas */ }

  render(renderer, scene, camera) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() { this.rt.dispose(); this.material.dispose(); }
}
