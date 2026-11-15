// AETHERIA — image-based lighting from a real HDRI (owner: render). High / ultra only (quality.hdri).
// Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)" (CC0), 1k equirect .hdr → conditioned on the CPU →
// PMREM → toon.setEnvironment(): every toon material then takes its diffuse irradiance and its specular lobe
// from the prefiltered map instead of the analytic sky gradient.
//
// Conditioning (keeps the map coherent with the authored key light and the tuned exposure):
//   · the panorama is rolled so its sun sits at the azimuth of lighting.sunDirection;
//   · the sun disc is clamped (the directional light already provides it → no double sun, no PMREM fireflies);
//   · everything below the horizon is replaced by the hemisphere light's ground bounce colour;
//   · intensity is calibrated so an up-facing surface receives the same irradiance as the hemisphere light gave,
//     i.e. the HDRI changes the *shape and colour* of the ambient (cloud-side vs sun-side, horizon warmth),
//     not the overall exposure.
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { asset } from '../core/paths.js';
import { setEnvironment } from './toon.js';

export const HDRI_FILE = 'assets/cc0/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr';

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export async function loadEnvironment(ctx) {
  const { THREE, renderer } = ctx;
  const lighting = ctx.systems.lighting;
  const src = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(asset(HDRI_FILE));
  const W = src.image.width, H = src.image.height, d = src.image.data;
  const ch = Math.round(d.length / (W * H));
  const horizon = H >> 1;

  // sun azimuth (brightest column of the upper half) and cosine-weighted mean radiance of the sky
  let best = -1, sunCol = 0, sum = 0, wsum = 0;
  for (let y = 0; y < horizon; y++) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    const w = Math.cos(el);                               // solid angle of an equirect texel
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const l = lum(d[i], d[i + 1], d[i + 2]);
      if (l > best) { best = l; sunCol = x; }
      sum += Math.min(l, 50) * w; wsum += w;
    }
  }
  const mean = sum / wsum;
  const cap = mean * 6;

  // irradiance on an up-facing surface with the sun clamped: E = ∫ L cosθ dω
  let E = 0;
  const dOmega = (2 * Math.PI / W) * (Math.PI / H);
  for (let y = 0; y < horizon; y++) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    const w = Math.cos(el) * Math.sin(el) * dOmega;
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * ch;
      E += Math.min(lum(d[i], d[i + 1], d[i + 2]), cap) * w * 2;
    }
  }
  const hemi = lighting?.hemi;
  const skyC = hemi ? hemi.color : new THREE.Color(0xc4dcff);
  const gndC = hemi ? hemi.groundColor : new THREE.Color(0xa39a74);
  const hI = hemi ? hemi.intensity : 1.4;
  const k = (lum(skyC.r, skyC.g, skyC.b) * hI) / Math.max(E, 1e-4);   // HDRI units → scene units
  const gnd = [gndC.r * hI / Math.PI / k, gndC.g * hI / Math.PI / k, gndC.b * hI / Math.PI / k];

  // roll so the panorama's sun azimuth matches the scene's (three: u = atan2(z, x) / 2π + 0.5)
  const sd = lighting?.sunDirection || new THREE.Vector3(0.52, 0.6, 0.6).normalize();
  const wantCol = Math.round((Math.atan2(sd.z, sd.x) / (2 * Math.PI) + 0.5) * W);
  const shift = ((sunCol - wantCol) % W + W) % W;

  const out = new Uint16Array(W * H * 4);
  const half = THREE.DataUtils.toHalfFloat;
  const one = half(1);
  for (let y = 0; y < H; y++) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    const g = el < 0 ? Math.min(1, -el / 0.14) : 0;       // 0 at the horizon → 1 from 8° below
    const gs = g * g * (3 - 2 * g);
    const sy = Math.min(y, horizon - 1);                  // below the horizon: stretch the horizon row
    for (let x = 0; x < W; x++) {
      const i = (sy * W + (x + shift) % W) * ch, o = (y * W + x) * 4;
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      const l = lum(r, gg, b);
      if (l > cap) { const s = cap / l; r *= s; gg *= s; b *= s; }
      out[o] = half(r + (gnd[0] - r) * gs);
      out[o + 1] = half(gg + (gnd[1] - gg) * gs);
      out[o + 2] = half(b + (gnd[2] - b) * gs);
      out[o + 3] = one;
    }
  }
  src.dispose();

  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = true;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  setEnvironment(rt.texture, k);
  return { texture: rt.texture, intensity: k, sunColumn: sunCol, shift };
}
