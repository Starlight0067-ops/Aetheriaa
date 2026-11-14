// Quality presets. `ultra`/`high` target dedicated GPUs, `medium` integrated/desktop-class mobile, `low` keeps
// Intel UHD laptops and mid-range phones fluid. `?quality=low|medium|high|ultra` pins a preset; anything else
// (or `auto`) picks one from the GPU / device class and lets the render pipeline's governor trade resolution
// and post effects for frame rate at runtime (see render/pipeline.js).
//
// Fields: pixelRatio (absolute cap, CSS px), shadows + shadowMapSize/cascades/shadowFar (CSM), bloom, smaa,
// ao (depth AO), outlines, grassDensity/treeDensity, drawDistance, waterQuality, anisotropy,
// pbrSpecular (GGX + sky IBL specular lobe), normalMaps (generated/loaded detail normals on buildings),
// ink (world depth-ink strength), minScale (lowest dynamic-resolution factor the governor may reach).
export const PRESETS = {
  low:    { name: 'low',    pixelRatio: 0.6,  shadows: true, shadowMapSize: 1024, cascades: 1, shadowFar: 45,  bloom: false, smaa: false, ao: false, outlines: 'characters', grassDensity: 0.15, treeDensity: 0.4, drawDistance: 340,  waterQuality: 'simple', anisotropy: 2,  pbrSpecular: false, normalMaps: false, ink: 0.0,  minScale: 0.6 },
  medium: { name: 'medium', pixelRatio: 1.0,  shadows: true, shadowMapSize: 2048, cascades: 3, shadowFar: 130, bloom: true,  smaa: true,  ao: false, outlines: 'characters', grassDensity: 0.6,  treeDensity: 0.8, drawDistance: 650,  waterQuality: 'full',   anisotropy: 4,  pbrSpecular: true,  normalMaps: true,  ink: 0.18, minScale: 0.6 },
  high:   { name: 'high',   pixelRatio: 1.0,  shadows: true, shadowMapSize: 2048, cascades: 4, shadowFar: 220, bloom: true,  smaa: true,  ao: true,  outlines: 'all',        grassDensity: 1.0,  treeDensity: 1.0, drawDistance: 950,  waterQuality: 'full',   anisotropy: 8,  pbrSpecular: true,  normalMaps: true,  ink: 0.25, minScale: 0.65 },
  ultra:  { name: 'ultra',  pixelRatio: 1.5,  shadows: true, shadowMapSize: 4096, cascades: 4, shadowFar: 320, bloom: true,  smaa: true,  ao: true,  outlines: 'all',        grassDensity: 1.6,  treeDensity: 1.3, drawDistance: 1300, waterQuality: 'full',   anisotropy: 16, pbrSpecular: true,  normalMaps: true,  ink: 0.25, minScale: 0.7 },
};

export function detectGPU() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  } catch { return 'unknown'; }
}

export function isMobileDevice() {
  try {
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Quest/i.test(ua)) return true;
    // iPadOS reports a desktop UA; a coarse primary pointer without hover is a touch device
    return navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches;
  } catch { return false; }
}

/** Phone / tablet variant of a preset: sharp enough on high-DPR screens, light shadows, no heavy post. */
function mobileVariant(base, strong) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const q = { ...base };
  // render at roughly half the native density: ≥1 CSS px (never blurrier than a desktop page), capped
  q.pixelRatio = Math.min(dpr, Math.max(1.0, Math.min(dpr * 0.5, strong ? 1.5 : 1.25)));
  q.minScale = 0.6;
  q.ao = false;
  q.smaa = false;                                   // high DPR hides aliasing; saves a full-screen pass
  q.shadowMapSize = Math.min(q.shadowMapSize, strong ? 2048 : 1024);
  q.cascades = Math.min(q.cascades, strong ? 2 : 1);
  q.shadowFar = Math.min(q.shadowFar, strong ? 90 : 45);
  q.anisotropy = Math.min(q.anisotropy, 4);
  q.outlines = 'characters';
  q.mobile = true;
  return q;
}

export function resolveQuality(requested) {
  const gpu = detectGPU();
  window.__AETHERIA_GPU = gpu;
  const mobile = isMobileDevice();
  if (requested && PRESETS[requested]) {
    const q = { ...PRESETS[requested], gpu, auto: false, mobile };
    // an explicit preset on a phone still respects the display: never render below 1 CSS px on high-DPR screens
    if (mobile && q.pixelRatio < 1) q.pixelRatio = 1.0;
    return q;
  }
  let q;
  if (mobile) {
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    const strong = /Apple (A1[5-9]|M\d)|Apple GPU|Adreno \(TM\) (7[3-9]\d|8\d\d)|Mali-G(7[1-9]\d|[89]\d\d)|Immortalis|Xclipse 9/i.test(gpu) && cores >= 6 && mem >= 4;
    q = mobileVariant(PRESETS[strong ? 'medium' : 'low'], strong);
  } else {
    const software = /SwiftShader|llvmpipe|Software/i.test(gpu);
    const weak = /Intel|UHD|Iris|Mali|Adreno|PowerVR/i.test(gpu);
    const integrated = /Apple M\d|Radeon\(TM\) Graphics|Radeon Graphics|Vega|Arc\(TM\)/i.test(gpu);
    q = { ...PRESETS[software || weak ? 'low' : integrated ? 'medium' : 'high'] };
  }
  return { ...q, gpu, auto: true, mobile };
}
