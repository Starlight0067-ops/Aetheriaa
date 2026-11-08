// Vael Harrow materials: one toon material per surface slot used by the Blender kit (material names in the GLBs).
// Painted textures come from public/assets/textures; every slot has a procedural canvas fallback.
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';

const TEX = '/assets/textures/';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ------------------------------------------------------------------ procedural fallbacks
const FALLBACK = {
  roof: () => canvas(512, 512, (g, w, h) => {
    const r = rnd(3); g.fillStyle = '#b8492a'; g.fillRect(0, 0, w, h);
    const rows = 10, tw = w / 7;
    for (let j = 0; j < rows; j++) for (let i = -1; i < 8; i++) {
      const x = i * tw + (j % 2) * tw / 2, y = h - (j + 1) * h / rows;
      const l = 45 + r() * 12; g.fillStyle = `hsl(${14 + r() * 8},62%,${l}%)`;
      g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + tw - 2, y); g.lineTo(x + tw - 2, y + h / rows * 0.7);
      g.quadraticCurveTo(x + tw / 2, y + h / rows * 1.15, x + 2, y + h / rows * 0.7); g.closePath(); g.fill();
    }
  }),
  plaster: () => canvas(256, 256, (g, w, h) => {
    const r = rnd(5); g.fillStyle = '#f1e6d0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${200 + r() * 40},${180 + r() * 40},${150 + r() * 40},0.08)`; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 22, 0, 7); g.fill(); }
  }),
  timber: () => canvas(256, 256, (g, w, h) => {
    const r = rnd(9); g.fillStyle = '#5e3d27'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${40 + r() * 50},${25 + r() * 25},${12},0.5)`; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + r() * 6 - 3, 2 * w / 3, y + r() * 6 - 3, w, y); g.stroke(); }
  }),
  stone: () => canvas(512, 512, (g, w, h) => {
    const r = rnd(11); g.fillStyle = '#6f6c68'; g.fillRect(0, 0, w, h);
    const rows = 7;
    for (let j = 0; j < rows; j++) { let x = -r() * 60; const y = j * h / rows; while (x < w) { const bw = 70 + r() * 70; const l = 52 + r() * 14; g.fillStyle = `hsl(${210 + r() * 30},8%,${l}%)`; g.fillRect(x + 3, y + 3, bw - 6, h / rows - 6); x += bw; } }
  }),
  planks: () => canvas(256, 256, (g, w, h) => {
    const r = rnd(13);
    for (let i = 0; i < 10; i++) { g.fillStyle = `hsl(${28 + r() * 8},55%,${38 + r() * 14}%)`; g.fillRect(i * w / 10, 0, w / 10 - 2, h); }
  }),
  cobble: () => canvas(512, 512, (g, w, h) => {
    const r = rnd(17); g.fillStyle = '#5b5a4c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) { const l = 50 + r() * 20; g.fillStyle = `hsl(${30 + r() * 30},${10 + r() * 20}%,${l}%)`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 9, 8 + r() * 7, r() * 3, 0, 7); g.fill(); }
  }),
  ivy: () => canvas(256, 256, (g, w, h) => {
    const r = rnd(19);
    for (let i = 0; i < 400; i++) { const x = r() * w, y = r() * h * (0.3 + 0.7 * r()); g.fillStyle = `hsl(${95 + r() * 30},55%,${28 + r() * 25}%)`; g.beginPath(); g.ellipse(x, y, 6, 4, r() * 3, 0, 7); g.fill(); }
  }),
  flowers: () => canvas(256, 256, (g, w, h) => {
    const r = rnd(23); const cols = ['#e2589a', '#ffffff', '#f2cf2a', '#6a8ff0'];
    for (let q = 0; q < 4; q++) { const ox = (q % 2) * w / 2, oy = (q < 2 ? 0 : h / 2);
      for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#3f8a3a' : cols[q]; g.beginPath(); g.arc(ox + 20 + r() * (w / 2 - 40), oy + 20 + r() * (h / 2 - 40), 5 + r() * 5, 0, 7); g.fill(); } }
  }),
};

/** Copy an image into a canvas, optionally desaturating (for tintable variants) and cropping rows. */
function processed(img, { desat = 0, gain = 1, crop = null } = {}) {
  const sx = crop ? crop[0] : 0, sy = crop ? crop[1] : 0, sw = crop ? crop[2] : img.width, sh = crop ? crop[3] : img.height;
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const g = c.getContext('2d');
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  if (desat > 0 || gain !== 1) {
    const d = g.getImageData(0, 0, sw, sh), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const l = a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;
      for (let k = 0; k < 3; k++) a[i + k] = Math.min(255, (a[i + k] + (l - a[i + k]) * desat) * gain);
    }
    g.putImageData(d, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createMaterials(ctx) {
  const A = ctx.assets;
  const aniso = ctx.quality.anisotropy || 4;
  const load = async (name) => {
    try {
      const t = await A.tryTexture(TEX + name);
      return t || null;
    } catch (e) { return null; }
  };
  const names = ['roof_tiles.jpg', 'plaster.jpg', 'timber.jpg', 'stone_wall.jpg', 'wood_planks.jpg', 'cobblestone.jpg', 'ivy.png', 'flowers.png'];
  const [roofT, plasterT, timberT, stoneT, planksT, cobbleT, ivyT, flowersT] = await Promise.all(names.map(load));

  const prep = (t, { wrapS = THREE.RepeatWrapping, wrapT = THREE.RepeatWrapping, repeat = 1 } = {}) => {
    t.wrapS = wrapS; t.wrapT = wrapT;
    t.repeat.set(repeat, repeat);
    t.anisotropy = aniso;
    t.needsUpdate = true;
    return t;
  };
  const M = THREE.MirroredRepeatWrapping;
  const roof = prep(roofT ? roofT.clone() : FALLBACK.roof(), { wrapS: M });
  let slateTex = null;
  if (roofT?.image) slateTex = prep(processed(roofT.image, { desat: 1.0, gain: 1.25 }), { wrapS: M });
  else slateTex = prep(FALLBACK.roof(), { wrapS: M });
  const plaster = prep(plasterT ? plasterT.clone() : FALLBACK.plaster(), { repeat: 1 / 3 });
  const timber = prep(timberT ? timberT.clone() : FALLBACK.timber(), { wrapS: M });
  // stone_wall: crop to 6 whole block rows so the vertical repeat is seamless
  let stone;
  if (stoneT?.image) stone = prep(processed(stoneT.image, { crop: [0, 128, 1024, 815] }), { wrapS: M, repeat: 1 / 2.6 });
  else stone = prep(FALLBACK.stone(), { repeat: 1 / 2.6 });
  const planks = prep(planksT ? planksT.clone() : FALLBACK.planks(), { wrapS: M });
  let paintTex;
  if (planksT?.image) paintTex = prep(processed(planksT.image, { desat: 0.92, gain: 1.45 }), { wrapS: M });
  else paintTex = prep(FALLBACK.planks(), { wrapS: M });
  const cobble = prep(cobbleT ? cobbleT.clone() : FALLBACK.cobble(), { wrapS: M, wrapT: M, repeat: 1 / 2.4 });
  const ivy = ivyT || FALLBACK.ivy();
  ivy.wrapS = ivy.wrapT = THREE.ClampToEdgeWrapping;
  const flowers = flowersT || FALLBACK.flowers();
  flowers.wrapS = flowers.wrapT = THREE.ClampToEdgeWrapping;

  const vc = { vertexColors: true };
  const mats = {
    roof: createToonMaterial({ ...vc, map: roof, kind: 'roof' }),
    slate: createToonMaterial({ ...vc, map: slateTex, kind: 'roof', color: 0x5d8f9c }),
    plaster: createToonMaterial({ ...vc, map: plaster, kind: 'plaster' }),
    timber: createToonMaterial({ ...vc, map: timber, kind: 'wood' }),
    stone: createToonMaterial({ ...vc, map: stone, kind: 'stone', color: 0xf2eee6 }),
    planks: createToonMaterial({ ...vc, map: planks, kind: 'wood' }),
    paint: createToonMaterial({ ...vc, map: paintTex, kind: 'wood' }),
    glass: createToonMaterial({ ...vc, kind: 'metal', color: 0xffffff }),
    metal: createToonMaterial({ ...vc, kind: 'metal', color: 0x4a4650 }),
    cloth: createToonMaterial({ ...vc, kind: 'cloth', side: THREE.DoubleSide }),
    glow: createToonMaterial({ ...vc, kind: 'glow', color: 0xffd38a, emissive: 0xffb456, emissiveIntensity: 1.6 }),
    flowers: createToonMaterial({ ...vc, map: flowers, kind: 'foliage', alphaTest: 0.5, side: THREE.DoubleSide }),
    ivy: createToonMaterial({ ...vc, map: ivy, kind: 'foliage', alphaTest: 0.5, side: THREE.DoubleSide }),
    gold: createToonMaterial({ ...vc, kind: 'metal', color: 0xe2b95b, emissive: 0x3a2a08, emissiveIntensity: 1 }),
    water: createToonMaterial({ ...vc, kind: 'water', color: 0x63c6e0, transparent: true }),
    cobble: createToonMaterial({ ...vc, map: cobble, kind: 'stone' }),
    leaf: createToonMaterial({ ...vc, kind: 'foliage', color: 0x5f9e45 }),
    aether: createToonMaterial({ ...vc, kind: 'glow', color: 0x7ff5ff, emissive: 0x4fe6ff, emissiveIntensity: 2.2 }),
  };
  if (mats.water.opacity !== undefined) mats.water.opacity = 0.85;
  for (const [k, m] of Object.entries(mats)) m.name = 'town_' + k;
  // street surface sits on the terrain: pull it forward in depth to avoid z-fighting
  mats.cobble.polygonOffset = true; mats.cobble.polygonOffsetFactor = -2; mats.cobble.polygonOffsetUnits = -4;
  return { mats, textures: { roof, slateTex, plaster, timber, stone, planks, paintTex, cobble, ivy, flowers }, missing: names.filter((n, i) => ![roofT, plasterT, timberT, stoneT, planksT, cobbleT, ivyT, flowersT][i]) };
}

// ------------------------------------------------------------------ tints (linear multipliers via THREE.Color)
export const PALETTE = {
  roof: [0xffffff, 0xf4e2d8, 0xffe9d6, 0xe8c9bc, 0xf9d8c0, 0xd9b7a8, 0xffffff, 0xf0d0b8],
  plaster: [0xffffff, 0xfff6ea, 0xf7efe6, 0xfbf0e0, 0xf3ebe6, 0xfff2df, 0xf6f1f4, 0xfaf3e3],
  timber: [0xffffff, 0xe7d6cc, 0xd4c3b8, 0xfff0e0, 0xc9b5a8],
  stone: [0xffffff, 0xf5ede0, 0xe9e6e2, 0xfff4e4, 0xe3e4e8],
  paint: [0x3fa7a2, 0x2f7f86, 0x5a8f52, 0xb8463a, 0x3f63a6, 0xd09a3c, 0x7c4f8f, 0x2b9c9a, 0x9a3f3a, 0x467a9e],
};
