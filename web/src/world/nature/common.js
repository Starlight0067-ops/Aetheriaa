// Shared nature utilities: seeded RNG, value noise, shader patching (chained onBeforeCompile), wind uniforms.
import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2i(x, z, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2i(xi, zi, seed), b = hash2i(xi + 1, zi, seed), c = hash2i(xi, zi + 1, seed), d = hash2i(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, oct = 4, seed = 0) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * Chain a shader patch onto a material built by the toon factory, preserving any onBeforeCompile the
 * render owner installed. patch = { key, uniforms, defines, vertexPars, fragmentPars, vertex:[[find, code, mode]], fragment:[...] }
 * mode: 'replace' | 'after' (default) | 'before'.
 */
export function patchMaterial(mat, patch) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  const hasPrev = prev && prev !== THREE.Material.prototype.onBeforeCompile;
  mat.userData.naturePatch = patch.key;
  mat.onBeforeCompile = function (shader, renderer) {
    if (hasPrev) prev.call(this, shader, renderer);
    Object.assign(shader.uniforms, patch.uniforms || {});
    if (patch.defines) shader.defines = Object.assign(shader.defines || {}, patch.defines);
    const apply = (src, pars, edits, stage) => {
      if (pars) {
        if (src.includes('#include <common>')) src = src.replace('#include <common>', '#include <common>\n' + pars);
        else src = pars + '\n' + src;
      }
      for (const [find, code, mode = 'after'] of edits || []) {
        if (!src.includes(find)) { console.warn(`[nature] ${patch.key}: ${stage} chunk not found: ${find}`); continue; }
        src = src.replace(find, mode === 'replace' ? code : mode === 'before' ? code + '\n' + find : find + '\n' + code);
      }
      return src;
    };
    shader.vertexShader = apply(shader.vertexShader, patch.vertexPars, patch.vertex, 'vertex');
    shader.fragmentShader = apply(shader.fragmentShader, patch.fragmentPars, patch.fragment, 'fragment');
  };
  mat.customProgramCacheKey = function () {
    return (prevKey ? prevKey.call(this) : '') + '|nature:' + patch.key;
  };
  mat.needsUpdate = true;
  return mat;
}

/** Shared wind/time uniforms, referenced by every nature shader. */
export const WIND = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector4(0.86, -0.5, 1.0, 0) }, // dir.xz, strength, gust phase
  uNoiseTex: { value: null },
};

export function updateWind(time) {
  WIND.uTime.value = time;
  WIND.uWind.value.z = 0.85 + 0.25 * Math.sin(time * 0.13) + 0.1 * Math.sin(time * 0.41);
}

/** GLSL shared by tree/bush/grass vertex shaders. */
export const WIND_GLSL = /* glsl */`
uniform float uTime;
uniform vec4 uWind;
uniform sampler2D uNoiseTex;
float natGust(vec2 wp) {
  vec2 uv = wp * 0.0085 - uWind.xy * uTime * 0.035;
  return textureLod(uNoiseTex, uv, 0.0).g;
}
`;

export function smoothPolyline(pts, steps = 6) {
  // Catmull-Rom through the points (endpoints duplicated)
  const out = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Aerial perspective for nature materials: rgb = haze colour (linear), w = full-haze distance. */
export const HAZE = { uHaze: { value: new THREE.Vector4(0.42, 0.62, 0.86, 950) } };
export const HAZE_PARS = 'uniform vec4 uHaze;';
export const HAZE_FRAG = /* glsl */`
{
  float natHd = length(vViewPosition);
  float natHz = pow(smoothstep(uHaze.w * 0.27, uHaze.w, natHd), 0.85) * 0.78;
  outgoingLight = mix(outgoingLight, uHaze.rgb, natHz);
}
`;
export function setHazeFromQuality(q) { HAZE.uHaze.value.w = Math.max(600, Math.min(1100, (q.drawDistance || 950) * 0.95)); }
