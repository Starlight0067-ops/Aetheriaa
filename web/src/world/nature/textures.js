import { asset } from '../../core/paths.js';
// Nature textures: AI-painted textures from public/assets/textures with procedural canvas fallbacks,
// plus generated helpers (tileable noise, birch bark, willow strands).
import * as THREE from 'three';
import { mulberry32 } from './common.js';

const BASE = asset('assets/textures/');
let cache = null;

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function finish(tex, { srgb = true, repeat = true, mirrored = false, aniso = 4 } = {}) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

// ------------------------------------------------------------------ tileable noise (data texture)
function makeNoiseTexture(size = 256) {
  const rnd = mulberry32(1337);
  const lattices = {};
  const lat = (p, s) => {
    const k = p + '_' + s;
    if (!lattices[k]) { const a = new Float32Array(p * p); for (let i = 0; i < a.length; i++) a[i] = rnd(); lattices[k] = a; }
    return lattices[k];
  };
  const sample = (u, v, p, s) => {
    const L = lat(p, s);
    const x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const g = (i, j) => L[((j % p + p) % p) * p + ((i % p + p) % p)];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const data = new Uint8Array(size * size * 4);
  const base = [4, 8, 16, 6];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    for (let c = 0; c < 4; c++) {
      let s = 0, a = 0.5, n = 0, p = base[c];
      for (let o = 0; o < 4; o++) { s += a * sample(u, v, p, c * 10 + o); n += a; a *= 0.5; p *= 2; }
      let val = s / n;
      val = Math.min(1, Math.max(0, (val - 0.5) * 1.9 + 0.5)); // stretch contrast
      data[(j * size + i) * 4 + c] = val * 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ painterly fallbacks
function strokes(ctx, size, n, colors, rnd, fn) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * size, y = rnd() * size;
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(x + ox, y + oy, rnd);
  }
}
function fallbackOpaque(kind) {
  const S = 512, c = canvas(S), g = c.getContext('2d'), rnd = mulberry32(kind.length * 99);
  const P = {
    grass: ['#5aa83a', ['#4c9a32', '#6cc24a', '#86cf52', '#3f8a35', '#9bd65b']],
    dirt: ['#b88a55', ['#a47648', '#c79b62', '#8e6a44', '#d4ad74', '#9a9a92']],
    rock: ['#a9a49c', ['#8e96a2', '#b9b2a5', '#c9c3b6', '#7a8496', '#d8d2c4']],
    cobble: ['#6b6450', ['#a8a396', '#b9a888', '#8f8a80', '#c2a27a']],
    bark: ['#6a5338', ['#5e3d27', '#7d6448', '#4a3424', '#6f7a3a']],
  }[kind];
  g.fillStyle = P[0]; g.fillRect(0, 0, S, S);
  if (kind === 'cobble') {
    strokes(g, S, 260, P[1], rnd, (x, y, r) => { g.beginPath(); g.ellipse(x, y, 14 + r() * 10, 11 + r() * 8, r() * 3, 0, 7); g.fill(); });
  } else if (kind === 'bark') {
    strokes(g, S, 900, P[1], rnd, (x, y, r) => { g.fillRect(x, y, 3 + r() * 6, 20 + r() * 50); });
  } else {
    strokes(g, S, 2600, P[1], rnd, (x, y, r) => { g.globalAlpha = 0.5; g.beginPath(); g.ellipse(x, y, 3 + r() * 9, 2 + r() * 4, r() * 3, 0, 7); g.fill(); g.globalAlpha = 1; });
  }
  return new THREE.CanvasTexture(c);
}
function fallbackCard(kind) {
  const S = 512, c = canvas(S), g = c.getContext('2d'), rnd = mulberry32(kind.length * 7 + 3);
  const cols = kind === 'blossom' ? ['#f7c6d4', '#f2a7bd', '#ffe3ec', '#e889a6'] : kind === 'pine' ? ['#2f6b55', '#3d8066', '#24584a', '#4f9478'] : ['#4c9a32', '#6cc24a', '#9bd65b', '#3f8a35', '#b6e070'];
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * S * 0.42;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    g.fillStyle = cols[(rnd() * cols.length) | 0];
    g.beginPath();
    if (kind === 'pine') g.ellipse(x, y, 3, 22, a, 0, 7); else g.ellipse(x, y, 10 + rnd() * 8, 20 + rnd() * 10, a + rnd(), 0, 7);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}
function fallbackFlowers() {
  const S = 512, c = canvas(S), g = c.getContext('2d'), rnd = mulberry32(5);
  const cols = ['#e85aa8', '#ffffff', '#f6d33a', '#6f9bf0'];
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 256, oy = (q >> 1) * 256;
    g.strokeStyle = '#3f8a35'; g.lineWidth = 5;
    for (let k = 0; k < 5; k++) {
      const x = ox + 60 + rnd() * 136, y = oy + 40 + rnd() * 90;
      g.beginPath(); g.moveTo(ox + 128, oy + 250); g.quadraticCurveTo(ox + 128, y + 60, x, y); g.stroke();
      g.fillStyle = cols[q];
      for (let p = 0; p < 6; p++) { g.beginPath(); g.ellipse(x + Math.cos(p) * 12, y + Math.sin(p) * 12, 10, 7, p, 0, 7); g.fill(); }
      g.fillStyle = '#f6b41a'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------------ generated helpers
function makeBirchBark() {
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = mulberry32(77);
  g.fillStyle = '#ece8df'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { g.fillStyle = rnd() < 0.5 ? '#ddd7cb' : '#f7f4ee'; g.fillRect(rnd() * W, rnd() * H, 20 + rnd() * 60, 2 + rnd() * 4); }
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = rnd() * H, w = 10 + rnd() * 45, h = 2 + rnd() * 5;
    g.fillStyle = rnd() < 0.7 ? '#2e2a2a' : '#5a4d44';
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { g.beginPath(); g.ellipse(x + ox, y + oy, w / 2, h / 2, 0, 0, 7); g.fill(); }
  }
  return new THREE.CanvasTexture(c);
}

function makeWillowStrands() {
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = mulberry32(31);
  const cols = ['#7fb24a', '#9bc95a', '#6aa040', '#b4d870', '#5c9238', '#8cbf50'];
  for (let s = 0; s < 6; s++) {
    let x = 26 + s * 41 + (rnd() - 0.5) * 14;
    const len = H * (0.55 + rnd() * 0.43);
    g.strokeStyle = '#6b8a3a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, len); g.stroke();
    for (let y = 4; y < len; y += 9) {
      x += (rnd() - 0.5) * 1.5;
      const taper = 1 - (y / len) * 0.55;
      for (const side of [-1, 1]) {
        g.fillStyle = cols[(rnd() * cols.length) | 0];
        g.beginPath(); g.ellipse(x + side * 5 * taper, y + 6, 2.6 * taper, 10 * taper, side * 0.35, 0, 7); g.fill();
      }
    }
  }
  return new THREE.CanvasTexture(c);
}

function makeReedTexture() {
  // a few tall reed blades + cattail heads on one card (alpha)
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = mulberry32(12);
  for (let i = 0; i < 16; i++) {
    const x0 = 40 + rnd() * 176, lean = (rnd() - 0.5) * 70, top = 30 + rnd() * 160;
    g.strokeStyle = ['#5d8a3a', '#6f9c45', '#7fa84f', '#4d7a33'][i % 4];
    g.lineWidth = 4 + rnd() * 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + lean * 0.3, (H + top) / 2, x0 + lean, top); g.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 40 + rnd() * 10, y = 40 + rnd() * 60;
    g.strokeStyle = '#6b7a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, H); g.lineTo(x, y - 20); g.stroke();
    g.fillStyle = '#6a4228'; g.beginPath(); g.ellipse(x, y + 22, 7, 26, 0, 0, 7); g.fill();
    g.fillStyle = '#835535'; g.beginPath(); g.ellipse(x - 2, y + 16, 3, 16, 0, 0, 7); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

/** Average colour of an image as a THREE.Color (sRGB input), or null when it cannot be read. */
function averageColor(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data;
    const acc = new THREE.Color(0, 0, 0), px = new THREE.Color();
    for (let i = 0; i < d.length; i += 4) { px.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); acc.add(px); }
    return acc.multiplyScalar(4 / d.length);
  } catch (e) { return null; }
}

/** Loads (once) every texture the nature systems use. */
export function loadNatureTextures(ctx) {
  if (cache) return cache;
  const aniso = ctx.quality.anisotropy || 4;
  // Third-party CC0 Poly Haven ground textures (public/assets/cc0/ground) replace the painted ones;
  // ?ground=old keeps the previous set. Every step falls back: CC0 file -> painted file -> procedural canvas.
  const cc0 = ctx.params?.get('ground') !== 'old';
  const CC0 = asset('assets/cc0/ground/');
  const load = async (name, fallback, opts, cc0Name = null) => {
    let t = null, fromCC0 = false;
    if (cc0 && cc0Name) { try { t = await ctx.assets.tryTexture(CC0 + cc0Name); fromCC0 = !!t; } catch (e) { t = null; } }
    if (!t) { try { t = await ctx.assets.tryTexture(BASE + name); } catch (e) { t = null; } }
    if (t) { t = t.clone(); t.needsUpdate = true; }
    else { console.warn('[nature] texture missing, using procedural fallback:', name); t = fallback(); }
    t = finish(t, { ...opts, aniso });
    t.userData.cc0 = fromCC0;
    return t;
  };
  cache = (async () => {
    const [grass, dirt, rock, cobble, bark, broadleaf, pine, blossom, flowers] = await Promise.all([
      load('grass.jpg', () => fallbackOpaque('grass'), undefined, 'aerial_grass_rock_diff_1k.jpg'),
      load('dirt_path.jpg', () => fallbackOpaque('dirt'), undefined, 'dirt_floor_diff_1k.jpg'),
      load('rock_cliff.jpg', () => fallbackOpaque('rock')),
      load('cobblestone.jpg', () => fallbackOpaque('cobble'), { mirrored: true }, 'cobblestone_floor_08_diff_1k.jpg'),
      load('bark.jpg', () => fallbackOpaque('bark')),
      load('leaves_broadleaf.png', () => fallbackCard('broadleaf'), { repeat: false }),
      load('leaves_pine.png', () => fallbackCard('pine'), { repeat: false }),
      load('leaves_blossom.png', () => fallbackCard('blossom'), { repeat: false }),
      load('flowers.png', () => fallbackFlowers(), { repeat: false }),
    ]);
    const noise = makeNoiseTexture();
    const birch = finish(makeBirchBark(), { aniso });
    const willow = finish(makeWillowStrands(), { repeat: false, aniso });
    const reed = finish(makeReedTexture(), { repeat: false, aniso });
    const grassAvg = grass.userData.cc0 ? averageColor(grass.image) : null;   // terrain normalises grass detail by this
    return { grassAvg, grass, dirt, rock, cobble, bark, broadleaf, pine, blossom, flowers, noise, birch, willow, reed };
  })();
  return cache;
}
