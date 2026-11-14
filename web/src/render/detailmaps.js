// AETHERIA — derived PBR detail maps (owner: render).
// Many of the CC0 building/prop albedos ship without normal maps. deriveNormalMap() builds a tangent-space
// normal map from the albedo's luminance (dark mortar/joints = low, bright faces = high) so walls, roof
// courses and planks catch the sun and the sky specular like real relief. Cached per source texture.
// opts: strength (default 2), axis 'xy' | 'y' ('y' = vertical relief only; required when the texture is
// sampled with MirroredRepeatWrapping on S, where an X slope would flip on every other tile), maxSize.
import * as THREE from 'three';

const cache = new WeakMap();

export function deriveNormalMap(src, opts = {}) {
  const img = src?.image;
  if (!img || !(img.width > 4) || !(img.height > 4)) return null;
  const strength = opts.strength ?? 2.0, axis = opts.axis ?? 'xy';
  const key = strength + '|' + axis;
  let per = cache.get(img);
  if (!per) { per = new Map(); cache.set(img, per); }
  let base = per.get(key);
  if (!base) {
    try {
      const max = opts.maxSize ?? 1024;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(4, Math.round(img.width * k)), h = Math.max(4, Math.round(img.height * k));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h), a = d.data;
      const H = new Float32Array(w * h);
      for (let i = 0, j = 0; i < H.length; i++, j += 4) H[i] = (a[j] * 0.299 + a[j + 1] * 0.587 + a[j + 2] * 0.114) / 255;
      // one 3x3 box blur pass: removes JPEG/pixel noise so only real features produce slopes
      const B = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const y0 = ((y - 1 + h) % h) * w, y1 = y * w, y2 = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const x0 = (x - 1 + w) % w, x2 = (x + 1) % w;
          B[y1 + x] = (H[y0 + x0] + H[y0 + x] + H[y0 + x2] + H[y1 + x0] + H[y1 + x] + H[y1 + x2] + H[y2 + x0] + H[y2 + x] + H[y2 + x2]) / 9;
        }
      }
      const vs = src.flipY ? 1 : -1;            // image rows run down; with flipY the V axis runs up
      const s = strength * (w / 256);
      for (let y = 0; y < h; y++) {
        const y0 = ((y - 1 + h) % h) * w, y2 = ((y + 1) % h) * w, y1 = y * w;
        for (let x = 0; x < w; x++) {
          const x0 = (x - 1 + w) % w, x2 = (x + 1) % w;
          let nx = axis === 'y' ? 0 : -(B[y1 + x2] - B[y1 + x0]) * s;
          let ny = (B[y2 + x] - B[y0 + x]) * s * vs;
          const l = 1 / Math.hypot(nx, ny, 1);
          const j = (y1 + x) * 4;
          a[j] = (nx * l * 0.5 + 0.5) * 255; a[j + 1] = (ny * l * 0.5 + 0.5) * 255; a[j + 2] = (l * 0.5 + 0.5) * 255; a[j + 3] = 255;
        }
      }
      g.putImageData(d, 0, 0);
      base = new THREE.CanvasTexture(cv);
      base.colorSpace = THREE.NoColorSpace;
    } catch (e) {
      console.warn('[detailmaps] normal derivation failed', e);
      base = null;
    }
    per.set(key, base);
  }
  if (!base) return null;
  const t = base.clone();
  t.wrapS = src.wrapS; t.wrapT = src.wrapT;
  t.repeat.copy(src.repeat); t.offset.copy(src.offset); t.rotation = src.rotation; t.center.copy(src.center);
  t.flipY = src.flipY;
  t.anisotropy = src.anisotropy;
  t.channel = src.channel;
  t.needsUpdate = true;
  return t;
}
