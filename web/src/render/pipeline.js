// AETHERIA — post stack (owner: render). pmndrs `postprocessing`:
//   RenderPass (HDR half-float) → GTAO (high/ultra: three's GTAOPass driven in place on the HDR buffer, normals
//   reconstructed from the composer depth, Poisson denoise) → EffectPass[ bloom (threshold: emissive + sun only) ·
//   grade (AgX "punchy" tone map, warm-highlight / cool-shadow split tone, saturation, depth ink lines,
//   vignette) ] → EffectPass[ SMAA ] (when enabled). low / medium run no AO pass at all.
//
// Anti-aliasing: SMAA stays, temporal AA is deliberately NOT used. In the WebGL renderer the only temporal
// options are three's TAARenderPass (plain multi-frame accumulation: it only converges on a static image, so
// skinned characters, swaying foliage, water and the orbit camera smear/ghost unless accumulation is reset
// every frame, which degenerates to no AA) and a hand-rolled reprojection TAA, which needs per-object motion
// vectors for skinned + instanced + vertex-animated (wind) geometry — a second scene pass with a velocity
// variant of every custom shader in this project. three's real TRAA (TRAANode) exists only for the
// WebGPU/TSL renderer. SMAA is single-frame, so animated characters never ghost.
// API: { composer, render(dt), resize(w,h), depthTexture (getter), grade (uniform access), setExposure(v) }
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BlendFunction,
  BloomEffect, SMAAEffect, SMAAPreset, Pass,
} from 'postprocessing';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { setOutlineViewport } from './toon.js';
import { heightAt } from '../core/layout.js';

const AO_FRAG = /* glsl */`
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uAoRadius;
uniform float uAoStrength;
vec3 aoViewPos( vec2 uv ) {
  float d = readDepth( uv );
  float z = getViewZ( d );
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3( ndc.x * uTanHalfFov * uAspect * -z, ndc.y * uTanHalfFov * -z, z );
}
void mainImage( const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor ) {
  outputColor = inputColor;
  if ( depth >= 0.99999 ) return;
  vec3 P = aoViewPos( uv );
  vec3 N = normalize( cross( dFdx( P ), dFdy( P ) ) );
  float rUv = uAoRadius / ( -P.z * uTanHalfFov * 2.0 );
  rUv = min( rUv, 0.08 );
  float phi = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) * 6.2831853;
  float occ = 0.0;
  const int S = 10;
  for ( int i = 0; i < S; i ++ ) {
    float r = sqrt( ( float( i ) + 0.5 ) / float( S ) );
    float th = float( i ) * 2.39996323 + phi;
    vec2 o = vec2( cos( th ), sin( th ) * uAspect ) * r * rUv;
    vec3 Q = aoViewPos( uv + o );
    vec3 v = Q - P;
    float vv = dot( v, v );
    float range = 1.0 - smoothstep( uAoRadius * 0.6, uAoRadius * 1.6, sqrt( vv ) );
    occ += max( 0.0, dot( v, N ) - 0.02 * -P.z ) / ( vv + 0.05 ) * range;
  }
  occ = clamp( occ / float( S ) * 1.6, 0.0, 1.0 );
  float fade = 1.0 - smoothstep( 60.0, 160.0, -P.z );
  float ao = 1.0 - occ * uAoStrength * fade;
  // tint occlusion slightly toward the cool shadow hue instead of grey
  outputColor.rgb = inputColor.rgb * mix( vec3( 0.62, 0.66, 0.85 ), vec3( 1.0 ), ao );
}`;

class AOEffect extends Effect {
  constructor() {
    super('AetheriaAO', AO_FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uTanHalfFov', { value: 0.5 }], ['uAspect', { value: 1.7 }],
        ['uAoRadius', { value: 1.4 }], ['uAoStrength', { value: 0.85 }],
      ]),
    });
  }
}

/** three's GTAOPass inside the pmndrs composer. The AO + denoise targets are private to the pass; the result is
 *  multiplied straight onto the HDR input buffer (no buffer swap → the composer's depth texture is never bound
 *  as an attachment and a sampler at the same time). */
class GTAOAdapter extends Pass {
  constructor(scene, camera, { samples = 16, radius = 1.1, intensity = 1.0, scale = 1.0 } = {}) {
    super('AetheriaGTAO');
    this.needsSwap = false;
    this.needsDepthTexture = true;
    this.resScale = scale;
    this.gtao = new GTAOPass(scene, camera, 256, 256, undefined,
      { radius, distanceExponent: 1.0, thickness: 1.0, scale: 1.0, samples, distanceFallOff: 1.0, screenSpaceRadius: false },
      { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1.5, rings: 2, samples: 12 });
    this.gtao.output = GTAOPass.OUTPUT.Off;
    this.gtao.blendIntensity = intensity;
    this.ready = false;
  }
  setDepthTexture(depthTexture) {
    this.gtao.setGBuffer(depthTexture, undefined);      // normals reconstructed from depth: no extra scene pass
    this.ready = true;
  }
  render(renderer, inputBuffer) {
    if (!this.ready) return;
    const g = this.gtao;
    g.render(renderer, null, inputBuffer);              // AO + Poisson denoise into g.pdRenderTarget
    g.blendMaterial.uniforms.intensity.value = g.blendIntensity;
    g.blendMaterial.uniforms.tDiffuse.value = g.pdRenderTarget.texture;
    g._renderPass(renderer, g.blendMaterial, inputBuffer);
  }
  setSize(w, h) { this.gtao.setSize(Math.max(2, Math.round(w * this.resScale)), Math.max(2, Math.round(h * this.resScale))); }
  dispose() { this.gtao.dispose(); super.dispose(); }
}

const GRADE_FRAG = /* glsl */`
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uShadowTone;
uniform vec3 uHighTone;
uniform float uVignette;
uniform float uInk;
uniform vec3 uInkColor;

const mat3 AE_TO2020 = mat3( vec3( 0.6274, 0.0691, 0.0164 ), vec3( 0.3293, 0.9195, 0.0880 ), vec3( 0.0433, 0.0113, 0.8956 ) );
const mat3 AE_FROM2020 = mat3( vec3( 1.6605, -0.1246, -0.0182 ), vec3( -0.5876, 1.1329, -0.1006 ), vec3( -0.0728, -0.0083, 1.1187 ) );
vec3 aeAgxCurve( vec3 x ) {
  vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 aeAgx( vec3 color ) {
  const mat3 inset = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
  const mat3 outset = mat3( vec3( 1.1271005818144368, -0.1413297634984383, -0.14132976349843826 ), vec3( -0.11060664309660323, 1.157823702216272, -0.11060664309660294 ), vec3( -0.016493938717834573, -0.016493938717834257, 1.2519364065950405 ) );
  const float minEv = -12.47393; const float maxEv = 4.026069;
  color = inset * ( AE_TO2020 * color );
  color = clamp( ( log2( max( color, 1e-10 ) ) - minEv ) / ( maxEv - minEv ), 0.0, 1.0 );
  color = aeAgxCurve( color );
  // "punchy" look (Blender): power + saturation in AgX space
  color = pow( max( color, 0.0 ), vec3( 1.12 ) );
  float l = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
  color = l + ( color - l ) * 1.32;
  color = outset * color;
  color = pow( max( color, 0.0 ), vec3( 2.2 ) );
  return clamp( AE_FROM2020 * color, 0.0, 1.0 );
}
float aeLinZ( vec2 uv ) { return -getViewZ( readDepth( uv ) ); }

void mainImage( const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor ) {
  vec3 c = inputColor.rgb;
  // depth ink lines (silhouettes) before tone mapping so they sit under bloom glow
  if ( uInk > 0.0 && depth < 0.99999 ) {
    float z = aeLinZ( uv );
    vec2 t = texelSize;
    float zl = aeLinZ( uv - vec2( t.x, 0.0 ) ), zr = aeLinZ( uv + vec2( t.x, 0.0 ) );
    float zu = aeLinZ( uv + vec2( 0.0, t.y ) ), zd = aeLinZ( uv - vec2( 0.0, t.y ) );
    // only the nearer side of a depth step draws the line (2nd derivative style)
    float dz = max( max( zl, zr ), max( zu, zd ) ) - z;
    float e = smoothstep( 0.035, 0.09, dz / z );
    e *= 1.0 - smoothstep( 90.0, 260.0, z );
    c = mix( c, c * uInkColor, e * uInk );
  }
  c *= uExposure;
  c = aeAgx( c );
  // display-space grade
  vec3 g = pow( c, vec3( 1.0 / 2.2 ) );
  float l = dot( g, vec3( 0.2126, 0.7152, 0.0722 ) );
  g += uShadowTone * ( 1.0 - smoothstep( 0.0, 0.55, l ) ) + uHighTone * smoothstep( 0.45, 1.0, l );
  g = ( g - 0.5 ) * uContrast + 0.5;
  l = dot( g, vec3( 0.2126, 0.7152, 0.0722 ) );
  float sat = max( max( g.r, g.g ), g.b ) - min( min( g.r, g.g ), g.b );
  g = l + ( g - l ) * mix( uSaturation, 1.0, smoothstep( 0.4, 0.9, sat ) * 0.5 ); // vibrance-style
  // tame acid yellow-greens (keep foliage lush, never neon): pull G toward R/B midpoint when G dominates
  float gDom = clamp( ( g.g - max( g.r, g.b ) ) * 2.5, 0.0, 1.0 ) * smoothstep( 0.25, 0.7, g.g );
  g.g = mix( g.g, max( g.r, g.b ) + ( g.g - max( g.r, g.b ) ) * 0.78, gDom );
  vec2 q = uv - 0.5;
  float v = smoothstep( 0.35, 0.95, length( q * vec2( 1.1, 1.0 ) ) );
  g *= mix( vec3( 1.0 ), vec3( 0.86, 0.88, 0.97 ), v * uVignette * 2.0 );
  g = clamp( g, 0.0, 1.0 );
  outputColor = vec4( pow( g, vec3( 2.2 ) ), inputColor.a );
}`;

class GradeEffect extends Effect {
  constructor(THREE, ink) {
    super('AetheriaGrade', GRADE_FRAG, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SET,
      uniforms: new Map([
        ['uExposure', { value: 1.0 }],
        ['uSaturation', { value: 1.12 }],
        ['uContrast', { value: 1.09 }],
        ['uShadowTone', { value: new THREE.Vector3(-0.012, 0.0, 0.03) }],
        ['uHighTone', { value: new THREE.Vector3(0.02, 0.01, -0.012) }],
        ['uVignette', { value: 0.22 }],
        ['uInk', { value: ink }],
        ['uInkColor', { value: new THREE.Vector3(0.32, 0.3, 0.42) }],
      ]),
    });
  }
}

export async function create(ctx) {
  const { THREE, renderer, scene, camera, quality } = ctx;
  renderer.toneMapping = THREE.NoToneMapping;
  const lighting = ctx.systems.lighting;
  let composer = null, grade = null, ao = null, gtao = null, bloom = null, smaaPass = null, mainPass = null;

  try {
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    const effects = [];
    if (quality.ao === 'gtao') {
      try {
        gtao = new GTAOAdapter(scene, camera, { samples: quality.name === 'ultra' ? 16 : 8, radius: 1.1, intensity: 0.9 });
        composer.addPass(gtao);
      } catch (e) { console.warn('[pipeline] GTAO disabled', e); gtao = null; }
    } else if (quality.ao) {
      try { ao = new AOEffect(); effects.push(ao); } catch (e) { console.warn('[pipeline] AO disabled', e); }
    }
    if (quality.bloom) {
      bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.35, luminanceSmoothing: 0.35, intensity: 0.85, radius: 0.72, levels: 7 });
      effects.push(bloom);
    }
    const ink = quality.ink ?? (quality.name === 'low' ? 0.0 : 0.2);   // subtle depth ink: PBR world, crisp silhouettes
    grade = new GradeEffect(THREE, ink);
    effects.push(grade);
    mainPass = new EffectPass(camera, ...effects);
    composer.addPass(mainPass);
    if (quality.smaa) {
      try {
        smaaPass = new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH }));
        composer.addPass(smaaPass);
      } catch (e) { console.warn('[pipeline] SMAA disabled', e); }
    }
  } catch (e) {
    console.error('[pipeline] post stack failed, rendering direct', e);
    composer = null;
    renderer.toneMapping = THREE.AgXToneMapping;
  }

  const size = new THREE.Vector2();
  function syncView() {
    renderer.getDrawingBufferSize(size);
    setOutlineViewport(size.x, size.y, camera.fov);
    if (ao) {
      ao.uniforms.get('uTanHalfFov').value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      ao.uniforms.get('uAspect').value = camera.aspect;
    }
  }

  // Render-owner debug views (?view=r_sky etc.; unknown to layout.VIEWS so nothing else reacts).
  const RVIEWS = {
    r_sky: { pos: [0, 45, 40], target: [120, 70, -60], fov: 60 },
    r_sun: { pos: [0, 45, 40], target: [140, 120, 160], fov: 60 },
    r_river: { pos: [-75, 16, 30], target: [-100, 4, -20], fov: 55 },
    r_lake: { pos: [110, 32, -160], target: [170, 11, -240], fov: 55 },
    r_water: { pos: [-103, 6.5, 48], target: [-98, 9, 3], fov: 55 },
    r_test: { pos: [-9, 25.2, 11], target: [0, 23.2, 0], fov: 50 },
    r_testback: { pos: [9, 25.2, -11], target: [0, 23.2, 0], fov: 50 },
  };
  const rv = RVIEWS[ctx.params.get('view')];
  if (rv && ctx.params.get('view').startsWith('r_test')) {
    ctx.pending.push(import('./showcase.js').then((m) => m.buildShowcase(ctx)).catch((e) => console.warn('[pipeline] showcase', e)));
  }

  // ── Depth precision ────────────────────────────────────────────────────────────────────────────
  // z-buffer resolution is ∝ 1/near. Gameplay keeps a tight near plane (camera hugs walls); the locked
  // aerial / vista cameras sit tens of metres above everything, so the near plane is pushed out there and
  // far-away coplanar-ish layers (paving, inlays, roof trims) keep millimetre precision instead of shimmering.
  let nearCur = camera.near;
  function syncNear() {
    let want = 0.2;
    if (ctx.cameraLocked || rv) {
      const h = camera.position.y - heightAt(camera.position.x, camera.position.z);
      want = h > 45 ? 2.5 : h > 22 ? 1.2 : h > 10 ? 0.5 : 0.2;
    }
    if (want === nearCur) return;
    nearCur = want;
    camera.near = want;
    camera.updateProjectionMatrix();
    for (const p of [mainPass, smaaPass]) if (p) p.mainCamera = camera;   // depth-reading effects re-read near/far
  }

  // ── Auto quality governor (only when the preset was chosen automatically) ───────────────────────
  // Holds ~60 fps by trading resolution first (cheapest, invisible on high-DPR phones), then post passes,
  // then sun shadows. Resolution recovers when there is headroom; dropped passes stay off for the session.
  const gov = { on: !!quality.auto && !ctx.shot, base: renderer.getPixelRatio(), scale: 1, stage: 0, t0: 0, frames: 0, skip: 3, good: 0 };
  function applyScale() {
    renderer.setPixelRatio(gov.base * gov.scale);
    renderer.setSize(innerWidth, innerHeight);
    composer?.setSize(innerWidth, innerHeight);
  }
  function dropStage() {
    gov.stage++;
    if (gov.stage === 1 && smaaPass && smaaPass.enabled) {
      smaaPass.enabled = false; smaaPass.renderToScreen = false;
      if (mainPass) mainPass.renderToScreen = true;
      return true;
    }
    if (gov.stage <= 2 && gtao && gtao.enabled) { gov.stage = 2; gtao.enabled = false; return true; }
    if (gov.stage <= 3) {
      gov.stage = 3;
      const lights = lighting?.csm ? lighting.csm.lights : (lighting?.sun ? [lighting.sun] : []);
      for (const l of lights) l.castShadow = false;
      return lights.length > 0;
    }
    return false;
  }
  function govern() {
    if (!gov.on || document.hidden) { gov.t0 = 0; return; }
    const now = performance.now();
    if (!gov.t0) { gov.t0 = now; gov.frames = 0; return; }
    gov.frames++;
    const el = now - gov.t0;
    if (el < 1200) return;
    const fps = gov.frames * 1000 / el;
    gov.t0 = now; gov.frames = 0;
    if (gov.skip > 0) { gov.skip--; return; }
    if (fps < 43) {
      gov.good = 0;
      const min = quality.minScale ?? 0.6;
      if (gov.scale > min + 0.01) { gov.scale = Math.max(min, gov.scale * (fps < 28 ? 0.75 : 0.87)); applyScale(); }
      else if (fps < 36) dropStage();
      gov.skip = 1;
    } else if (fps > 57 && gov.scale < 1) {
      if (++gov.good >= 4) { gov.good = 0; gov.scale = Math.min(1, gov.scale * 1.1); applyScale(); gov.skip = 1; }
    } else gov.good = 0;
    window.__AETHERIA_GOV = { fps, scale: gov.scale, stage: gov.stage };
  }

  function render(dt) {
    if (rv) {
      camera.fov = rv.fov; camera.updateProjectionMatrix();
      camera.position.set(...rv.pos); camera.lookAt(new THREE.Vector3(...rv.target));
    }
    syncNear();
    govern();
    try { lighting?.preRender?.(); } catch (e) { console.warn('[pipeline] preRender', e); }
    syncView();
    renderer.info.reset();
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
  }

  function resize(w, h) {
    composer?.setSize(w, h);
  }
  resize(innerWidth, innerHeight);

  return {
    composer, render, resize, grade, bloom, ao, gtao,
    /** Estimated MB held by post-process render targets (half-float input+output, depth, optional passes). */
    rtInfo() {
      if (!composer) return 0;
      const s = renderer.getDrawingBufferSize(new THREE.Vector2()); const px = s.x * s.y;
      let b = px * (8 * 2 + 4);
      if (bloom) b += px * 8 * 1.4;
      if (smaaPass) b += px * 4 * 3;
      if (gtao) b += px * 4 * 3;
      return b / 1048576;
    },
    get depthTexture() { return composer?.inputBuffer?.depthTexture || null; },
    setExposure(v) { grade?.uniforms.get('uExposure') && (grade.uniforms.get('uExposure').value = v); },
  };
}
