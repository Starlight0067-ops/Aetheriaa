// Third-party CC0 characters (public/assets/cc0/characters, see LICENSES.md there): rigged low-poly GLBs
// from Quaternius and Kenney with their own idle / walk / run clips, driven by a THREE.AnimationMixer.
// createCC0Character() returns the same API as createCharacter() in index.js, so the player controller and
// the NPC module do not change. index.js falls back to the VRM / generated characters when this fails
// or when the page is opened with ?chars=vrm.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createToonMaterial } from '../render/toon.js';

const DIR = '/assets/cc0/characters/';

// cast id -> model. hero = adventurer, blacksmith = worker, elder = hooded adventurer. The townsfolk reuse the
// same realistic-proportion rigs with their own heights and garment colours (`colors`: material name -> colour),
// so the whole cast shares one art style and one set of well-behaved locomotion clips.
export const CC0_CAST = {
  kael:  { file: 'adventurer',        height: 1.75 },
  hesk:  { file: 'worker',            height: 1.84 },
  maren: { file: 'hooded_adventurer', height: 1.68 },
  veyra: { file: 'rogue',             height: 1.72 },
  lyra:  { file: 'rogue',             height: 1.60, colors: [[/^shirt$/i, 0x8a5aa8], [/undershirt/i, 0xe8dcc8], [/pants/i, 0x3b4668], [/hair/i, 0x2a1c16]] },
  wenna: { file: 'hooded_adventurer', height: 1.58, colors: [[/^lightbrown$/i, 0x7a3d4a], [/^brown2$/i, 0x46587a], [/^darkbrown$/i, 0x3a2430]] },
  ostin: { file: 'worker',            height: 1.72, colors: [[/shirt/i, 0xa4472f], [/pants/i, 0x3a3f4c], [/hair/i, 0x6a6258]] },
  toma:  { file: 'worker',            height: 1.50, colors: [[/shirt/i, 0x3f8f7a], [/pants/i, 0x6b4a35], [/hair/i, 0xb07a3a]] },
};

// logical action -> clip name patterns (first match wins; names are compared without the "Armature|" prefix)
const CLIP = {
  idle:   [/^idle$/i, /^man_idle$/i, /^idle_neutral$/i, /idle/i],
  walk:   [/^walk$/i, /^man_walk$/i, /walk/i],
  run:    [/^run$/i, /^man_run$/i, /^sprint$/i],
  jump:   [/^jump$/i, /^man_jump$/i],
  fall:   [/^fall$/i],
  wave:   [/^wave$/i, /^emote-yes$/i, /clapping/i, /^interact$/i],
  talk:   [/^interact$/i, /^emote-yes$/i, /^man_standing$/i, /^idle_neutral$/i],
  attack: [/^sword_slash$/i, /^dagger_attack$/i, /^attack-melee-right$/i, /^man_swordslash$/i, /^punch/i],
  dodge:  [/^roll$/i],
  hit:    [/^hitrecieve$/i, /^recievehit$/i],
};
const ALIAS = { sprint: 'run', attack1: 'attack', attack2: 'attack', attack3: 'attack', land: null, interact: 'talk', cheer: 'wave' };

const KIND_RULES = [[/skin/i, 'skin'], [/hair|brow|beard/i, 'hair'], [/metal|gold/i, 'metal'], [/.*/, 'cloth']];
const kindOf = (n) => KIND_RULES.find(([re]) => re.test(n))[1];

export async function createCC0Character(ctx, id, opts = {}) {
  const spec = CC0_CAST[id];
  if (!spec) return null;
  const gltf = await ctx.assets.loadGLTF(DIR + spec.file + '.glb');
  const scene = cloneSkinned(gltf.scene);
  scene.name = `${id}_cc0`;

  const matCache = new Map();
  const toToon = (src) => {
    let m = matCache.get(src);
    if (!m) {
      const kind = kindOf(src.name || '');
      if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
      const recolor = spec.colors?.find(([re]) => re.test(src.name || ''));
      const color = recolor ? new THREE.Color(recolor[1]) : (src.color ? src.color.clone() : new THREE.Color(0xffffff));
      m = createToonMaterial({ color, map: src.map || null, kind, side: src.side });
      m.name = src.name;
      matCache.set(src, m);
    }
    return m;
  };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(toToon) : toToon(o.material);
    if (opts.shadows !== false) o.castShadow = true;
  });

  // ---- rest pose: Kenney-style rigs ship a `static` clip holding the standing pose while every other clip
  // only keys the bones it moves. Bake it into the nodes, otherwise un-keyed limbs stay in the splayed bind pose.
  const short = (n) => n.split('|').pop();
  const staticClip = gltf.animations.find((c) => /^static$/i.test(short(c.name)));
  if (staticClip) {
    for (const tr of staticClip.tracks) {
      let parsed;
      try { parsed = THREE.PropertyBinding.parseTrackName(tr.name); } catch { continue; }
      const node = THREE.PropertyBinding.findNode(scene, parsed.nodeName);
      const prop = node && node[parsed.propertyName];
      if (prop && typeof prop.fromArray === 'function') prop.fromArray(tr.values, 0);
    }
    scene.updateMatrixWorld(true);
  }

  // ---- animation
  const mixer = new THREE.AnimationMixer(scene);
  const find = (pats) => { for (const re of pats) { const c = gltf.animations.find((a) => re.test(short(a.name))); if (c) return c; } return null; };
  const actions = {};
  for (const [name, pats] of Object.entries(CLIP)) { const c = find(pats); if (c) actions[name] = mixer.clipAction(c); }
  if (!actions.run && actions.walk) actions.run = actions.walk;

  // ---- size: pose the idle frame, measure, then scale to the cast height with the feet on y = 0
  const object = new THREE.Group();
  object.name = `character_${id}`;
  const pivot = new THREE.Group();          // glTF models face +Z; the game's characters face -Z at yaw 0
  pivot.rotation.y = Math.PI;
  object.add(pivot);
  pivot.add(scene);
  if (actions.idle) { actions.idle.play(); mixer.update(0); }
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } else if (o.isMesh) box.expandByObject(o); });
  const rawH = box.max.y - box.min.y;
  if (!(rawH > 0.01 && rawH < 1e4)) throw new Error(`cc0 character ${id}: bad bounds`);
  const height = opts.height ?? spec.height;
  const k = height / rawH;
  pivot.scale.setScalar(k);
  scene.position.y = -box.min.y;

  // ---- natural ground speed of the walk / run cycles (m/s at this character's scale), measured from the
  // feet during their stance phase: playback is then scaled to the real speed so the feet do not slide.
  const feet = [];
  scene.traverse((o) => { if (o.isBone && /foot/i.test(o.name) && !/ik|ctrl|target|pole|roll/i.test(o.name)) feet.push(o); });
  const natural = { walk: 1.6 * (height / 1.75), run: 5.6 * (height / 1.75) };
  const measure = (name, lo, hi) => {
    const a = actions[name];
    if (!a || feet.length < 2) return;
    const T = a.getClip().duration, N = 32, v = new THREE.Vector3();
    if (!(T > 0.1)) return;
    mixer.stopAllAction();
    a.reset().play(); a.setEffectiveWeight(1);
    const P = feet.map(() => []);
    for (let i = 0; i < N; i++) {
      a.time = (i / N) * T; mixer.update(0);
      object.updateMatrixWorld(true);
      feet.forEach((f, j) => { v.setFromMatrixPosition(f.matrixWorld); P[j].push([v.y, v.z]); });
    }
    let sum = 0, n = 0;
    for (const S of P) {
      let y0 = Infinity, y1 = -Infinity;
      for (const [y] of S) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let i = 0; i < N; i++) {
        const b = S[(i + 1) % N];
        if (S[i][0] > y0 + 0.2 * (y1 - y0) || b[0] > y0 + 0.2 * (y1 - y0)) continue;   // foot in the air
        sum += (b[1] - S[i][1]) / (T / N); n++;                                        // planted foot travels back (+Z)
      }
    }
    const sp = n ? sum / n : 0;
    if (sp > lo && sp < hi) natural[name] = sp;
  };
  measure('walk', 0.4, 3.2);
  if (actions.run !== actions.walk) measure('run', 2.0, 10); else natural.run = natural.walk * 2.2;
  mixer.stopAllAction();

  // ---- state machine. Every active action has an explicit weight that moves toward its target and the set is
  // re-normalised each frame: the weights always sum to 1, so interrupted transitions never pop and the mixer
  // never blends toward the bind (T) pose.
  const LOCO_CYCLE = new Set(['walk', 'run']);
  const st = new Map();          // action -> { w, target, fade }
  const want = (a, target, fade) => {
    let e = st.get(a);
    if (!e) { e = { w: 0, target: 0, fade: 0.2 }; st.set(a, e); }
    e.target = target; e.fade = Math.max(0.001, fade);
    return e;
  };
  let base = 'idle', baseAction = null, ambient = null, overlay = null, disposed = false;
  const loco = { speed: 0, grounded: true };
  function setBase(name, fade = 0.2, timeScale = 1) {
    const a = actions[name];
    if (!a) return;
    a.setEffectiveTimeScale(timeScale);
    if (a !== baseAction) {
      const prev = baseAction, e = st.get(a);
      if (!e || e.w <= 0) {
        a.reset().setLoop(THREE.LoopRepeat, Infinity);
        // keep the stride phase when changing gait (walk <-> run): no foot pop mid-step
        if (prev && LOCO_CYCLE.has(name) && LOCO_CYCLE.has(base)) a.time = (prev.time / prev.getClip().duration) % 1 * a.getClip().duration;
        a.play();
      }
      if (prev) want(prev, 0, fade);
      baseAction = a; base = name;
    }
    want(a, overlay ? 0 : 1, fade);
  }
  function refresh() {
    const s = loco.speed;
    const air = !loco.grounded;
    if (air && (actions.fall || actions.jump)) setBase(actions.fall ? 'fall' : 'jump', 0.15);
    else if (air) setBase(base === 'run' || s > 3 ? 'run' : 'idle', 0.15, 0.35);          // no air clip: float the current stride
    else if (s < 0.25) setBase(ambient && actions[ambient] ? ambient : 'idle', 0.25);
    else if (s < Math.min(3.4, (natural.walk + natural.run) * 0.5)) setBase('walk', 0.2, THREE.MathUtils.clamp(s / natural.walk, 0.55, 1.8));
    else setBase('run', 0.2, THREE.MathUtils.clamp(s / natural.run, 0.7, 1.7));
  }
  mixer.addEventListener('finished', (e) => {
    if (e.action !== overlay) return;
    want(overlay, 0, 0.18);       // clamped on its last frame while the locomotion fades back in
    overlay = null;
    refresh();
  });

  const tick = (dt) => {
    if (disposed) return;
    let sum = 0;
    for (const e of st.values()) {
      const r = dt / e.fade;
      e.w = e.target > e.w ? Math.min(e.target, e.w + r) : Math.max(e.target, e.w - r);
      sum += e.w;
    }
    if (sum < 1e-4 && baseAction) { const e = want(baseAction, 1, 0.2); e.w = 1; sum = 1; }
    for (const [a, e] of st) {
      if (e.w <= 0 && e.target <= 0) { a.stop(); st.delete(a); continue; }
      a.setEffectiveWeight(e.w / sum);
    }
    mixer.update(dt);
  };
  let manual = false;
  const updater = (dt) => { if (!manual) tick(dt); };
  if (ctx?.updaters) ctx.updaters.push(updater);
  refresh();
  if (baseAction) st.get(baseAction).w = 1;       // first frame is already fully posed (no bind-pose flash)
  tick(0);

  return {
    id, object, kind: 'cc0', height, model: { kind: 'cc0', scene, height }, mixer,
    play(name, o = {}) {
      const key = name in ALIAS ? ALIAS[name] : name;
      if (!key || !actions[key]) return false;
      if (o.loop || key === 'idle' || key === 'walk' || key === 'run') { ambient = key === 'idle' ? null : key; refresh(); if (o.fade === 0 && baseAction) { for (const [a, e] of st) e.w = a === baseAction ? 1 : 0; } return true; }
      if (key === 'jump' || key === 'fall') return true;      // derived from setLocomotion
      const a = actions[key];
      const fade = o.fade ?? 0.12;
      if (overlay && overlay !== a) want(overlay, 0, fade);
      overlay = a;
      a.reset().setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.setEffectiveTimeScale(o.speed ?? 1);
      a.play();
      want(a, 1, fade);
      if (baseAction && baseAction !== a) want(baseAction, 0, fade);
      return true;
    },
    stop() { ambient = null; if (overlay) { want(overlay, 0, 0.15); overlay = null; } refresh(); },
    setLocomotion(speed, grounded = true) { loco.speed = speed || 0; loco.grounded = grounded !== false; refresh(); },
    update(dt) { manual = true; tick(dt); },
    lookAt() {},
    setExpression() {},
    get current() { return overlay ? 'overlay' : base; },
    get actions() { return Object.keys(actions); },
    get naturalSpeed() { return { ...natural }; },
    resetPhysics() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction(); mixer.uncacheRoot(scene);
      if (ctx?.updaters) { const i = ctx.updaters.indexOf(updater); if (i >= 0) ctx.updaters.splice(i, 1); }
      object.removeFromParent();
      // geometry/textures are shared with the cached glTF (other instances); only per-instance materials go
      for (const m of matCache.values()) m.dispose();
    },
  };
}
