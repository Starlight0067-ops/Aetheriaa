// AETHERIA — stylized river + lake (owner: render).
// Meshes exist only where water is: a ribbon along RIVER (smoothed centre line) at WORLD.waterLevel and a
// disc for POI.lake at POI.lake.y. Water depth is analytic (surface − heightAt) baked per vertex, so the
// depth colour and shoreline foam line up with the terrain without a depth pre-pass.
// Full: two scrolling wave layers, flow streaks along the river, foam bands, sky reflection (shared sky
// function), sun glint + sparkles (HDR → bloom). Simple (quality.waterQuality === 'simple'): one wave layer,
// no sparkles/streaks.
import { WORLD, POI, RIVER, RIVER_HALF_WIDTH, heightAt } from '../core/layout.js';
import { SKY_GLSL, makeNoiseTexture } from '../render/sky.js';
import { toonUniforms } from '../render/toon.js';

function buildRiver(THREE) {
  const pts = RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const rows = Math.ceil(len / 2.5);
  const cols = 26;
  const halfW = RIVER_HALF_WIDTH + 19;
  const y = WORLD.waterLevel;
  const pos = [], depth = [], flow = [], dir = [], idx = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const u = r / rows;
    curve.getPointAt(u, p); curve.getTangentAt(u, t);
    t.y = 0; t.normalize();
    const nx = -t.z, nz = t.x;
    for (let c = 0; c <= cols; c++) {
      const v = c / cols * 2 - 1;
      const x = p.x + nx * v * halfW, z = p.z + nz * v * halfW;
      pos.push(x, y, z);
      depth.push(y - heightAt(x, z));
      flow.push(u * len, v * halfW);
      dir.push(t.x, t.z);
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + cols + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function buildLake(THREE) {
  const { x: cx, z: cz, r, y } = POI.lake;
  const R = r + 22, rings = Math.ceil(R / 2.5), segs = 120;
  const pos = [cx, y, cz], depth = [y - heightAt(cx, cz)], flow = [0, 0], dir = [1, 0], idx = [];
  for (let i = 1; i <= rings; i++) {
    const rr = (i / rings) * R;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      pos.push(x, y, z); depth.push(y - heightAt(x, z));
      flow.push(x, z); dir.push(0, 0);
    }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let i = 1; i < rings; i++) {
    const o0 = 1 + (i - 1) * segs, o1 = 1 + i * segs;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      idx.push(o0 + s, o0 + s1, o1 + s, o0 + s1, o1 + s1, o1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const VERT = /* glsl */`
attribute float aDepth; attribute vec2 aFlow; attribute vec2 aDir;
varying float vDepth; varying vec2 vFlow; varying vec2 vDir; varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vDepth = aDepth; vFlow = aFlow; vDir = aDir;
  vec4 wp = modelMatrix * vec4( position, 1.0 );
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
${SKY_GLSL}
uniform float uTime; uniform sampler2D uNoise; uniform vec3 uSunColor;
uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uFoam; uniform float uRiver;
varying float vDepth; varying vec2 vFlow; varying vec2 vDir; varying vec3 vWorld;
#include <fog_pars_fragment>

float wh( vec2 p ) { return texture2D( uNoise, p ).r; }
void main() {
  float d = max( vDepth, 0.0 );
  vec3 V = normalize( cameraPosition - vWorld );
  float dist = length( cameraPosition - vWorld );
  // flow frame
  vec2 T = uRiver > 0.5 ? normalize( vDir + 1e-5 ) : vec2( 1.0, 0.0 );
  vec2 B = vec2( -T.y, T.x );
  vec2 q = uRiver > 0.5 ? vFlow : vFlow;   // river: (along, across) metres; lake: world xz
  float speed = uRiver > 0.5 ? 0.9 : 0.12;

  // waves: height field gradient from scrolling noise layers (in flow space)
  vec2 p1 = vec2( q.x * 0.045 - uTime * speed * 0.045, q.y * 0.07 );
  float e = 0.006;
  float h0 = wh( p1 ), hx = wh( p1 + vec2( e, 0.0 ) ), hy = wh( p1 + vec2( 0.0, e ) );
  vec2 grad = vec2( hx - h0, hy - h0 ) / e * vec2( 0.045, 0.07 );
  #ifdef WATER_FULL
  vec2 p2 = vec2( q.x * 0.11 - uTime * speed * 0.13, q.y * 0.13 + uTime * 0.02 ) + 0.37;
  float g0 = texture2D( uNoise, p2 ).g, gx = texture2D( uNoise, p2 + vec2( e, 0.0 ) ).g, gy = texture2D( uNoise, p2 + vec2( 0.0, e ) ).g;
  grad += vec2( gx - g0, gy - g0 ) / e * vec2( 0.11, 0.13 ) * 0.6;
  #endif
  float waveAmp = 0.55 * ( 1.0 - smoothstep( 40.0, 220.0, dist ) * 0.7 );
  vec2 gw = ( grad.x * T + grad.y * B ) * waveAmp;
  vec3 N = normalize( vec3( -gw.x, 1.0, -gw.y ) );
  float NdV = clamp( dot( N, V ), 0.0, 1.0 );

  // body colour: depth + viewing path length
  float path = d * ( 1.0 + ( 1.0 - clamp( V.y, 0.0, 1.0 ) ) * 1.8 );
  vec3 body = mix( uShallow, uMid, smoothstep( 0.0, 1.6, path ) );
  body = mix( body, uDeep, smoothstep( 1.2, 6.0, path ) );
  body *= 0.85 + 0.25 * clamp( dot( N, uSunDir ), 0.0, 1.0 );

  // sky reflection (stylized fresnel)
  vec3 R = reflect( -V, N );
  R.y = max( R.y, 0.02 );
  vec3 refl = aeSky( normalize( R ) );
  float F = 0.06 + 0.94 * pow( 1.0 - NdV, 4.0 );
  vec3 col = mix( body, refl, clamp( F * 0.9, 0.0, 1.0 ) );

  // sun glint (toon-crisp) + sparkles
  float rs = max( dot( normalize( R ), uSunDir ), 0.0 );
  col += uSunColor * smoothstep( 0.9965, 0.9985, rs ) * 4.0;
  col += uSunColor * pow( rs, 60.0 ) * 0.35;
  #ifdef WATER_FULL
  {
    vec2 sp = vWorld.xz * 0.55;
    float s1 = texture2D( uNoise, sp + vec2( uTime * 0.05, 0.0 ) ).r;
    float s2 = texture2D( uNoise, sp * 1.37 - vec2( 0.0, uTime * 0.06 ) ).g;
    float spark = smoothstep( 0.66, 0.70, s1 * s2 * 1.55 );
    float glow = pow( rs, 6.0 ) * 0.9 + pow( 1.0 - NdV, 3.0 ) * 0.15;
    col += uSunColor * spark * glow * 6.0 * ( 1.0 - smoothstep( 60.0, 250.0, dist ) );
    // flow streaks drifting downstream
    if ( uRiver > 0.5 ) {
      float st = texture2D( uNoise, vec2( q.x * 0.012 - uTime * 0.045, q.y * 0.09 ) ).r;
      float streak = smoothstep( 0.66, 0.72, st ) * smoothstep( 0.4, 1.5, d ) * 0.22;
      col = mix( col, uFoam, streak * ( 1.0 - smoothstep( 80.0, 200.0, dist ) ) );
    }
  }
  #endif

  // shoreline foam: solid lip + animated bands rolling to the bank
  float n = texture2D( uNoise, vWorld.xz * 0.06 + uTime * 0.01 ).g;
  float band = sin( d * 10.0 - uTime * 2.2 + n * 9.0 ) * 0.5 + 0.5;
  float aa = fwidth( d ) * 2.0 + 0.01;
  float lip = 1.0 - smoothstep( 0.12 + n * 0.12, 0.12 + n * 0.12 + aa, d );
  float bands = smoothstep( 0.72, 0.72 + aa * 6.0, band ) * ( 1.0 - smoothstep( 0.25, 0.85, d ) );
  float foam = max( lip, bands * 0.85 );
  col = mix( col, uFoam * ( 0.92 + 0.12 * dot( uSunDir, vec3( 0.0, 1.0, 0.0 ) ) ), foam );

  float alpha = mix( 0.42, 0.96, smoothstep( 0.0, 2.2, d ) );
  alpha = max( alpha, F * 0.9 );
  alpha = max( alpha, foam );
  gl_FragColor = vec4( col, alpha );
  #include <fog_fragment>
}`;

export async function create(ctx) {
  const { THREE, scene, quality } = ctx;
  const full = quality.waterQuality !== 'simple';
  const sky = ctx.systems.sky;
  const lighting = ctx.systems.lighting;
  const noise = sky?.noise || makeNoiseTexture(THREE, 256);
  const sunDir = lighting?.sunDirection || new THREE.Vector3(0.5, 0.6, 0.6).normalize();
  const C = (h) => new THREE.Color(h);
  const skyU = sky?.skyUniforms || {
    uSkyZen: { value: C(0x1653c9) }, uSkyMid: { value: C(0x2f7be0) }, uSkyHor: { value: C(0x8cc8ff) },
    uSkyBand: { value: C(0xd2ebff) }, uSunGlow: { value: C(0xffe2b0) }, uSunDir: { value: sunDir },
  };
  const sunColor = (lighting?.sunColor ? lighting.sunColor.clone() : C(0xfff0dc)).multiplyScalar(1.0);

  const makeMat = (river) => new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uNoise: { value: null }, uSunColor: { value: sunColor }, uRiver: { value: river ? 1 : 0 },
      uShallow: { value: C(0x58d8c6) }, uMid: { value: C(0x2aa7c4) }, uDeep: { value: C(0x1a5aa6) }, uFoam: { value: C(0xf4fbff) },
    }]),
    vertexShader: VERT, fragmentShader: FRAG,
    defines: full ? { WATER_FULL: '' } : {},
    transparent: true, depthWrite: true, fog: true,
  });
  const meshes = [];
  const add = (geo, river) => {
    const m = makeMat(river);
    // shared, live uniforms (merge clones values)
    Object.assign(m.uniforms, skyU, { uTime: toonUniforms.uTime });
    m.uniforms.uNoise.value = noise;
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = river ? 'river' : 'lake';
    mesh.renderOrder = 1;
    mesh.receiveShadow = false; mesh.castShadow = false;
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  let river = null, lake = null;
  try { river = add(buildRiver(THREE), true); } catch (e) { console.error('[water] river failed', e); }
  try { lake = add(buildLake(THREE), false); } catch (e) { console.error('[water] lake failed', e); }
  return { mesh: river, river, lake, meshes };
}
