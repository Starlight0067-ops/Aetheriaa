// Debug memory summary: window.__mem() -> { texMB, geoMB, ... }. Estimates are decoded sizes (GPU + CPU copies not included).
import * as THREE from 'three';

const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'envMap', 'lightMap', 'displacementMap', 'specularMap', 'gradientMap', 'transmissionMap', 'thicknessMap', 'clearcoatMap', 'matcap'];

function texBytes(t) {
  const im = t.image || t.source?.data;
  let w = 0, h = 0;
  if (t.isCompressedTexture && t.mipmaps?.length) { w = t.mipmaps[0].width; h = t.mipmaps[0].height; }
  else if (im) { w = im.videoWidth || im.naturalWidth || im.width || 0; h = im.videoHeight || im.naturalHeight || im.height || 0; }
  if (t.isCubeTexture) return 0;
  const bpp = t.type === THREE.FloatType ? 16 : t.type === THREE.HalfFloatType ? 8 : 4;
  const mip = (t.generateMipmaps || (t.mipmaps && t.mipmaps.length > 1)) && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter ? 1.33 : 1;
  return w * h * bpp * mip;
}

export function installMem(ctx) {
  window.__mem = (n = 12) => {
    const { renderer, scene } = ctx;
    const seen = new Set(); const list = [];
    const add = (t, owner) => { if (!t || !t.isTexture) return; const key = (t.source?.uuid || t.uuid) + (t.generateMipmaps ? 'm' : ''); if (seen.has(key)) return; seen.add(key); list.push({ name: t.name || owner || '', uuid: t.uuid.slice(0, 6), bytes: texBytes(t), w: (t.image || {}).width, h: (t.image || {}).height }); };
    const geos = new Set(); let tris = 0, verts = 0, geoBytes = 0, geoGpuBytes = 0, meshes = 0, instMeshes = 0, instances = 0;
    const mats = new Set();
    scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isLine) {
        meshes++; if (o.isInstancedMesh) { instMeshes++; instances += o.count; }
        const g = o.geometry;
        if (g && !geos.has(g.uuid)) {
          geos.add(g.uuid);
          for (const k in g.attributes) { const a = g.attributes[k]; geoGpuBytes += a.count * a.itemSize * (a.array ? a.array.BYTES_PER_ELEMENT : 4); if (a.array) geoBytes += a.array.byteLength; }
          if (g.index) { geoGpuBytes += g.index.count * 4; if (g.index.array) geoBytes += g.index.array.byteLength; }
          verts += g.attributes.position?.count || 0;
        }
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m && !mats.has(m.uuid)) {
          mats.add(m.uuid);
          for (const k of TEX_KEYS) add(m[k], k);
          if (m.uniforms) for (const k in m.uniforms) add(m.uniforms[k]?.value, 'u_' + k);
        }
      }
    });
    add(scene.background, 'background'); add(scene.environment, 'environment');
    list.sort((a, b) => b.bytes - a.bytes);
    const texMB = list.reduce((s, t) => s + t.bytes, 0) / 1048576;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const mp = size.x * size.y / 1e6;
    const rt = ctx.systems?.pipeline?.rtInfo?.() || null;
    const info = renderer.info;
    const sh = ctx.quality;
    const shadowMB = sh.shadows ? sh.cascades * sh.shadowMapSize * sh.shadowMapSize * 4 / 1048576 : 0;
    const mem = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
    const out = {
      profile: sh.safe ? 'safe' + sh.safe : 'normal', quality: sh.name,
      canvas: size.x + 'x' + size.y, MP: +mp.toFixed(2), pixelRatio: renderer.getPixelRatio(),
      rendererTextures: info.memory.textures, rendererGeometries: info.memory.geometries,
      sceneTextures: list.length, texMB: +texMB.toFixed(1), geoCpuMB: +(geoBytes / 1048576).toFixed(1), geoGpuMB: +(geoGpuBytes / 1048576).toFixed(1),
      shadowMB: +shadowMB.toFixed(1), rtMB: rt ? +rt.toFixed(1) : null,
      drawCalls: info.render.calls, triangles: info.render.triangles, sceneVerts: verts, meshes, instancedMeshes: instMeshes, instances,
      jsHeapMB: mem && +mem.toFixed(1),
      totalEstMB: +(texMB + geoGpuBytes / 1048576 + shadowMB + (rt || 0) + mp * 4 * 3 + (mem || 0)).toFixed(0),
      top: list.slice(0, n).map((t) => `${(t.bytes / 1048576).toFixed(1)}MB ${t.w}x${t.h} ${t.name}`),
    };
    return out;
  };
}
