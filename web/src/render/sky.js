// AETHERIA — anime sky (owner: render): saturated gradient dome, sun disc + glow, high cirrus,
// stylized cumulus cards (procedural lobed normal atlas → per-lobe toon shading, sun-side rims),
// and global aerial perspective / height fog that matches the horizon colour.
// API: { dome, clouds, colors: {zenith, mid, horizon, band, fog, sunGlow}, skyGLSL, skyUniforms }
import { toonUniforms } from './toon.js';

// Shared GLSL: sky radiance for a world direction (used by the dome and by water reflections).
export const SKY_GLSL = /* glsl */`
uniform vec3 uSkyZen; uniform vec3 uSkyMid; uniform vec3 uSkyHor; uniform vec3 uSkyBand; uniform vec3 uSunGlow; uniform vec3 uSunDir;
vec3 aeSky( vec3 dir ) {
  float y = dir.y;
  float h = max( y, 0.0 );
  vec3 col = mix( uSkyHor, uSkyMid, smoothstep( 0.0, 0.32, h ) );
  col = mix( col, uSkyZen, smoothstep( 0.3, 0.95, h ) );
  col = mix( col, uSkyBand, ( 1.0 - smoothstep( 0.0, 0.085, abs( y ) ) ) * 0.7 );
  col = mix( col, uSkyBand * 0.92, smoothstep( 0.0, -0.25, y ) );
  float sd = max( dot( dir, uSunDir ), 0.0 );
  col += uSunGlow * ( pow( sd, 6.0 ) * 0.22 + pow( sd, 48.0 ) * 0.55 );
  col += uSunGlow * pow( sd, 2.5 ) * 0.12 * ( 1.0 - smoothstep( 0.0, 0.35, h ) );
  return col;
}`;

function makeNoiseTexture(THREE, size = 256) {
  // tileable value-noise FBM, two decorrelated channels
  const data = new Uint8Array(size * size * 4);
  const lattice = (n, seed) => {
    const g = new Float32Array(n * n);
    let s = seed;
    for (let i = 0; i < n * n; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
    return g;
  };
  const sample = (g, n, x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = g[((yi % n) * n + (xi % n))], b = g[((yi % n) * n + ((xi + 1) % n))];
    const c = g[(((yi + 1) % n) * n + (xi % n))], d = g[(((yi + 1) % n) * n + ((xi + 1) % n))];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const octs = [4, 8, 16, 32, 64].map((n, i) => ({ n, g: lattice(n, 1234 + i * 77) }));
  const octs2 = [4, 8, 16, 32, 64].map((n, i) => ({ n, g: lattice(n, 9876 + i * 131) }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, v2 = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < octs.length; o++) {
      const k = octs[o].n / size;
      v += sample(octs[o].g, octs[o].n, x * k, y * k) * amp;
      v2 += sample(octs2[o].g, octs2[o].n, x * k, y * k) * amp;
      tot += amp; amp *= 0.5;
    }
    const i = (y * size + x) * 4;
    data[i] = (v / tot) * 255; data[i + 1] = (v2 / tot) * 255; data[i + 2] = 0; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
export { makeNoiseTexture };

// Cumulus atlas: 2 x 4 cells of 512x256. Each cloud is a z-buffered cluster of sphere "lobes"; we store the
// lobe normal (RG), lobe depth (B) and coverage (A). The shader lights each lobe with the true sun direction.
function makeCloudAtlas(THREE) {
  const W = 1024, H = 1024, CW = 512, CH = 256;
  const nrm = new Uint8Array(W * H * 4);
  const zbuf = new Float32Array(W * H).fill(-1e9);
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const lobe = (ox, oy, cx, cy, r, z, baseY) => {
    const x0 = Math.max(0, Math.floor(cx - r - 2)), x1 = Math.min(CW - 1, Math.ceil(cx + r + 2));
    const y0 = Math.max(0, Math.floor(cy - r - 2)), y1 = Math.min(CH - 1, Math.ceil(cy + r + 2));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r;
      const d2 = dx * dx + dy * dy;
      const dist = Math.sqrt(d2) * r;
      const cov = Math.min(1, Math.max(0, r - dist + 0.5));
      if (cov <= 0) continue;
      // flat-ish cloud base: fade out under the base line
      const below = (y + 0.5) - baseY;
      const baseCov = below > 0 ? Math.max(0, 1 - below / 2.0) : 1;
      const c = cov * baseCov;
      if (c <= 0) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
      const depth = z * 80 + nz * r;
      const gi = ((oy + y) * W + (ox + x));
      const i = gi * 4;
      const prevA = nrm[i + 3] / 255;
      if (depth > zbuf[gi]) {
        zbuf[gi] = depth;
        let nx = dx, ny = -dy;               // canvas y down → up
        if (below > -r * 0.25) ny = Math.min(ny, -0.2 - 0.6 * Math.max(0, below + r * 0.25) / (r * 0.25 + 1)); // bottoms face down
        const l = Math.hypot(nx, ny, nz) || 1;
        nrm[i] = (nx / l * 0.5 + 0.5) * 255;
        nrm[i + 1] = (ny / l * 0.5 + 0.5) * 255;
        nrm[i + 2] = Math.min(1, z) * 255;
        nrm[i + 3] = Math.max(prevA, c) * 255;
      } else if (c > prevA) {
        nrm[i + 3] = c * 255;
      }
    }
  };
  for (let cell = 0; cell < 8; cell++) {
    const ox = (cell % 2) * CW, oy = Math.floor(cell / 2) * CH;
    const baseY = CH * 0.82;
    const towers = 1 + Math.floor(rnd() * 3);
    const left = CW * (0.08 + rnd() * 0.08), right = CW * (0.92 - rnd() * 0.08);
    const bumps = [];
    for (let t = 0; t < towers; t++) bumps.push({ x: left + (right - left) * (0.2 + 0.6 * rnd()), h: CH * (0.3 + 0.38 * rnd()), w: CW * (0.1 + 0.12 * rnd()) });
    const height = (x) => {
      const edge = Math.min(1, Math.max(0, Math.min(x - left, right - x) / (CW * 0.08)));
      let h = CH * 0.14;
      for (const b of bumps) h += b.h * Math.exp(-((x - b.x) ** 2) / (b.w * b.w));
      return h * Math.sqrt(edge);
    };
    // interior fill (back)
    for (let i = 0; i < 70; i++) {
      const x = left + (right - left) * rnd();
      const hh = height(x);
      if (hh < 12) continue;
      const r = 16 + rnd() * 26;
      const y = baseY - Math.min(hh - r * 0.6, rnd() * hh);
      lobe(ox, oy, x, y, r, 0.15 + rnd() * 0.35, baseY);
    }
    // silhouette lobes along the top contour (front) → bold lobed outline
    let x = left + 6;
    while (x < right - 6) {
      const r = 14 + rnd() * 24;
      const hh = height(x);
      if (hh > 10) lobe(ox, oy, x, baseY - hh + r * 0.85, r, 0.5 + rnd() * 0.5, baseY);
      x += r * (0.75 + rnd() * 0.5);
    }
    // a few small detached puffs
    const puffs = Math.floor(rnd() * 3);
    for (let p = 0; p < puffs; p++) {
      const px = rnd() < 0.5 ? left - 10 - rnd() * 30 : right + 10 + rnd() * 30;
      const r = 6 + rnd() * 9;
      if (px > r + 2 && px < CW - r - 2) lobe(ox, oy, px, baseY - r * (1 + rnd() * 3), r, 0.9, baseY);
    }
  }
  const tex = new THREE.DataTexture(nrm, W, H, THREE.RGBAFormat);
  tex.flipY = false;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

function installFog(THREE, sunDir, glow, q) {
  const v = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  const d = sunDir;
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorldOffset;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorldOffset = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorldOffset;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  // exponential height fog (analytic integral along the view ray) + far-plane hide band + sun haze
  THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  {
    vec3 fRay = vFogWorldOffset;
    float fDist = length( fRay );
    vec3 fDir = fRay / max( fDist, 1e-4 );
    const float fK = ${q.falloff.toFixed(5)};
    float fCamH = max( cameraPosition.y - ${q.base.toFixed(2)}, -20.0 );
    float fDY = fRay.y;
    float fH = abs( fDY ) > 0.05 ? ( exp( -fK * fCamH ) - exp( -fK * ( fCamH + fDY ) ) ) / ( fK * fDY ) : exp( -fK * ( fCamH + fDY * 0.5 ) );
    float fOD = ${q.density.toFixed(6)} * max( fDist - ${q.start.toFixed(1)}, 0.0 ) * fH;
    float fogFactor = 1.0 - exp( -fOD );
    #ifdef FOG_EXP2
      fogFactor = max( fogFactor, 1.0 - exp( - fogDensity * fogDensity * fDist * fDist ) );
    #else
      fogFactor = max( fogFactor, smoothstep( fogNear, fogFar, fDist ) );
    #endif
    fogFactor = min( fogFactor, 1.0 );
    float fSd = max( dot( fDir, vec3( ${d.x.toFixed(4)}, ${d.y.toFixed(4)}, ${d.z.toFixed(4)} ) ), 0.0 );
    vec3 fCol = fogColor + ${v(glow)} * ( pow( fSd, 6.0 ) * 0.22 + pow( fSd, 2.5 ) * 0.12 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fCol, fogFactor );
  }
#endif`;
}

export async function create(ctx) {
  const { THREE, scene, quality, camera } = ctx;
  const sunDir = ctx.systems.lighting?.sunDirection?.clone() || new THREE.Vector3(0.5, 0.6, 0.6).normalize();

  const colors = {
    zenith: new THREE.Color(0x1653c9),
    mid: new THREE.Color(0x2f7be0),
    horizon: new THREE.Color(0x8cc8ff),
    band: new THREE.Color(0xd2ebff),
    sunGlow: new THREE.Color(0xffe2b0).multiplyScalar(1.0),
  };
  colors.fog = colors.horizon.clone().lerp(colors.band, 0.7);
  toonUniforms.uSkyZenith.value.copy(colors.mid);
  toonUniforms.uSkyHorizon.value.copy(colors.fog);

  const far = camera.far;
  installFog(THREE, sunDir, colors.sunGlow, {
    density: quality.name === 'low' ? 0.0021 : 0.0017, falloff: 1 / 55, base: 0, start: 25,
  });
  scene.background = colors.fog.clone();
  scene.fog = new THREE.Fog(colors.fog.clone(), far * 0.5, far * 0.97);

  const skyUniforms = {
    uSkyZen: { value: colors.zenith }, uSkyMid: { value: colors.mid }, uSkyHor: { value: colors.horizon },
    uSkyBand: { value: colors.band }, uSunGlow: { value: colors.sunGlow }, uSunDir: { value: sunDir },
  };
  const R = Math.min(far * 0.85, 820);
  const noise = makeNoiseTexture(THREE, 256);

  // ── dome ──
  const domeMat = new THREE.ShaderMaterial({
    uniforms: { ...skyUniforms, uTime: toonUniforms.uTime, uNoise: { value: noise }, uR: { value: R }, uCirrus: { value: quality.name === 'low' ? 0.0 : 1.0 } },
    vertexShader: /* glsl */`
      uniform float uR; varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        vec4 p = projectionMatrix * viewMatrix * vec4( cameraPosition + position * uR, 1.0 );
        p.z = p.w * 0.99995;
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */`
      ${SKY_GLSL}
      uniform float uTime; uniform sampler2D uNoise; uniform float uCirrus;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize( vDir );
        vec3 col = aeSky( dir );
        // sun disc (HDR core → bloom) with a soft corona
        float sd = dot( dir, uSunDir );
        float disc = smoothstep( 0.99955, 0.99975, sd );
        col += vec3( 1.0, 0.93, 0.8 ) * ( disc * 40.0 + pow( max( sd, 0.0 ), 900.0 ) * 6.0 );
        // high cirrus: wind-stretched streaks on a plane projection
        if ( uCirrus > 0.0 && dir.y > 0.04 ) {
          vec2 uv = dir.xz / ( dir.y + 0.08 );
          vec2 w = vec2( 0.82, 0.57 );
          vec2 ru = vec2( dot( uv, w ), dot( uv, vec2( -w.y, w.x ) ) );
          vec2 p = ru * vec2( 0.035, 0.16 ) + vec2( uTime * 0.0012, 0.0 );
          float n = texture2D( uNoise, p ).r;
          float n2 = texture2D( uNoise, p * 2.7 + 0.37 ).g;
          float streak = smoothstep( 0.52, 0.78, n * 0.75 + n2 * 0.35 );
          float mask = smoothstep( 0.06, 0.32, dir.y ) * ( 1.0 - smoothstep( 0.75, 1.0, dir.y ) );
          float a = streak * mask * 0.45;
          vec3 cc = mix( vec3( 1.0 ), uSunGlow, 0.25 + 0.5 * pow( max( sd, 0.0 ), 4.0 ) );
          col = mix( col, cc * 1.02, a );
        }
        gl_FragColor = vec4( col, 1.0 );
      }`,
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), domeMat);
  dome.renderOrder = -1000; dome.frustumCulled = false; dome.name = 'sky_dome';
  scene.add(dome);

  // ── cumulus cards ──
  let clouds = null;
  try {
    const atlas = makeCloudAtlas(THREE);
    const count = quality.name === 'low' ? 16 : 30;
    const base = new THREE.PlaneGeometry(2, 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    const aCard = new Float32Array(count * 4), aCell = new Float32Array(count * 4);
    let s = 777;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < count; i++) {
      const big = i < count * 0.6;
      const az = (i / count) * Math.PI * 2 * 3.0 + rnd() * 0.9;    // spread round the horizon
      const halfW = THREE.MathUtils.degToRad(big ? 16 + rnd() * 14 : 7 + rnd() * 7);
      const halfH = Math.atan(Math.tan(halfW) * 0.5);
      const baseEl = THREE.MathUtils.degToRad(big ? 1.5 + rnd() * 9 : 14 + rnd() * 22);
      const el = baseEl + halfH * 0.64;
      aCard.set([az, el, halfW, halfH], i * 4);
      const cell = Math.floor(rnd() * 8);
      aCell.set([cell % 2, Math.floor(cell / 2), rnd() < 0.5 ? 1 : -1, big ? 1 : 0.85], i * 4);
    }
    g.setAttribute('aCard', new THREE.InstancedBufferAttribute(aCard, 4));
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 4));
    g.instanceCount = count;
    const cmat = new THREE.ShaderMaterial({
      uniforms: { ...skyUniforms, uAtlas: { value: atlas }, uTime: toonUniforms.uTime, uR: { value: R * 0.92 }, uFog: { value: colors.fog } },
      vertexShader: /* glsl */`
        attribute vec4 aCard; attribute vec4 aCell;
        uniform float uR; uniform float uTime;
        varying vec2 vUv; varying vec2 vLocal; varying vec3 vRight; varying vec3 vUp; varying vec3 vFwd; varying float vDirY; varying float vBright;
        void main() {
          float az = aCard.x + uTime * 0.0016;
          float el = aCard.y;
          vec3 dir = vec3( cos( el ) * sin( az ), sin( el ), cos( el ) * cos( az ) );
          vec3 right = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) );
          vec3 up = cross( right, dir );
          vec3 p = dir + right * position.x * tan( aCard.z ) + up * position.y * tan( aCard.w );
          vLocal = position.xy * 0.5 + 0.5;
          float u = aCell.z > 0.0 ? vLocal.x : 1.0 - vLocal.x;
          vUv = vec2( ( aCell.x + u ) * 0.5, ( aCell.y + 1.0 - vLocal.y ) * 0.25 );
          vRight = right * sign( aCell.z ); vUp = up; vFwd = -dir;
          vDirY = normalize( p ).y; vBright = aCell.w;
          vec4 cp = projectionMatrix * viewMatrix * vec4( cameraPosition + p * uR, 1.0 );
          cp.z = cp.w * 0.9999;
          gl_Position = cp;
        }`,
      fragmentShader: /* glsl */`
        ${SKY_GLSL}
        uniform sampler2D uAtlas; uniform vec3 uFog;
        varying vec2 vUv; varying vec2 vLocal; varying vec3 vRight; varying vec3 vUp; varying vec3 vFwd; varying float vDirY; varying float vBright;
        void main() {
          vec4 t = texture2D( uAtlas, vUv );
          float a = smoothstep( 0.3, 0.7, t.a );
          if ( a < 0.003 ) discard;
          vec3 n; n.xy = t.rg * 2.0 - 1.0; n.z = sqrt( max( 0.0, 1.0 - dot( n.xy, n.xy ) ) );
          vec3 Ls = vec3( dot( uSunDir, vRight ), dot( uSunDir, vUp ), dot( uSunDir, vFwd ) );
          float lam = dot( n, normalize( Ls ) );
          float lit = smoothstep( -0.12, 0.22, lam );
          float hgt = ( vLocal.y - 0.18 ) / 0.82;
          float under = smoothstep( 0.0, 0.42, hgt + n.y * 0.18 );
          lit *= mix( 0.35, 1.0, under );
          vec3 shadeCol = vec3( 0.50, 0.60, 0.88 );
          vec3 midCol = vec3( 0.78, 0.84, 0.98 );
          vec3 litCol = vec3( 1.04, 1.0, 0.95 );
          vec3 col = mix( shadeCol, midCol, smoothstep( 0.0, 0.5, lit ) );
          col = mix( col, litCol, smoothstep( 0.45, 0.9, lit ) );
          col *= mix( 0.92, 1.0, t.b );
          // sun-side rim / silver lining
          float behind = clamp( -Ls.z * 1.3 + 0.15, 0.0, 1.0 );
          float edge = pow( 1.0 - n.z, 2.2 );
          vec2 l2 = Ls.xy; float l2l = length( l2 );
          float facing = l2l > 1e-3 ? clamp( dot( normalize( n.xy + 1e-4 ), l2 / l2l ), 0.0, 1.0 ) : 0.0;
          col += vec3( 1.0, 0.94, 0.82 ) * edge * facing * ( 0.25 + behind * 1.4 );
          // thin alpha edge glows slightly
          col += vec3( 0.12 ) * ( 1.0 - smoothstep( 0.35, 0.9, t.a ) );
          col *= vBright;
          // aerial haze toward the horizon
          float hz = smoothstep( -0.01, 0.2, vDirY );
          col = mix( mix( uFog, aeSky( normalize( vec3( 0.0, max( vDirY, 0.0 ), 1.0 ) ) ), 0.5 ), col, mix( 0.45, 1.0, hz ) );
          a *= smoothstep( -0.015, 0.02, vDirY );
          gl_FragColor = vec4( col, a );
        }`,
      depthTest: false, depthWrite: false, fog: false, transparent: false,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    clouds = new THREE.Mesh(g, cmat);
    clouds.frustumCulled = false; clouds.renderOrder = -999; clouds.name = 'sky_clouds';
    scene.add(clouds);
  } catch (e) {
    console.error('[sky] clouds failed', e);
  }

  return { dome, clouds, colors, skyGLSL: SKY_GLSL, skyUniforms, noise };
}
