// AETHERIA characters (owner: character agent).
//
//   const c = await createCharacter(ctx, 'kael', { lod: 'high' | 'low', shadows: true });
//   scene.add(c.object)            // THREE.Group, model faces -Z, feet at y = 0
//   c.setLocomotion(speedMS, grounded, verticalSpeed)   // every frame from the controller
//   c.play('attack1', { loop: false, fade: 0.15, speed: 1 })
//   c.lookAt(vector3 | object3d | null); c.setExpression('happy', 1)
// Per-frame work registers itself in ctx.updaters (call c.update(dt) yourself only if you have no ctx.updaters;
// once you call update() manually the automatic updater stops, so it never runs twice).
//
// Model source per id: VRM (assets_src/vroid or public/assets/characters/<id>.vrm, three-vrm + tuned MToon,
// spring bones, blink, look-at) -> fallback GLB (public/assets/characters/<id>.glb, then legacy/<id>.glb) with
// toon.js materials + outlines -> a placeholder capsule (never throws).
// Animation per action: baked/FBX clips retargeted to the normalized humanoid (src/characters/retarget.js)
// -> procedural fallback (idle/walk/run/sprint/fall), so nothing is ever static.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createToonMaterial, createOutline } from '../render/toon.js';
import { ACTIONS } from './names.js';
import { NormalizedRig, VRMRigAdapter, detectHumanBones } from './humanoid.js';
import { bindClip } from './retarget.js';
import { Animator, locomotionPhase } from './animator.js';
import { buildProceduralClips } from './procedural.js';
import { loadNormClip, findVRM, findGLB } from './library.js';
import { CATALOG } from './catalog.js';

export { ACTIONS, CATALOG };

export async function createCharacter(ctx, id, opts = {}) {
  // Third-party CC0 rigged characters first (see cc0.js); ?chars=vrm or opts.cc0 === false keeps the VRM / generated cast.
  if (opts.cc0 !== false && ctx?.params?.get('chars') !== 'vrm' && ctx?.assets?.loadGLTF) {
    try {
      const { createCC0Character } = await import('./cc0.js');
      const ch = await createCC0Character(ctx, id, opts);
      if (ch) return ch;
    } catch (e) { console.warn(`[characters] CC0 model for ${id} failed, using the previous character:`, e); }
  }
  const TARGET_HEIGHT = { kael: 1.75, lyra: 1.62, maren: 1.67, wenna: 1.58, toma: 1.48, ostin: 1.68, hesk: 1.86, veyra: 1.72 };
  const object = new THREE.Group();
  object.name = `character_${id}`;
  const pivot = new THREE.Group();          // models face +Z (VRM 1.0 / glTF); turn them to face -Z
  pivot.rotation.y = Math.PI;
  object.add(pivot);
  const info = CATALOG[id] || {};
  const low = opts.lod === 'low' || (opts.npc && ctx.quality?.name === 'low');

  let model = null;
  try {
    const vrmUrl = opts.vrm === false ? null : await findVRM(id);
    if (vrmUrl) model = await loadVRMModel(ctx, vrmUrl, { low, info });
  } catch (e) { console.warn(`[characters] VRM for ${id} failed, using fallback:`, e); }
  if (!model) {
    try {
      const glbUrl = await findGLB(id);
      if (glbUrl) model = await loadGLBModel(ctx, glbUrl, { low, info, id });
    } catch (e) { console.warn(`[characters] GLB for ${id} failed:`, e); }
  }
  if (!model) model = placeholderModel(info);
  pivot.add(model.scene);
  // normalise the free VRoid models to the cast's heights (anime proportions, metres)
  const targetH = opts.height ?? TARGET_HEIGHT[id];
  if (targetH && model.height > 0.5 && Math.abs(model.height - targetH) > 0.02) {
    pivot.scale.setScalar(targetH / model.height);
    model.height = targetH;
  }
  if (opts.shadows !== false) model.scene.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });

  // ---- animation clips: retargeted files first, procedural for the rest
  const clips = {};
  let animator = null;
  if (model.rig) {
    const wanted = ACTIONS;
    const norms = await Promise.all(wanted.map((a) => (opts.animations === false ? null : loadNormClip(a))));
    wanted.forEach((a, i) => {
      const nc = norms[i];
      if (!nc) return;
      try {
        const clip = bindClip(nc, model.rig, a);
        if (['walk', 'run', 'sprint'].includes(a)) clip.userData.phase = locomotionPhase(nc);
        clips[a] = clip;
      } catch (e) { console.warn('[characters] bind', a, e); }
    });
    const missing = ['idle', 'walk', 'run', 'sprint', 'fall'].filter((a) => !clips[a]);
    Object.assign(clips, buildProceduralClips(model.rig, missing));
    animator = new Animator(model.rig.root, clips, { scale: (model.rig.hipsHeight || 0.9) / 0.9 });
  }

  // ---- look-at / blink / expression state
  const look = { target: null, yaw: 0, pitch: 0, idleT: 0, idleYaw: 0, idlePitch: 0 };
  const expr = {};
  let blinkT = 2 + Math.random() * 3, blinkW = 0;
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

  function applyLook(dt) {
    if (!model.rig) return;
    const head = model.rig.node('head');
    if (!head) return;
    let yaw = 0, pitch = 0;
    const t = look.target;
    if (t) {
      // measure in the pivot frame, where every model (VRM0 after rotateVRM0, VRM1, GLB) faces +Z
      const p = t.isObject3D ? t.getWorldPosition(tmpV) : tmpV.copy(t);
      pivot.updateMatrixWorld(true);
      head.updateWorldMatrix(true, false);
      const hp = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
      pivot.worldToLocal(p); pivot.worldToLocal(hp);
      const d = p.sub(hp);
      yaw = Math.atan2(d.x, d.z); pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      if (Math.abs(yaw) > 1.9) yaw = 0, pitch = 0;          // behind: don't break the neck
      yaw = THREE.MathUtils.clamp(yaw, -1.0, 1.0); pitch = THREE.MathUtils.clamp(pitch, -0.45, 0.5);
    } else {                                                // idle glances
      look.idleT -= dt;
      if (look.idleT <= 0) { look.idleT = 1.5 + Math.random() * 3.5; look.idleYaw = (Math.random() - 0.5) * 0.5; look.idlePitch = (Math.random() - 0.4) * 0.15; }
      const calm = animator && ['idle', 'talk'].includes(animator.current) ? 1 : 0.3;
      yaw = look.idleYaw * calm; pitch = look.idlePitch * calm;
    }
    const k = Math.min(1, dt * 5);
    look.yaw += (yaw - look.yaw) * k; look.pitch += (pitch - look.pitch) * k;
    const neck = model.rig.node('neck');
    const split = neck ? 0.4 : 0;
    // VRM0 normalized bones live in a frame turned 180 deg about Y: yaw is unchanged, pitch mirrors
    const pf = model.rig.isVRM0 ? -1 : 1;
    if (neck) neck.quaternion.premultiply(tmpQ.setFromEuler(tmpE.set(look.pitch * split * pf, look.yaw * split, 0)));
    head.quaternion.premultiply(tmpQ.setFromEuler(tmpE.set(look.pitch * (1 - split) * pf, look.yaw * (1 - split), 0)));
  }

  // ---- post-animation layer (look-at + foot grounding). three's PropertyMixer skips writing a node whose
  // blended value did not change, so the layer restores the pre-layer pose first; otherwise held poses
  // (dt = 0, clamped one-shots) would accumulate the additive rotations frame after frame.
  const post = { saved: false, neck: new THREE.Quaternion(), head: new THREE.Quaternion(), hips: new THREE.Vector3(), groundW: 1, offset: 0 };
  const rigNode = (h) => model.rig?.node(h) || null;
  const GROUNDED = new Set(['idle', 'walk', 'run', 'sprint', 'talk', 'wave', 'interact', 'attack1', 'attack2', 'attack3', 'cast', 'hit', 'land']);
  const contacts = [];
  if (model.rig) {
    // rest heights of the ankle and toe joints above the model origin (rig is still in its rest pose here)
    model.scene.updateMatrixWorld(true);
    const base = model.scene;
    for (const h of ['leftFoot', 'rightFoot', 'leftToes', 'rightToes']) {
      const n = rigNode(h); if (!n) continue;
      const p = base.worldToLocal(n.getWorldPosition(new THREE.Vector3()));
      contacts.push({ node: n, rest: Math.max(0, p.y) });
    }
  }
  function restorePost() {
    if (!post.saved) return;
    rigNode('neck')?.quaternion.copy(post.neck);
    rigNode('head')?.quaternion.copy(post.head);
    rigNode('hips')?.position.copy(post.hips);
  }
  function savePost() {
    const n = rigNode('neck'), h = rigNode('head'), hp = rigNode('hips');
    if (n) post.neck.copy(n.quaternion);
    if (h) post.head.copy(h.quaternion);
    if (hp) post.hips.copy(hp.position);
    post.saved = true;
  }
  const _gp = new THREE.Vector3();
  function applyGrounding(dt) {
    const hips = rigNode('hips');
    if (!hips || !contacts.length || !animator) return;
    const cur = animator.current;
    const want = animator.grounded && animator.airW < 0.05 && GROUNDED.has(cur) && !animator.forcedNoGround ? 1 : 0;
    post.groundW += (want - post.groundW) * Math.min(1, (dt > 0 ? dt : 1 / 30) * 8);
    if (post.groundW < 0.01) return;
    model.scene.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const c of contacts) {
      const y = model.scene.worldToLocal(c.node.getWorldPosition(_gp)).y - c.rest;
      if (y < lowest) lowest = y;
    }
    if (!isFinite(lowest)) return;
    const s = (model.rig.hipsHeight || 0.9) / 0.9;
    const delta = THREE.MathUtils.clamp(-lowest, -0.14 * s, 0.14 * s) * post.groundW;
    // hips live in the normalized root frame, whose +Y is the model's +Y (VRM0 frames only mirror X/Z)
    hips.position.y += delta;
    post.offset = delta;
  }

  let ticks = 0;
  const lastPos = new THREE.Vector3();
  const curPos = new THREE.Vector3();
  function tick(dt) {
    restorePost();
    if (animator) animator.update(dt);
    savePost();
    applyGrounding(dt);
    applyLook(dt);
    // blink (skipped while an explicit blink/happy expression is set)
    blinkT -= dt;
    if (blinkT <= 0) { blinkW = 1; blinkT = 1.8 + Math.random() * 4 + (Math.random() < 0.15 ? -1.5 : 0); }
    const blink = expr.blink ?? Math.max(0, Math.sin(Math.min(1, blinkW) * Math.PI));
    if (blinkW > 0) blinkW = Math.max(0, blinkW - dt / 0.16);
    model.setExpressions?.({ ...expr, blink: Math.max(expr.blink || 0, blink) });
    model.rig?.update();
    model.update?.(dt);
    // spring bones: settle against the posed skeleton on the first tick and after teleports (> 2 m in a frame)
    object.getWorldPosition(curPos);
    if (ticks++ === 0 || curPos.distanceToSquared(lastPos) > 4) { model.vrm?.springBoneManager?.reset(); }
    lastPos.copy(curPos);
  }

  let manual = false;
  if (ctx?.updaters) ctx.updaters.push((dt) => { if (!manual) tick(dt); });

  const api = {
    id, object, model, animator, clips,
    kind: model.kind,
    height: model.height,
    play(name, o = {}) { return animator ? animator.play(name, o) : false; },
    stop(name, fade) { animator?.stop(name, fade); },
    setLocomotion(speed, grounded = true, verticalSpeed = 0) { animator?.setLocomotion(speed, grounded, verticalSpeed); },
    update(dt) { manual = true; tick(dt); },
    lookAt(target) { look.target = target || null; if (model.vrm?.lookAt) model.vrm.lookAt.target = target?.isObject3D ? target : null; },
    setExpression(name, weight = 1) { if (weight <= 0) delete expr[name]; else expr[name] = Math.min(1, weight); },
    get current() { return animator?.current || 'idle'; },
    get actions() { return Object.keys(clips); },
    resetPhysics() { model.vrm?.springBoneManager?.reset(); },
    dispose() { object.removeFromParent(); },
  };
  return api;
}

// ------------------------------------------------------------------ VRM
let vrmLoaderP = null;
async function vrmLoader() {
  vrmLoaderP ??= (async () => {
    const [{ GLTFLoader }, vrmlib] = await Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js'), import('@pixiv/three-vrm')]);
    const loader = new GLTFLoader();
    loader.register((parser) => new vrmlib.VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
    return { loader, vrmlib };
  })();
  return vrmLoaderP;
}

function matcapSheen() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  const grd = g.createLinearGradient(0, 18, 0, 70);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.ellipse(64, 46, 58, 22, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function loadVRMModel(ctx, url, { low, info }) {
  const { loader, vrmlib } = await vrmLoader();
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('not a VRM');
  const { VRMUtils } = vrmlib;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.combineMorphs?.(vrm);
  if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
  const sheen = matcapSheen();
  const shadowTint = new THREE.Color('#5C6A9C');
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) tuneMToon(m, o, { sheen, shadowTint, low, info });
  });
  const merged = mergeSkinnedByMaterial(vrm.scene);
  if (merged) console.info(`[characters] ${url}: merged ${merged} skinned meshes by material`);
  vrm.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const rig = new VRMRigAdapter(vrm);
  if (vrm.lookAt) { vrm.lookAt.autoUpdate = true; }
  const expressionNames = new Set(vrm.expressionManager?.expressions?.map((e) => e.expressionName) || []);
  return {
    kind: 'vrm', vrm, scene: vrm.scene, rig, height: box.max.y - Math.min(0, box.min.y),
    setExpressions(map) {
      const em = vrm.expressionManager; if (!em) return;
      for (const n of expressionNames) em.setValue(n, map[n] || 0);
    },
    update(dt) { if (low && vrm.springBoneManager) { vrm.humanoid.update(); vrm.expressionManager?.update(); return; } vrm.update(dt); },
  };
}

/**
 * VRoid exports split one character into ~70-100 skinned meshes. Meshes that share a material, skeleton,
 * bind matrix and attribute layout (and carry no morph targets: the face keeps its expressions) are merged
 * into one SkinnedMesh per material, cutting draw calls (and shadow draws) by roughly 3x.
 * Returns how many meshes were removed.
 */
function mergeSkinnedByMaterial(root) {
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isSkinnedMesh || Array.isArray(o.material) || !o.parent) return;
    if (o.morphTargetInfluences?.length || o.geometry.morphAttributes?.position?.length) return;
    const key = `${o.material.uuid}|${o.skeleton.uuid}|${o.parent.uuid}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const first = list[0];
    const layout = (g) => Object.keys(g.attributes).sort().map((k) => `${k}:${g.attributes[k].itemSize}:${g.attributes[k].array.constructor.name}`).join('|') + (g.index ? ':i' : '');
    const ref = layout(first.geometry);
    if (!list.every((m) => m.bindMatrix.equals(first.bindMatrix) && m.matrix.equals(first.matrix) && layout(m.geometry) === ref)) continue;
    const geo = mergeGeometries(list.map((m) => m.geometry), false);
    if (!geo) continue;
    const mesh = new THREE.SkinnedMesh(geo, first.material);
    mesh.name = first.name + '_merged';
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.frustumCulled = first.frustumCulled;
    mesh.renderOrder = first.renderOrder;
    mesh.position.copy(first.position);
    mesh.quaternion.copy(first.quaternion);
    mesh.scale.copy(first.scale);
    mesh.bind(first.skeleton, first.bindMatrix);
    first.parent.add(mesh);
    for (const m of list) m.removeFromParent();
    removed += list.length - 1;
  }
  return removed;
}

/** Studio anime look for VRoid MToon materials. */
function tuneMToon(m, mesh, { sheen, shadowTint, low }) {
  if (!m || !m.isMToonMaterial && !('shadingToonyFactor' in m)) return;
  const n = (m.name || '') + ' ' + (mesh.name || '');
  const part = /HAIR/i.test(n) ? 'hair' : /EYE|Iris|Highlight|EyeWhite|Lash|Brow|Mouth|FaceEye/i.test(n) ? 'face' : /SKIN|Face|Body/i.test(n) ? 'skin' : 'cloth';
  if (m.isOutline) {
    m.outlineWidthMode = 'worldCoordinates';
    m.outlineWidthFactor = part === 'hair' ? 0.0028 : part === 'skin' ? 0.0018 : 0.0024;
    const base = m.color?.clone?.() || new THREE.Color(0.2, 0.15, 0.2);
    m.outlineColorFactor.copy(base.multiplyScalar(0.28)).lerp(new THREE.Color('#1A1420'), 0.45);
    m.outlineLightingMixFactor = 0.35;
    if (low || part === 'face') m.visible = false;
    return;
  }
  if (part === 'face') { m.shadingToonyFactor = 1; m.parametricRimColorFactor?.setRGB(0, 0, 0); return; }
  m.shadingToonyFactor = part === 'skin' ? 0.93 : 0.96;
  m.shadingShiftFactor = part === 'skin' ? -0.05 : -0.08;
  m.giEqualizationFactor = 0.85;
  if (m.shadeColorFactor) {
    // keep VRoid's authored shade hue, pull it toward the cool art-bible shadow (skin stays warm)
    m.shadeColorFactor.lerp(shadowTint, part === 'skin' ? 0.12 : 0.28);
  }
  if (m.parametricRimColorFactor) {
    m.parametricRimColorFactor.set(part === 'hair' ? '#4f5a78' : '#3d3a4a');
    m.parametricRimFresnelPowerFactor = 4.0;
    m.parametricRimLiftFactor = 0.06;
    m.rimLightingMixFactor = 0.7;
  }
  if (part === 'hair' && !m.matcapTexture && !low) {
    m.matcapTexture = sheen;
    m.matcapFactor.setRGB(0.22, 0.22, 0.24);
    m.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ fallback GLB
const KIND_RULES = [
  [/EYE|IRIS/i, 'eye'], [/MOUTH|NOSE|BLUSH|BROW|LASH/i, 'face'], [/SKIN/i, 'skin'], [/HAIR|BEARD/i, 'hair'],
  [/GLOW|CRYSTAL|GEM/i, 'glow'], [/METAL|ORN|GOLD|BRASS|BLADE|BUCKLE/i, 'metal'], [/CLOTH|LEATHER|.*/i, 'cloth'],
];
const kindOf = (name) => KIND_RULES.find(([re]) => re.test(name))[1];

async function loadGLBModel(ctx, url, { low, info, id }) {
  const gltf = await (ctx?.assets?.loadGLTF ? ctx.assets.loadGLTF(url) : new (await import('three/examples/jsm/loaders/GLTFLoader.js')).GLTFLoader().loadAsync(url));
  const scene = cloneSkinned(gltf.scene);
  scene.name = `${id}_model`;
  const matCache = new Map();
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    o.frustumCulled = false;
    const src = o.material;
    const kind = kindOf(src.name || '');
    let m = matCache.get(src);
    if (!m) {
      const color = src.color ? src.color.clone() : new THREE.Color(1, 1, 1);
      const toonKind = kind === 'eye' || kind === 'face' ? 'skin' : kind;
      m = createToonMaterial({
        color, map: src.map || null, kind: toonKind, outline: kind !== 'eye' && kind !== 'face',
        alphaTest: src.map && (kind === 'eye' || src.alphaTest) ? 0.5 : 0, transparent: false,
        emissive: kind === 'glow' ? color : (kind === 'eye' ? 0xffffff : 0x000000),
        emissiveIntensity: kind === 'glow' ? 1.6 : kind === 'eye' ? 0.55 : 1,
        side: kind === 'cloth' || kind === 'hair' ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (kind === 'eye' && src.map && 'emissiveMap' in m) m.emissiveMap = src.map;
      m.name = src.name;
      m.userData.characterPart = kind;
      matCache.set(src, m);
    }
    o.material = m;
    o.userData.part = kind;
  }
  // outlines (toon.js createOutline if it provides skinned hulls, else a local inverted hull)
  if (!low && ctx?.quality?.outlines !== 'none') {
    for (const o of meshes) {
      if (o.userData.part === 'eye' || o.userData.part === 'face' || o.userData.part === 'glow') continue;
      const width = o.userData.part === 'hair' ? 0.0042 : o.userData.part === 'skin' ? 0.0028 : 0.0036;
      const col = new THREE.Color(o.material.color).multiplyScalar(0.25).lerp(new THREE.Color('#1A1420'), 0.55);
      let hull = null;
      try { hull = createOutline(o, width, col.getHex()); } catch { hull = null; }
      if (hull && o.isSkinnedMesh && !hull.isSkinnedMesh) hull = null;
      if (!hull) hull = skinnedOutline(o, width, col);
      hull.userData.isOutline = true;
      o.parent.add(hull);
    }
  }
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const raw = detectHumanBones(scene);
  const rig = raw ? new NormalizedRig(scene, raw, { tpose: true, prefix: `N_${id}` }) : null;
  // expressions = morph targets with matching names (v2 Blender builds carry blink/happy/aa ...)
  const morphMeshes = meshes.filter((o) => o.morphTargetDictionary);
  return {
    kind: 'glb', scene, rig, height: box.max.y - Math.min(0, box.min.y),
    setExpressions(map) {
      for (const o of morphMeshes) {
        for (const [n, i] of Object.entries(o.morphTargetDictionary)) o.morphTargetInfluences[i] = map[n] || 0;
      }
    },
  };
}

const outlineMats = new Map();
function skinnedOutline(mesh, width, color) {
  const key = width + ':' + color.getHexString();
  let mat = outlineMats.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uOutline = { value: width };
      sh.vertexShader = 'uniform float uOutline;\n' + sh.vertexShader.replace('#include <skinning_vertex>',
        `#include <skinning_vertex>
        #ifdef USE_SKINNING
          vec3 oN = normalize( ( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz );
        #else
          vec3 oN = normalize( objectNormal );
        #endif
        transformed += oN * uOutline;`)
        .replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position.z += 0.00002 * gl_Position.w;');
    };
    mat.userData.isOutline = true;
    outlineMats.set(key, mat);
  }
  let hull;
  if (mesh.isSkinnedMesh) {
    hull = new THREE.SkinnedMesh(mesh.geometry, mat);
    hull.bind(mesh.skeleton, mesh.bindMatrix);
    hull.bindMode = mesh.bindMode;
  } else hull = new THREE.Mesh(mesh.geometry, mat);
  hull.position.copy(mesh.position); hull.quaternion.copy(mesh.quaternion); hull.scale.copy(mesh.scale);
  hull.frustumCulled = false;
  hull.castShadow = false;
  hull.name = mesh.name + '_outline';
  return hull;
}

function placeholderModel(info) {
  const g = new THREE.Group();
  const m = createToonMaterial({ color: info.colors?.[0] || 0x2b6e7c, kind: 'cloth' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 6, 12), m);
  body.position.y = 0.82;
  g.add(body);
  return { kind: 'placeholder', scene: g, rig: null, height: 1.6 };
}
