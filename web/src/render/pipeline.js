// AETHERIA — post stack (owner: render). pmndrs `postprocessing`:
//   RenderPass (HDR half-float) → EffectPass[ depth AO (high/ultra) · bloom (threshold: emissive + sun only) ·
//   grade (AgX "punchy" tone map, warm-highlight / cool-shadow split tone, saturation, depth ink lines,
//   vignette) ] → EffectPass[ SMAA ] (when enabled).
// API: { composer, render(dt), resize(w,h), depthTexture (getter), grade (uniform access), setExposure(v) }
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BlendFunction,
  BloomEffect, SMAAEffect, SMAAPreset,
} from 'postprocessing';
import { setOutlineViewport } from './toon.js';

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
        ['uSaturation', { value: 1.2 }],
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
  let composer = null, grade = null, ao = null, bloom = null, smaaPass = null;

  try {
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    const effects = [];
    if (quality.ao) {
      try { ao = new AOEffect(); effects.push(ao); } catch (e) { console.warn('[pipeline] AO disabled', e); }
    }
    if (quality.bloom) {
      bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.35, luminanceSmoothing: 0.35, intensity: 0.85, radius: 0.72, levels: 7 });
      effects.push(bloom);
    }
    const ink = quality.name === 'low' ? 0.0 : (quality.outlines === 'all' ? 0.75 : 0.5);
    grade = new GradeEffect(THREE, ink);
    effects.push(grade);
    composer.addPass(new EffectPass(camera, ...effects));
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
    r_test: { pos: [-9, 25.2, 11], target: [0, 23.2, 0], fov: 50 },
    r_testback: { pos: [9, 25.2, -11], target: [0, 23.2, 0], fov: 50 },
  };
  const rv = RVIEWS[ctx.params.get('view')];
  if (rv && ctx.params.get('view').startsWith('r_test')) {
    ctx.pending.push(import('./showcase.js').then((m) => m.buildShowcase(ctx)).catch((e) => console.warn('[pipeline] showcase', e)));
  }

  function render(dt) {
    if (rv) {
      camera.fov = rv.fov; camera.updateProjectionMatrix();
      camera.position.set(...rv.pos); camera.lookAt(new THREE.Vector3(...rv.target));
    }
    try { lighting?.preRender?.(); } catch (e) { console.warn('[pipeline] preRender', e); }
    syncView();
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
  }

  function resize(w, h) {
    composer?.setSize(w, h);
  }
  resize(innerWidth, innerHeight);

  return {
    composer, render, resize, grade, bloom, ao,
    get depthTexture() { return composer?.inputBuffer?.depthTexture || null; },
    setExposure(v) { grade?.uniforms.get('uExposure') && (grade.uniforms.get('uExposure').value = v); },
  };
}
