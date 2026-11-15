import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { asset } from './paths.js';
import { SAFE } from './profile.js';

// Shared asset loading with caching. Decoders are served from /draco/ and /basis/.
export const loadProgress = { total: 0, done: 0 };
const TEX_RE = /assets\/(free|textures|cc0\/ground|town)\/(.+)\.(png|jpe?g)$/i;
let mobileSet = null;           // Set of "free/medieval/T_Brick_BaseColor" with a generated variant (safe profile only)

/** Safe profile: fetch the manifest of generated reduced textures (tools/make-mobile-assets.cjs). */
export async function loadMobileManifest() {
  if (!SAFE || mobileSet) return;
  try {
    const r = await fetch(asset('assets/mobile/manifest.json'));
    const j = await r.json();
    mobileSet = new Set(j.files);
  } catch { mobileSet = new Set(); }
}

/** Map a texture URL to its reduced variant (512 px, or 256 px at safe=2) when one exists. */
export function mobileTexURL(url, quality) {
  if (!SAFE || !mobileSet) return url;
  const m = TEX_RE.exec(url.split('?')[0]);
  if (!m) return url;
  const key = m[1] + '/' + m[2];
  if (!mobileSet.has(key)) return url;
  return asset(`assets/mobile/${quality.texMax || 512}/${key}.webp`);
}

export function createAssets(renderer, quality) {
  // serial loading in the safe profile: parsing/decoding several big files at once spikes memory
  const queue = [];
  let running = 0;
  const maxRun = SAFE ? 2 : 64;
  const pump = () => {
    while (running < maxRun && queue.length) {
      const job = queue.shift(); running++;
      job().finally(() => { running--; loadProgress.done++; pump(); });
    }
  };
  const enqueue = (fn) => { loadProgress.total++; return new Promise((res, rej) => { queue.push(() => fn().then(res, rej)); pump(); }); };
  const manager = new THREE.LoadingManager();
  if (SAFE) manager.setURLModifier((u) => mobileTexURL(u, quality));
  const gltf = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  draco.setDecoderPath(asset('draco/'));
  gltf.setDRACOLoader(draco);
  const ktx2 = new KTX2Loader().setTranscoderPath(asset('basis/')).detectSupport(renderer);
  gltf.setKTX2Loader(ktx2);
  gltf.setMeshoptDecoder(MeshoptDecoder);   // the CC0 packs in /assets/cc0 are meshopt-compressed
  const texLoader = new THREE.TextureLoader(manager);
  const cache = new Map();

  return {
    gltfLoader: gltf,
    /** Drop cached glTF / texture promises whose URL contains `part` (frees parsed scenes after a system is built). */
    evict(part) { for (const k of [...cache.keys()]) if (k.includes(part)) cache.delete(k); },
    /** Terminate draco/basis worker pools (they keep wasm heaps + buffers alive). They respawn on demand. */
    releaseDecoders() { try { draco.dispose(); ktx2.dispose(); } catch { /* ignore */ } },
    /** Load a glTF/GLB (cached). Returns the gltf result; clone scenes yourself if reused. */
    loadGLTF(url) {
      if (!cache.has(url)) cache.set(url, enqueue(() => gltf.loadAsync(url)));
      return cache.get(url);
    },
    /** Load a texture. opts: { srgb=true, repeat:[u,v], mipmaps=true } */
    loadTexture(url, opts = {}) {
      const key = url + JSON.stringify(opts);
      if (!cache.has(key)) {
        cache.set(key, enqueue(() => texLoader.loadAsync(url)).then((t) => {
          t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          t.anisotropy = quality.anisotropy;
          if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
          return t;
        }));
      }
      return cache.get(key);
    },
    /** Same as loadTexture but resolves null instead of throwing when the file is missing. */
    async tryTexture(url, opts) {
      try { return await this.loadTexture(url, opts); } catch { return null; }
    },
  };
}
