// AETHERIA — studio anime shading model (owner: render).
// EVERY world material is created here so the look can be upgraded globally. VRM characters keep MToon.
//
// ─── PUBLIC API ────────────────────────────────────────────────────────────────────────────────
// createToonMaterial(opts) -> THREE.MeshStandardMaterial (patched). Supports shadows (CSM), fog,
//   instancing (+instanceColor), batching, skinning, morphs, vertex colours, map/normal/alpha/ao/emissive maps.
//   opts (all optional):
//     kind        'ground'|'foliage'|'grass'|'stone'|'roof'|'wood'|'plaster'|'cloth'|'skin'|'hair'|'metal'|'water'|'glow'|'default'
//     color, map, normalMap, normalScale, alphaMap, aoMap, aoMapIntensity, emissive, emissiveMap,
//     emissiveIntensity, alphaTest, transparent, opacity, side, vertexColors, flatShading, depthWrite,
//     wireframe, fog (default true), name
//     Toon tuning (override the per-kind preset): termWidth (terminator softness, 0.02..0.4),
//     termOffset (shifts the light/shadow boundary), shadeTint (THREE.Color for the shadow side),
//     shadeTintAmount (0..1), rim (strength), rimWidth (0..1), spec (strength), specSize (0.8..0.999),
//     translucency (foliage/grass backlight), sphereBlend (0..1, foliage `sphereNormal` attribute weight),
//     upNormal (0..1, bend lighting normal to world-up — grass), shadowBias (extra world-space bias, metres),
//     litScale (multiplies sun), ambScale (multiplies sky ambient)
//     PBR: pbr (0 anime terminator .. 1 physically based), wrap (diffuse wrap), roughness, roughnessMap, metalness
//     outline     stored in material.userData.outline (informational; call createOutline yourself)
//   ── Shader hooks (for wind, dissolves, etc.) ──
//     uniforms        { name: {value} }  merged into the shader (keep the objects to animate them)
//     vertexPars      GLSL placed before main() in the vertex shader (uniforms / attributes / functions)
//     vertexHook      GLSL placed right after <begin_vertex>: edit `transformed` (object space). Available:
//                     `objectNormal`, `uTime` (seconds; declared for you if your hook uses it), `uAeTime` (same, always declared), `aeWorldPos(vec3 p)` -> world position of an
//                     object-space point (instancing/batching aware), `aeInstanceOrigin()` -> world origin of
//                     the object / instance (good wind phase seed).
//     fragmentPars    GLSL placed before main() in the fragment shader
//     fragmentHook    GLSL placed after <color_fragment>: edit `diffuseColor` (albedo) before lighting
//     fragmentHookPost GLSL placed before <opaque_fragment>: edit `outgoingLight` (final linear colour)
//     onBeforeCompile (shader, renderer) => void, chained AFTER the toon patch
//     cacheKey        extra string to separate shader programs (auto-derived from hooks if omitted)
//   Example (wind on foliage):
//     const m = createToonMaterial({ kind: 'foliage', map: leaves, alphaTest: 0.5, side: THREE.DoubleSide,
//       vertexHook: `vec3 o = aeInstanceOrigin(); transformed.x += sin(uTime*1.7 + o.x*0.3) * 0.08 * max(transformed.y, 0.0);` });
//     mesh.customDepthMaterial = createToonDepthMaterial(m); // shadows sway too (optional)
//
// createOutline(mesh, thickness = 0.02, color = 0x1a1420, opts = {}) -> Mesh | InstancedMesh | SkinnedMesh | null
//   Inverted-hull outline sharing the geometry (and instanceMatrix / skeleton). Width is ~constant in screen
//   space (thickness = world width at 4 m), thinned with distance. Add it next to the mesh (same parent,
//   after it) or as a child: it copies mesh.matrixWorld every frame. opts.category: 'character' (always) |
//   'world' (only when quality.outlines === 'all'; returns null otherwise). opts.smooth (default true) builds
//   averaged hull normals so hard-edged boxes get closed outlines.
//
// createToonDepthMaterial(material) -> MeshDepthMaterial carrying the same vertexHook (assign to mesh.customDepthMaterial)
// registerLitMaterial(material) -> give any foreign built-in lit material (MeshStandardMaterial…) cascaded shadows.
// toonUniforms -> shared uniforms { uTime, ... } (read-only for other modules).
// ────────────────────────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const toonUniforms = {
  uTime: { value: 0 },
  uSkyZenith: { value: new THREE.Color(0x2f7be0) },
  uSkyHorizon: { value: new THREE.Color(0xbfe2ff) },
};

// Shadow-side tint (#5C6A9C) normalised to unit luminance → pure hue shift, value handled by ambient.
const TINT = (() => {
  const c = new THREE.Color(0x5c6a9c);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return new THREE.Color(c.r / l, c.g / l, c.b / l);
})();
const WARM_TINT = new THREE.Color(1.35, 0.82, 0.86);   // skin: warm reddish shade (anime convention)

// Per-kind shading preset. `pbr` blends the anime terminator (0) into physically based shading (1): wrapped
// Lambert + GGX sun highlight + sky-gradient image-based specular, with real PCF penumbrae. World surfaces are
// fully PBR; characters keep a soft, slightly stylised falloff (wrap = cheap subsurface look on skin/cloth).
const KIND = {
  default: { termWidth: 0.07, termOffset: 0.0, tint: 0.35, rim: 0.06, rimWidth: 0.32, spec: 0.0, specSize: 0.97, trans: 0, sphere: 0, up: 0, bias: 0, lit: 1.0, amb: 1.0, pbr: 1.0, wrap: 0.08, rough: 0.8 },
  ground:  { termWidth: 0.16, termOffset: -0.1, tint: 0.35, rim: 0.0, rimWidth: 0.3, spec: 0.0, specSize: 0.97, trans: 0, sphere: 0, up: 0.25, bias: 0.0, lit: 1.0, amb: 1.0, pbr: 1.0, wrap: 0.12, rough: 0.95 },
  foliage: { termWidth: 0.22, termOffset: -0.12, tint: 0.40, rim: 0.2, rimWidth: 0.38, spec: 0.0, specSize: 0.97, trans: 0.55, sphere: 0.85, up: 0, bias: 0.35, lit: 1.0, amb: 1.05, pbr: 0.75, wrap: 0.45, rough: 0.62 },
  grass:   { termWidth: 0.25, termOffset: -0.2, tint: 0.35, rim: 0.0, rimWidth: 0.3, spec: 0.0, specSize: 0.97, trans: 0.35, sphere: 0, up: 0.8, bias: 0.25, lit: 1.0, amb: 1.0, pbr: 0.75, wrap: 0.4, rough: 0.7 },
  stone:   { termWidth: 0.06, termOffset: 0.0, tint: 0.38, rim: 0.0, rimWidth: 0.3, spec: 0.0, specSize: 0.96, trans: 0, sphere: 0, up: 0, bias: 0, lit: 1.0, amb: 1.0, pbr: 1.0, wrap: 0.06, rough: 0.82 },
  roof:    { termWidth: 0.05, termOffset: 0.0, tint: 0.32, rim: 0.0, rimWidth: 0.28, spec: 0.0, specSize: 0.985, trans: 0, sphere: 0, up: 0, bias: 0, lit: 1.0, amb: 0.95, pbr: 1.0, wrap: 0.06, rough: 0.58 },
  wood:    { termWidth: 0.06, termOffset: 0.0, tint: 0.35, rim: 0.0, rimWidth: 0.3, spec: 0.0, specSize: 0.97, trans: 0, sphere: 0, up: 0, bias: 0, lit: 1.0, amb: 1.0, pbr: 1.0, wrap: 0.06, rough: 0.72 },
  plaster: { termWidth: 0.08, termOffset: 0.0, tint: 0.40, rim: 0.0, rimWidth: 0.3, spec: 0.0, specSize: 0.97, trans: 0, sphere: 0, up: 0, bias: 0, lit: 1.0, amb: 1.08, pbr: 1.0, wrap: 0.08, rough: 0.9 },
  cloth:   { termWidth: 0.12, termOffset: -0.05, tint: 0.40, rim: 0.4, rimWidth: 0.4, spec: 0.0, specSize: 0.97, trans: 0.1, sphere: 0, up: 0, bias: 0.08, lit: 1.0, amb: 1.0, pbr: 0.7, wrap: 0.3, rough: 0.88 },
  skin:    { termWidth: 0.05, termOffset: -0.05, tint: 0.45, rim: 0.3, rimWidth: 0.3, spec: 0.0, specSize: 0.97, trans: 0, sphere: 0, up: 0, bias: 0.08, lit: 1.0, amb: 1.05, warm: true, pbr: 0.65, wrap: 0.4, rough: 0.55 },
  hair:    { termWidth: 0.05, termOffset: 0.0, tint: 0.40, rim: 0.35, rimWidth: 0.3, spec: 0.45, specSize: 0.95, trans: 0, sphere: 0, up: 0, bias: 0.08, lit: 1.0, amb: 1.0, pbr: 0.6, wrap: 0.3, rough: 0.5 },
  metal:   { termWidth: 0.04, termOffset: 0.05, tint: 0.30, rim: 0.2, rimWidth: 0.25, spec: 1.2, specSize: 0.975, trans: 0, sphere: 0, up: 0, bias: 0, lit: 0.85, amb: 0.8, pbr: 1.0, wrap: 0.0, rough: 0.35 },
  water:   { termWidth: 0.2, termOffset: 0.0, tint: 0.2, rim: 0.5, rimWidth: 0.4, spec: 2.5, specSize: 0.993, trans: 0, sphere: 0, up: 0, bias: 0, lit: 0.6, amb: 0.9, pbr: 1.0, wrap: 0.0, rough: 0.08 },
  glow:    { termWidth: 0.3, termOffset: 0.0, tint: 0.1, rim: 0.6, rimWidth: 0.5, spec: 0.0, specSize: 0.97, trans: 0, sphere: 0, up: 0, bias: 0, lit: 0.6, amb: 0.6, pbr: 0.0, wrap: 0.0, rough: 1.0 },
};

// ─── registry / CSM / quality ────────────────────────────────────────────────────────────────────
const registry = new Set();           // toon materials (weak lifetime is fine: few hundred max)
const foreign = new WeakSet();
let csm = null;
let quality = null;
let ctxRef = null;
let envMap = null, envIntensity = 1;

/** Called by environment.js once the HDRI is prefiltered: every toon material (past and future) samples the
 *  PMREM for diffuse irradiance and specular radiance instead of the analytic sky gradient. */
export function setEnvironment(texture, intensity = 1) {
  envMap = texture; envIntensity = intensity;
  for (const m of registry) applyEnv(m);
}
function applyEnv(m) {
  if (!envMap || m.userData.kind === 'glow' || m.envMap === envMap) return;
  m.envMap = envMap;
  m.envMapIntensity = envIntensity;
  m.needsUpdate = true;
}

/** Called by lighting.js once. */
export function initToon(ctx) {
  ctxRef = ctx;
  quality = ctx.quality;
  ctx.updaters.push((dt, t) => { toonUniforms.uTime.value = t; });
}

/** Called by lighting.js when CSM exists: every toon material (past and future) gets cascades. */
export function setCSM(instance) {
  csm = instance;
  for (const m of registry) applyCSM(m);
}

function applyCSM(m) {
  if (!csm || m.userData.__csm) return;
  m.userData.__csm = true;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey.call(m);
  csm.setupMaterial(m);                      // sets defines + overwrites onBeforeCompile
  const csmHook = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    csmHook.call(this, shader, renderer);
    prev.call(this, shader, renderer);
  };
  m.customProgramCacheKey = () => prevKey + '|csm' + csm.cascades;
  m.needsUpdate = true;
}

/** Foreign built-in lit materials (glTF MeshStandardMaterial etc.) → cascaded shadows. Safe to call repeatedly. */
export function registerLitMaterial(m) {
  if (!m || foreign.has(m) || m.userData?.toon) return;
  if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial)) return;
  foreign.add(m);
  if (csm) applyCSM(m);
}

// ─── shader code ─────────────────────────────────────────────────────────────────────────────────
const VERT_PARS = /* glsl */`
uniform float uAeTime;
uniform float uSphereBlend;
#ifdef TOON_SPHERE_NORMAL
attribute vec3 sphereNormal;
#endif
vec3 aeWorldPos( vec3 p ) {
  vec4 q = vec4( p, 1.0 );
  #ifdef USE_BATCHING
  q = getBatchingMatrix( getIndirectIndex( gl_DrawID ) ) * q;
  #endif
  #ifdef USE_INSTANCING
  q = instanceMatrix * q;
  #endif
  return ( modelMatrix * q ).xyz;
}
vec3 aeInstanceOrigin() { return aeWorldPos( vec3( 0.0 ) ); }
`;

const FRAG_PARS = /* glsl */`
uniform float uTermWidth;
uniform float uTermOffset;
uniform vec3 uShadeTint;
uniform float uRim;
uniform float uRimWidth;
uniform float uSpec;
uniform float uSpecSize;
uniform float uTrans;
uniform float uUpNormal;
uniform float uShadowBias;
uniform float uLitScale;
uniform float uAmbScale;
uniform float uPbr;
uniform float uWrap;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;

// slope: 0 facing the sun .. 1 grazing/back-facing → slope-scaled depth bias (no acne on the wrapped terminator)
float toonShadow( float slope ) {
  float s = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  if ( receiveShadow ) {
    DirectionalLightShadow tls;
    vec4 tsc;
    #if defined( USE_CSM ) && defined( CSM_CASCADES )
    float linearDepth = vViewPosition.z / ( shadowFar - cameraNear );
    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
      #if UNROLLED_LOOP_INDEX < CSM_CASCADES
      if ( linearDepth >= CSM_cascades[ i ].x && linearDepth < CSM_cascades[ i ].y ) {
        tls = directionalLightShadows[ i ];
        tsc = vDirectionalShadowCoord[ i ];
        tsc.z -= ( uShadowBias + 0.09 * slope ) * 0.0016 * tsc.w;
        s = getShadow( directionalShadowMap[ i ], tls.shadowMapSize, tls.shadowIntensity, tls.shadowBias, tls.shadowRadius, tsc );
      }
      #endif
    }
    #pragma unroll_loop_end
    s = mix( s, 1.0, smoothstep( 0.82, 1.0, linearDepth ) );
    #else
    tls = directionalLightShadows[ 0 ];
    tsc = vDirectionalShadowCoord[ 0 ];
    tsc.z -= ( uShadowBias + 0.09 * slope ) * 0.0016 * tsc.w;
    s = getShadow( directionalShadowMap[ 0 ], tls.shadowMapSize, tls.shadowIntensity, tls.shadowBias, tls.shadowRadius, tsc );
    #endif
  }
  #endif
  return s;
}
`;

// Replaces <lights_fragment_begin> + maps + end. Fills reflectedLight; AO map still applies afterwards.
const FRAG_LIGHT = /* glsl */`
{
  vec3 tN = normal;
  vec3 tV = normalize( vViewPosition );
  vec3 tUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  tN = normalize( mix( tN, tUp, uUpNormal ) );
  vec3 tL = tUp;
  vec3 tSun = vec3( 0.0 );
  #if NUM_DIR_LIGHTS > 0
  tL = directionalLights[ 0 ].direction;
  tSun = directionalLights[ 0 ].color;
  #endif
  float tNdL = dot( tN, tL );
  float tRaw = toonShadow( 1.0 - saturate( tNdL ) );
  float tSh = mix( smoothstep( 0.18, 0.82, tRaw ), tRaw, uPbr );
  float tLit = smoothstep( uTermOffset - uTermWidth, uTermOffset + uTermWidth, tNdL );
  tLit = mix( tLit, saturate( ( tNdL + uWrap ) / ( 1.0 + uWrap ) ), uPbr );
  float tLight = tLit * tSh;

  vec3 tAmb = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
  tAmb += getHemisphereLightIrradiance( hemisphereLights[ 0 ], tN );
  #endif
  tAmb *= uAmbScale;
  #ifdef USE_ENVMAP
  // HDRI irradiance (calibrated to the hemisphere light's level): directional, cloud-tinted sky fill
  tAmb = mix( tAmb, getIBLIrradiance( tN ) * uAmbScale, 0.85 );
  #endif

  vec3 tAlb = diffuseColor.rgb;
  // shadow side: sky ambient, tinted toward blue-violet; lit side keeps a little ambient untinted
  vec3 tTint = mix( uShadeTint, vec3( 1.0 ), max( tLight * 0.85, uPbr * 0.7 ) );
  tAlb *= 1.0 - metalnessFactor;
  reflectedLight.indirectDiffuse += tAlb * tAmb * tTint * RECIPROCAL_PI;
  // lit side: flat toon light with a whisper of lambert so big planes keep form (PBR kinds: plain Lambert)
  float tForm = mix( mix( 0.82, 1.0, saturate( tNdL * 1.4 ) ), 1.0, uPbr );
  reflectedLight.directDiffuse += tAlb * tSun * uLitScale * tLight * tForm * RECIPROCAL_PI;

  float tNdV = saturate( dot( tN, tV ) );
  vec3 tH = normalize( tL + tV );
  float tNdH = saturate( dot( tN, tH ) );

  #ifdef TOON_TRANSLUCENT
  {
    float back = pow( saturate( dot( tV, -tL ) ), 3.0 );
    float thin = 0.35 + 0.65 * ( 1.0 - tLit );
    reflectedLight.directDiffuse += tAlb * tSun * vec3( 1.05, 1.1, 0.7 ) * ( back * thin * uTrans * mix( 0.25, 1.0, tSh ) ) * RECIPROCAL_PI;
  }
  #endif

  // rim light (sun-side biased, dimmer in shadow)
  {
    float fres = 1.0 - tNdV;
    float rimM = smoothstep( 1.0 - uRimWidth, 1.0 - uRimWidth + 0.12, fres );
    vec3 tLs = normalize( tL - tV * dot( tL, tV ) );
    float side = saturate( 0.45 + 0.55 * dot( tN, tLs ) );
    vec3 rimCol = mix( tAmb * 0.9, tSun * 0.55, 0.5 ) * mix( tAlb, vec3( 1.0 ), 0.55 );
    reflectedLight.directSpecular += rimCol * rimM * side * uRim * mix( 0.35, 1.0, tSh ) * RECIPROCAL_PI;
  }

  #if defined( TOON_HAIR )
  {
    vec3 tT = normalize( tUp - tN * dot( tN, tUp ) );
    float tdh = dot( tT, tH );
    float band = sqrt( max( 0.0, 1.0 - tdh * tdh ) );
    float jitter = sin( vViewPosition.x * 40.0 + vViewPosition.y * 13.0 ) * 0.01;
    float hs = smoothstep( uSpecSize - 0.015, uSpecSize + 0.01, band + jitter );
    reflectedLight.directSpecular += tSun * mix( tAlb, vec3( 1.0 ), 0.6 ) * hs * uSpec * tSh * RECIPROCAL_PI;
  }
  #elif defined( TOON_METAL )
  {
    float hs = smoothstep( uSpecSize - 0.01, uSpecSize + 0.004, tNdH );
    reflectedLight.directSpecular += tSun * mix( tAlb, vec3( 1.0 ), 0.35 ) * hs * uSpec * tSh * RECIPROCAL_PI * 3.0;
    vec3 tR = reflect( -tV, tN );
    float ry = ( vec4( tR, 0.0 ) * viewMatrix ).y;
    #ifdef USE_ENVMAP
    reflectedLight.indirectSpecular += getIBLRadiance( tV, tN, clamp( roughnessFactor, 0.12, 1.0 ) ) * tAlb * 1.1;
    #else
    vec3 env = mix( uSkyHorizon * 0.55, uSkyZenith, smoothstep( -0.1, 0.7, ry ) );
    env = mix( vec3( 0.32, 0.27, 0.24 ) * 0.4, env, smoothstep( -0.25, 0.05, ry ) );
    reflectedLight.indirectSpecular += env * tAlb * 0.9;
    float band = smoothstep( 0.0, 0.08, ry ) - smoothstep( 0.08, 0.2, ry );
    reflectedLight.indirectSpecular += uSkyHorizon * tAlb * band * 0.5;
    #endif
  }
  #else
  if ( uSpec > 0.0 ) {
    float hs = smoothstep( uSpecSize - 0.006, uSpecSize + 0.004, tNdH );
    reflectedLight.directSpecular += tSun * hs * uSpec * tSh * RECIPROCAL_PI;
  }
  #if defined( TOON_PBR_SPEC ) && ! defined( TOON_WATER )
  {
    // GGX sun highlight (Karis' mobile visibility approximation) + analytic sky IBL for the specular lobe
    float tRough = clamp( roughnessFactor, 0.08, 1.0 );
    float tA = tRough * tRough;
    float tA2 = tA * tA;
    float tDen = tNdH * tNdH * ( tA2 - 1.0 ) + 1.0;
    float tD = tA2 / ( PI * tDen * tDen );
    float tLdH = saturate( dot( tL, tH ) );
    float tVis = 0.25 / ( max( 0.1, tLdH * tLdH ) * ( tRough + 0.5 ) );
    vec3 tF0 = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
    vec3 tF = tF0 + ( 1.0 - tF0 ) * pow( 1.0 - tLdH, 5.0 );
    reflectedLight.directSpecular += tSun * tF * ( min( tD * tVis, 8.0 ) * saturate( tNdL ) * tSh * uPbr );
    vec3 tR = reflect( -tV, tN );
    float ry = ( vec4( tR, 0.0 ) * viewMatrix ).y;
    #ifdef USE_ENVMAP
    vec3 tEnv = getIBLRadiance( tV, tN, tRough );
    #else
    vec3 tEnv = mix( uSkyHorizon, uSkyZenith, smoothstep( 0.0, 0.75, ry ) );
    tEnv = mix( tAmb * 0.32, tEnv, smoothstep( -0.2 - tRough * 0.5, 0.1 + tRough * 0.5, ry ) );
    tEnv = mix( tEnv, tAmb * 0.6, tRough * tRough );
    #endif
    vec3 tFe = tF0 + ( max( vec3( 1.0 - tRough ), tF0 ) - tF0 ) * pow( 1.0 - tNdV, 5.0 );
    // horizon / self-shadow occlusion: surfaces in sun shadow reflect less open sky
    reflectedLight.indirectSpecular += tEnv * tFe * ( uPbr * mix( 0.45, 1.0, tSh ) );
  }
  #endif
  #endif

  #ifdef TOON_WATER
  {
    vec3 tR = reflect( -tV, tN );
    float ry = ( vec4( tR, 0.0 ) * viewMatrix ).y;
    vec3 env = mix( uSkyHorizon, uSkyZenith, smoothstep( 0.0, 0.6, ry ) );
    #ifdef USE_ENVMAP
    env = getIBLRadiance( tV, tN, 0.1 );
    #endif
    float f = 0.04 + 0.96 * pow( 1.0 - tNdV, 5.0 );
    reflectedLight.indirectSpecular += env * f * 1.2;
  }
  #endif
}
`;

function toKindDefines(kind) {
  const d = { TOON: '' };
  d['TOON_' + kind.toUpperCase()] = '';
  if (kind === 'foliage' || kind === 'grass' || kind === 'cloth') d.TOON_TRANSLUCENT = '';
  if (kind === 'foliage') d.TOON_SPHERE_NORMAL = '';
  if (!quality || quality.pbrSpecular !== false) d.TOON_PBR_SPEC = '';
  return d;
}

/** Studio anime material factory. See header for options. */
export function createToonMaterial(opts = {}) {
  const kind = KIND[opts.kind] ? opts.kind : 'default';
  const P = KIND[kind];
  const params = {
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? P.rough, metalness: opts.metalness ?? 0,
    roughnessMap: opts.roughnessMap ?? null,
    map: opts.map ?? null,
    normalMap: opts.normalMap ?? null,
    alphaMap: opts.alphaMap ?? null,
    aoMap: opts.aoMap ?? null,
    aoMapIntensity: opts.aoMapIntensity ?? 1,
    emissiveMap: opts.emissiveMap ?? null,
    alphaTest: opts.alphaTest ?? 0,
    transparent: opts.transparent ?? (kind === 'water'),
    opacity: opts.opacity ?? (kind === 'water' ? 0.8 : 1),
    side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors ?? false,
    flatShading: opts.flatShading ?? false,
    fog: opts.fog ?? true,
    wireframe: opts.wireframe ?? false,
  };
  if (opts.depthWrite !== undefined) params.depthWrite = opts.depthWrite;
  if (opts.normalScale !== undefined) params.normalScale = typeof opts.normalScale === 'number' ? new THREE.Vector2(opts.normalScale, opts.normalScale) : opts.normalScale;
  if (kind === 'glow') {
    params.emissive = opts.emissive ?? opts.color ?? 0x7ff5ff;
    params.emissiveIntensity = opts.emissiveIntensity ?? 3.0;
  } else {
    params.emissive = opts.emissive ?? 0x000000;
    params.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  const m = new THREE.MeshStandardMaterial(params);
  if (opts.name) m.name = opts.name;
  m.userData.kind = kind;
  m.userData.toon = true;
  m.userData.outline = !!opts.outline;
  m.defines = { ...(m.defines || {}), ...toKindDefines(kind) };
  if (kind === 'foliage') m.defaultAttributeValues = { sphereNormal: [0, 0, 0] };

  const shadeTint = opts.shadeTint ? new THREE.Color(opts.shadeTint) : (P.warm ? WARM_TINT.clone() : TINT.clone());
  const tintAmt = opts.shadeTintAmount ?? P.tint;
  const tintColor = new THREE.Color(1, 1, 1).lerp(shadeTint, tintAmt);
  const U = {
    uAeTime: toonUniforms.uTime,
    uTime: toonUniforms.uTime,
    uSkyZenith: toonUniforms.uSkyZenith,
    uSkyHorizon: toonUniforms.uSkyHorizon,
    uTermWidth: { value: opts.termWidth ?? P.termWidth },
    uTermOffset: { value: opts.termOffset ?? P.termOffset },
    uShadeTint: { value: tintColor },
    uRim: { value: opts.rim ?? P.rim },
    uRimWidth: { value: opts.rimWidth ?? P.rimWidth },
    uSpec: { value: opts.spec ?? P.spec },
    uSpecSize: { value: opts.specSize ?? P.specSize },
    uTrans: { value: opts.translucency ?? P.trans },
    uSphereBlend: { value: opts.sphereBlend ?? P.sphere },
    uUpNormal: { value: opts.upNormal ?? P.up },
    uShadowBias: { value: opts.shadowBias ?? P.bias },
    uLitScale: { value: opts.litScale ?? P.lit },
    uAmbScale: { value: opts.ambScale ?? P.amb },
    uPbr: { value: opts.pbr ?? P.pbr },
    uWrap: { value: opts.wrap ?? P.wrap },
    ...(opts.uniforms || {}),
  };
  m.userData.toonUniforms = U;

  const hooks = {
    vp: opts.vertexPars || '', vh: opts.vertexHook || '',
    fp: opts.fragmentPars || '', fh: opts.fragmentHook || '', fhp: opts.fragmentHookPost || '',
  };
  // `uTime` is declared only on demand (other modules inject their own `uniform float uTime;`)
  const declares = (src) => /uniform\s+float\s+uTime\s*;/.test(src);
  if (/\buTime\b/.test(hooks.vh) && !declares(hooks.vp)) hooks.vp = 'uniform float uTime;\n' + hooks.vp;
  if (/\buTime\b/.test(hooks.fh + hooks.fhp) && !declares(hooks.fp)) hooks.fp = 'uniform float uTime;\n' + hooks.fp;
  const userOBC = opts.onBeforeCompile;
  const key = 'toon3|' + (quality && quality.pbrSpecular === false ? 'lq|' : '') + kind + '|' + (opts.cacheKey ?? (hooks.vp + hooks.vh + hooks.fp + hooks.fh + hooks.fhp + (userOBC ? userOBC.toString() : '')));

  const patch = (shader, renderer) => {
    Object.assign(shader.uniforms, U);
    let vs = shader.vertexShader;
    vs = vs.replace('void main() {', VERT_PARS + hooks.vp + '\nvoid main() {');
    vs = vs.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
#ifdef TOON_SPHERE_NORMAL
  if ( dot( sphereNormal, sphereNormal ) > 0.01 ) objectNormal = normalize( mix( objectNormal, normalize( sphereNormal ), uSphereBlend ) );
#endif`);
    vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + hooks.vh);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + FRAG_PARS + hooks.fp);
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + hooks.fh);
    fs = fs.replace('#include <lights_fragment_begin>', FRAG_LIGHT);
    fs = fs.replace('#include <lights_fragment_maps>', '');
    fs = fs.replace('#include <lights_fragment_end>', '');
    fs = fs.replace('#include <opaque_fragment>', hooks.fhp + '\n#include <opaque_fragment>');
    shader.fragmentShader = fs;
    if (userOBC) userOBC(shader, renderer);
  };
  m.onBeforeCompile = patch;
  m.userData.toonPatch = patch;
  m.customProgramCacheKey = () => key;
  registry.add(m);
  if (csm) applyCSM(m);
  applyEnv(m);
  m.addEventListener('dispose', () => registry.delete(m));
  return m;
}

/** Depth material for shadows that carries a toon material's vertexHook (assign to mesh.customDepthMaterial). */
export function createToonDepthMaterial(material) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaMap: material.alphaMap, alphaTest: material.alphaTest, side: material.side });
  const U = material.userData.toonUniforms || {};
  const src = material.userData.toonPatch || (() => {});
  d.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    // reuse the vertex patch by running the toon hook on a proxy and copying its vertex shader body edits
    const proxy = { uniforms: shader.uniforms, vertexShader: shader.vertexShader, fragmentShader: 'void main() {}' };
    try { src(proxy); shader.vertexShader = proxy.vertexShader; } catch (e) { console.warn('[toon] depth hook', e); }
  };
  d.customProgramCacheKey = () => 'toondepth|' + material.customProgramCacheKey();
  return d;
}

// ─── outlines ────────────────────────────────────────────────────────────────────────────────────
const outlineRes = { value: new THREE.Vector2(1280, 720) };
const outlineFov = { value: 1.0 };
export function setOutlineViewport(w, h, fovDeg) {
  outlineRes.value.set(w, h);
  outlineFov.value = Math.tan(THREE.MathUtils.degToRad(fovDeg) * 0.5);
}

function buildSmoothNormals(geometry) {
  if (geometry.attributes.outlineNormal) return;
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  if (!pos || !nor || pos.count > 200000) return;
  const map = new Map();
  const q = (v) => Math.round(v * 1000);
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
    keys[i] = k;
    let a = map.get(k);
    if (!a) { a = [0, 0, 0]; map.set(k, a); }
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}

const outlineMats = new Map();
function outlineMaterial(color, thickness, smooth) {
  const k = color + '|' + thickness + '|' + smooth;
  if (outlineMats.has(k)) return outlineMats.get(k);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: true });
  const uThick = { value: thickness };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOutlineThick = uThick;
    shader.uniforms.uOutlineRes = outlineRes;
    shader.uniforms.uOutlineFov = outlineFov;
    let vs = shader.vertexShader;
    vs = vs.replace('void main() {', `uniform float uOutlineThick; uniform vec2 uOutlineRes; uniform float uOutlineFov;
${smooth ? 'attribute vec3 outlineNormal;' : ''}
void main() {`);
    // MeshBasic only builds normals with skinning/envmap: build our own view-space normal (skin + instance aware)
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
{
  vec3 oN = ${smooth ? '( dot( outlineNormal, outlineNormal ) > 0.01 ? outlineNormal : normal )' : 'normal'};
  #ifdef USE_SKINNING
    mat4 oSkin = mat4( 0.0 );
    oSkin += skinWeight.x * boneMatX; oSkin += skinWeight.y * boneMatY;
    oSkin += skinWeight.z * boneMatZ; oSkin += skinWeight.w * boneMatW;
    oSkin = bindMatrixInverse * oSkin * bindMatrix;
    oN = ( oSkin * vec4( oN, 0.0 ) ).xyz;
  #endif
  #ifdef USE_BATCHING
    oN = mat3( batchingMatrix ) * oN;
  #endif
  #ifdef USE_INSTANCING
    oN = mat3( instanceMatrix ) * oN;
  #endif
  vec3 vN = normalize( mat3( modelViewMatrix ) * oN );
  vec4 cN = projectionMatrix * vec4( vN, 0.0 );
  vec2 dir = cN.xy; float dl = length( dir ); dir = dl > 1e-5 ? dir / dl : vec2( 0.0 );
  // world thickness at 4 m → pixels; constant on screen up close, thinning with distance
  float px = uOutlineThick * uOutlineRes.y / ( 2.0 * uOutlineFov * 4.0 );
  float w = gl_Position.w;
  px *= clamp( 4.0 * 3.0 / max( w, 0.01 ), 0.25, 1.0 ) ;
  px = clamp( px, 0.0, 6.0 );
  gl_Position.xy += dir * px * 2.0 / uOutlineRes * w;
  gl_Position.z += 0.00002 * w;
}`);
    shader.vertexShader = vs;
  };
  m.customProgramCacheKey = () => 'aeoutline|' + smooth;
  outlineMats.set(k, m);
  return m;
}

/** Inverted-hull outline. See header. */
export function createOutline(mesh, thickness = 0.02, color = 0x1a1420, opts = {}) {
  try {
    if (!mesh || !mesh.geometry) return null;
    if (opts.category === 'world' && quality && quality.outlines !== 'all') return null;
    const smooth = opts.smooth !== false && !mesh.isSkinnedMesh;
    if (smooth) buildSmoothNormals(mesh.geometry);
    const mat = outlineMaterial(color, thickness, smooth && !!mesh.geometry.attributes.outlineNormal);
    let o;
    if (mesh.isInstancedMesh) {
      o = new THREE.InstancedMesh(mesh.geometry, mat, mesh.count);
      o.instanceMatrix = mesh.instanceMatrix;
      o.onBeforeRender = () => { o.count = mesh.count; };
    } else if (mesh.isSkinnedMesh) {
      o = new THREE.SkinnedMesh(mesh.geometry, mat);
      o.bindMode = mesh.bindMode;
      o.bind(mesh.skeleton, mesh.bindMatrix);
    } else {
      o = new THREE.Mesh(mesh.geometry, mat);
    }
    o.name = (mesh.name || 'mesh') + '_outline';
    o.castShadow = false; o.receiveShadow = false;
    o.matrixAutoUpdate = false;
    o.frustumCulled = mesh.frustumCulled;
    o.userData.isOutline = true;
    const self = o;
    o.updateMatrixWorld = function (force) {
      mesh.updateWorldMatrix?.(false, false);
      self.matrixWorld.copy(mesh.matrixWorld);
      self.visible = mesh.visible;
      for (const c of self.children) c.updateMatrixWorld(force);
    };
    o.updateWorldMatrix = function () { self.matrixWorld.copy(mesh.matrixWorld); };
    if (mesh.isInstancedMesh) {
      o.computeBoundingSphere = () => { mesh.computeBoundingSphere?.(); o.boundingSphere = mesh.boundingSphere; };
    }
    return o;
  } catch (e) {
    console.warn('[toon] createOutline failed', e);
    return null;
  }
}
