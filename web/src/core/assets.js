import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { asset } from './paths.js';

// Shared asset loading with caching. Decoders are served from /draco/ and /basis/.
export function createAssets(renderer, quality) {
  const gltf = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(asset('draco/'));
  gltf.setDRACOLoader(draco);
  const ktx2 = new KTX2Loader().setTranscoderPath(asset('basis/')).detectSupport(renderer);
  gltf.setKTX2Loader(ktx2);
  gltf.setMeshoptDecoder(MeshoptDecoder);   // the CC0 packs in /assets/cc0 are meshopt-compressed
  const texLoader = new THREE.TextureLoader();
  const cache = new Map();

  return {
    gltfLoader: gltf,
    /** Load a glTF/GLB (cached). Returns the gltf result; clone scenes yourself if reused. */
    loadGLTF(url) {
      if (!cache.has(url)) cache.set(url, gltf.loadAsync(url));
      return cache.get(url);
    },
    /** Load a texture. opts: { srgb=true, repeat:[u,v], mipmaps=true } */
    loadTexture(url, opts = {}) {
      const key = url + JSON.stringify(opts);
      if (!cache.has(key)) {
        cache.set(key, texLoader.loadAsync(url).then((t) => {
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
