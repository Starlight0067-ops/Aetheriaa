// AETHERIA — sun, sky fill and cascaded shadow maps (owner: render).
// API: { sun, hemi, csm, sunDirection (towards the sun, single source of truth), sunColor, preRender() }
//
// CSM note: three's CSM.js creates one DirectionalLight per cascade. Only cascade 0 carries the sun colour;
// the others have intensity 0 and exist for their shadow maps. Toon materials (and any material passed to
// toon.registerLitMaterial) read the sun colour from light 0 and pick the right cascade. Materials that don't
// know about CSM (e.g. VRM MToon) therefore get exactly 1× sun with cascade-0 shadows near the camera,
// instead of being lit N times.
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { CSMShader } from 'three/examples/jsm/csm/CSMShader.js';
import { initToon, setCSM, registerLitMaterial } from './toon.js';

export const SUN_INTENSITY = 2.9;

function patchCSMChunk(THREE) {
  // In the USE_CSM branch, every cascade light must shine with light 0's colour (others are 0-intensity).
  let src = CSMShader.lights_fragment_begin;
  const a = src.indexOf('defined( USE_CSM ) && defined( CSM_CASCADES )');
  const b = src.indexOf('!defined( USE_CSM )');
  if (a < 0 || b < 0) return;
  const head = src.slice(0, a), body = src.slice(a, b), tail = src.slice(b);
  const marker = 'getDirectionalLightInfo( directionalLight, directLight );';
  let n = 0;
  const patched = body.replace(new RegExp(marker.replace(/[()]/g, '\\$&'), 'g'), (m) =>
    (n++ < 2) ? m + ' directLight.color = directionalLights[ 0 ].color;' : m);
  THREE.ShaderChunk.lights_fragment_begin = head + patched + tail;
}

export async function create(ctx) {
  const { THREE, scene, quality, renderer, camera } = ctx;
  initToon(ctx);

  // Afternoon sun from the south-east: side/3-4 light on the north-looking views, long readable shadows.
  const sunDirection = new THREE.Vector3(0.52, 0.6, 0.6).normalize();
  const sunColor = new THREE.Color(0xfff0dc);

  // Sky-tinted fill: cool blue from above, warm green-ochre bounce from the ground.
  const hemi = new THREE.HemisphereLight(0xc4dcff, 0xa39a74, 1.42);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  let csm = null, sun = null;
  if (quality.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;    // PCFSoft was removed in r187 (falls back with a warning)
    const shadowFar = quality.shadowFar;
    try {
      csm = new CSM({
        camera, parent: scene,
        cascades: quality.cascades,
        maxFar: shadowFar,
        shadowMapSize: quality.shadowMapSize,
        lightDirection: sunDirection.clone().negate(),
        lightIntensity: SUN_INTENSITY,
        lightNear: 1,
        lightFar: shadowFar * 2.5 + 400,
        lightMargin: 220,
        mode: 'custom',
        customSplitsCallback: (n, near, far, out) => {
          // log-heavy practical split: crisp first cascade around the player
          const lambda = 0.82;
          for (let i = 1; i < n; i++) {
            const u = near + (far - near) * i / n;
            const l = near * Math.pow(far / near, i / n);
            out.push(THREE.MathUtils.lerp(u, l, lambda) / far);
          }
          out.push(1);
        },
      });
      patchCSMChunk(THREE);
      csm.fade = false;
      csm.lights.forEach((l, i) => {
        l.color.copy(sunColor);
        l.intensity = i === 0 ? SUN_INTENSITY : 0;
        l.shadow.radius = quality.name === 'low' ? 1.0 : 1.6;
        l.shadow.bias = -0.00004;
        l.name = 'csm_sun_' + i;
      });
      sun = csm.lights[0];
      setCSM(csm);
    } catch (e) {
      console.error('[lighting] CSM failed, falling back to single shadow light', e);
      csm = null;
    }
  }
  if (!csm) {
    sun = new THREE.DirectionalLight(sunColor, SUN_INTENSITY);
    sun.castShadow = quality.shadows;
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const s = sun.shadow.camera;
    s.left = -60; s.right = 60; s.top = 60; s.bottom = -60; s.near = 1; s.far = 700;
    sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.06;
    scene.add(sun, sun.target);
  }

  // per-cascade normal bias proportional to texel size (no acne, no peter-panning)
  const tuneBias = () => {
    if (!csm) return;
    for (const l of csm.lights) {
      const cam = l.shadow.camera;
      const texel = (cam.right - cam.left) / quality.shadowMapSize;
      l.shadow.normalBias = texel * 1.6;
    }
  };
  let projKey = '';
  const lastDir = sunDirection.clone();

  function preRender() {
    camera.updateMatrixWorld();
    if (csm) {
      const k = camera.fov + '|' + camera.aspect + '|' + camera.near + '|' + camera.far;
      if (k !== projKey) { projKey = k; csm.updateFrustums(); tuneBias(); }
      if (!lastDir.equals(sunDirection)) { csm.lightDirection.copy(sunDirection).negate(); lastDir.copy(sunDirection); }
      csm.update();
    } else if (sun) {
      const c = camera.position;
      sun.target.position.set(c.x, c.y - 10, c.z);
      sun.position.copy(sun.target.position).addScaledVector(sunDirection, 300);
      sun.target.updateMatrixWorld();
    }
  }

  // Safety net: foreign built-in lit materials get CSM too (characters' MToon is fine as-is, see header).
  let frame = 0;
  ctx.updaters.push(() => {
    frame++;
    if (frame === 2 || frame % (frame < 600 ? 45 : 300) === 0) {
      scene.traverse((o) => {
        if (!o.material || o.userData.isOutline) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) registerLitMaterial(m);
      });
    }
  });

  return { sun, hemi, csm, sunDirection, sunColor, preRender };
}
