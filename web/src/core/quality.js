// Quality presets. Target: "max quality" on a dedicated GPU; `low` keeps Intel UHD laptops playable.
export const PRESETS = {
  low:    { name: 'low',    pixelRatio: 0.6,  shadows: true, shadowMapSize: 1024, cascades: 1, shadowFar: 45,  bloom: false, smaa: false, ao: false, outlines: 'characters', grassDensity: 0.15, treeDensity: 0.4, drawDistance: 340,  waterQuality: 'simple', anisotropy: 2 },
  medium: { name: 'medium', pixelRatio: 1.0,  shadows: true, shadowMapSize: 2048, cascades: 3, shadowFar: 130, bloom: true,  smaa: true,  ao: false, outlines: 'characters', grassDensity: 0.6, treeDensity: 0.8,  drawDistance: 650,  waterQuality: 'full',   anisotropy: 4 },
  high:   { name: 'high',   pixelRatio: 1.0,  shadows: true, shadowMapSize: 2048, cascades: 4, shadowFar: 220, bloom: true,  smaa: true,  ao: true,  outlines: 'all',        grassDensity: 1.0, treeDensity: 1.0,  drawDistance: 950,  waterQuality: 'full',   anisotropy: 8 },
  ultra:  { name: 'ultra',  pixelRatio: 1.5,  shadows: true, shadowMapSize: 4096, cascades: 4, shadowFar: 320, bloom: true,  smaa: true,  ao: true,  outlines: 'all',        grassDensity: 1.6, treeDensity: 1.3,  drawDistance: 1300, waterQuality: 'full',   anisotropy: 16 },
};

export function detectGPU() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  } catch { return 'unknown'; }
}

export function resolveQuality(requested) {
  const gpu = detectGPU();
  window.__AETHERIA_GPU = gpu;
  if (requested && PRESETS[requested]) return { ...PRESETS[requested], gpu };
  const weak = /Intel|UHD|Iris|SwiftShader|llvmpipe|Mali|Adreno|PowerVR|Apple GPU/i.test(gpu);
  return { ...PRESETS[weak ? 'low' : 'high'], gpu };
}
