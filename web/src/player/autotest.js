// In-page movement/camera test, enabled with ?autotest=walk (or =all). Drives the real input path with synthetic
// DOM events, runs on game time, logs to the console and publishes window.__AETHERIA_TEST = {done, pass, results}.
// Runner: node tools/lock.mjs node src/player/tools/autotest.mjs
import * as THREE from 'three';
import { heightAt } from '../core/layout.js';

export function createAutotest(ctx, getApi, mode) {
  const out = (window.__AETHERIA_TEST = { mode, done: false, pass: false, results: {}, log: [], snapRequest: null, snapDone: null });
  const R = out.results;
  const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); out.log.push(s); console.log('[autotest]', s); };
  const canvas = ctx.renderer.domElement;
  const down = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  const up = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const check = (name, pass, data = {}) => { R[name] = { pass: !!pass, ...data }; log(pass ? 'PASS' : 'FAIL', name, data); };

  let api, P, C, cam, phys, frames = 0, perFrame = null;
  const counts = { jump: 0, dodge: 0, land: 0 };
  const AX = 150, AY = 150, AZ = 200;   // floating test arena (only exists in autotest mode)

  function buildArena() {
    const col = ctx.colliders, scene = ctx.scene;
    const m = new THREE.MeshLambertMaterial({ color: 0xc8b89a }), w = new THREE.MeshLambertMaterial({ color: 0xa87a5a });
    const box = (c, h, rotY = 0, mat = m) => {
      col.push({ kind: 'box', center: c, half: h, rotationY: rotY, tag: 'autotest' });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2), mat);
      mesh.position.set(...c); mesh.rotation.y = rotY; mesh.receiveShadow = mesh.castShadow = true; scene.add(mesh);
    };
    box([AX, AY - 0.5, AZ], [30, 0.5, 30]);                                     // floor
    for (let s = 0; s < 8; s++) box([AX + 8, AY + 0.11 * (s + 1), AZ - 4 - s * 0.45 - 0.225], [2, 0.11 * (s + 1), 0.225], 0, w); // stairs 0.22 rise
    box([AX + 8, AY + 0.88, AZ - 4 - 8 * 0.45 - 2], [2, 0.88, 2], 0, w);        // landing
    box([AX - 12, AY + 2.5, AZ], [6, 2.5, 0.3], 0, w);                         // camera wall
    const ramp = (x, deg, name) => {                                             // ramps as trimesh descriptors
      const len = 6, a = (deg * Math.PI) / 180;
      const g = new THREE.BoxGeometry(3, 0.3, len);
      const mesh = new THREE.Mesh(g, w);
      mesh.position.set(x, AY + Math.sin(a) * len / 2 - 0.1, AZ - 4 - Math.cos(a) * len / 2);
      mesh.rotation.x = a; mesh.name = name; scene.add(mesh); mesh.updateMatrixWorld(true);
      col.push({ kind: 'mesh', object: mesh, tag: name });
    };
    ramp(AX + 16, 60, 'steep-ramp');
    ramp(AX + 22, 24, 'gentle-ramp');
  }

  const until = (fn, timeout = 5) => ({ until: fn, timeout });
  const tap = function* (code) { down(code); yield 0.05; up(code); };
  const feetDev = () => P.position.y - heightAt(P.position.x, P.position.z);
  const spd = () => Math.hypot(P.actualVelocity.x, P.actualVelocity.z);
  const place = function* (x, z, yaw = 0, y = null) {
    P.teleport(x, y, z, yaw); cam.yaw = yaw; cam.elev = cam.settings.defaultElev; cam.snap();
    yield until(() => P.grounded && P.mode === 'ground', 2); yield 0.25;
  };
  const snap = function* (name) { out.snapRequest = name; yield until(() => out.snapDone === name, 15); out.snapRequest = null; };

  function* script() {
    yield until(() => phys.pending === 0 && frames > 20, 8);
    yield 0.6;
    // A. spawn
    const p0 = P.position.clone();
    const camDir = new THREE.Vector3(); ctx.camera.getWorldDirection(camDir);
    check('spawn', P.grounded && Math.abs(feetDev()) < 0.2 && Math.abs(P.facing) < 0.05 && ctx.camera.position.z > p0.z + 2 && camDir.z < -0.5,
      { pos: [r3(p0.x), r3(p0.y), r3(p0.z)], grounded: P.grounded, feetMinusTerrain: r3(feetDev()), facing: r3(P.facing),
        camera: ctx.camera.position.toArray().map(r3), camDirZ: r3(camDir.z), character: api.visual.isPlaceholder ? 'placeholder' : 'kael' });
    yield* snap('spawn');

    // B. run on terrain
    let maxDev = 0, airFrames = 0, n = 0;
    perFrame = () => { maxDev = Math.max(maxDev, Math.abs(feetDev())); if (!P.grounded) airFrames++; n++; };
    down('KeyW'); yield 1.6;
    const runSpeedTerrain = spd();
    up('KeyW'); yield 0.6; perFrame = null;
    const p1 = P.position.clone();
    check('terrain_run', p1.z < p0.z - 6 && maxDev < 0.3 && airFrames <= 2,
      { from: [r3(p0.x), r3(p0.z)], to: [r3(p1.x), r3(p1.y), r3(p1.z)], speed: r3(runSpeedTerrain), maxFeetDeviation: r3(maxDev), airFrames, frames: n });

    // C. jump on terrain
    let maxUp = 0, sawAir = false; const y0 = P.position.y, j0 = counts.jump;
    perFrame = () => { maxUp = Math.max(maxUp, P.position.y - y0); if (P.mode === 'air') sawAir = true; };
    yield* tap('Space');
    yield until(() => P.mode === 'ground' && P.grounded && sawAir, 3); perFrame = null;
    check('jump', counts.jump === j0 + 1 && sawAir && maxUp > 1.0 && maxUp < 1.6 && P.grounded, { height: r3(maxUp), grounded: P.grounded });

    // C2. look-up camera stays above the terrain
    cam.elev = cam.settings.minElev; yield 0.5;
    const cp = ctx.camera.position;
    check('camera_terrain', cp.y > heightAt(cp.x, cp.z) + 0.1, { cameraY: r3(cp.y), terrainY: r3(heightAt(cp.x, cp.z)) });
    cam.elev = cam.settings.defaultElev;

    // D. fall-through protection
    const rs = P.respawns, q = P.position;
    P.setColliderFeet(q.x, heightAt(q.x, q.z) - 3, q.z);
    yield 0.1;
    check('no_fall_through', P.respawns > rs && feetDev() > -0.2, { respawns: P.respawns - rs, feetMinusTerrain: r3(feetDev()) });

    // E. arena (incremental collider polling)
    const before = phys.stats.colliders;
    buildArena();
    yield until(() => phys.pending === 0, 3); yield 0.05;
    check('incremental_colliders', phys.stats.colliders >= before + 13, { before, after: phys.stats.colliders });
    yield* place(AX, AZ + 10, 0);
    check('arena_grounded', P.grounded && Math.abs(P.position.y - AY) < 0.1, { y: r3(P.position.y) });

    // F/G. run + sprint speeds, stamina
    down('KeyW'); yield 1.2; const vRun = spd();
    down('ShiftLeft'); const st0 = P.stamina.value; yield 1.5; const vSprint = spd(); const st1 = P.stamina.value; const fovSprint = ctx.camera.fov;
    up('ShiftLeft'); up('KeyW'); yield 0.8;
    check('run_speed', Math.abs(vRun - P.tuning.runSpeed) < 0.3, { speed: r3(vRun) });
    check('sprint_speed', Math.abs(vSprint - P.tuning.sprintSpeed) < 0.4 && st1 < st0 - 15, { speed: r3(vSprint), staminaBefore: r3(st0), staminaAfter: r3(st1), fov: r3(fovSprint) });
    check('stops', spd() < 0.05, { speed: r3(spd()) });

    // H. dodge (Ctrl), cooldown, dodge (right mouse)
    yield* place(AX, AZ + 10, 0);
    yield 1.0;
    let d0 = P.position.clone(), c0 = counts.dodge;
    down('KeyW'); yield 0.02; yield* tap('ControlLeft'); up('KeyW');
    yield 0.32;
    const dist = Math.hypot(P.position.x - d0.x, P.position.z - d0.z);
    yield* tap('ControlLeft');            // within cooldown: must not dodge
    const blocked = counts.dodge === c0 + 1;
    yield 0.7;
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
    yield 0.05; window.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }));
    yield 0.5;
    check('dodge', dist > 3.4 && dist < 5.5 && blocked && counts.dodge === c0 + 2,
      { distance: r3(dist), cooldownBlocked: blocked, dodges: counts.dodge - c0 });

    // I. turning toward input
    yield* place(AX, AZ + 10, 0);
    down('KeyD'); yield 0.45; up('KeyD'); yield 0.3;
    { const exp = Math.atan2(Math.sin(cam.yaw - Math.PI / 2), Math.cos(cam.yaw - Math.PI / 2)); check('turn', Math.abs(Math.atan2(Math.sin(P.facing - exp), Math.cos(P.facing - exp))) < 0.15, { facing: r3(P.facing), expected: r3(exp) }); }

    // J. stairs (autostep 0.22 m)
    yield* place(AX + 8, AZ - 2, 0);
    const sy = P.position.y; down('KeyW'); yield 2.0; up('KeyW'); yield 0.3;
    check('stairs', P.position.y - sy > 1.6, { climbed: r3(P.position.y - sy), expected: 1.76 });

    // K/L. slope limit on trimesh ramps
    yield* place(AX + 16, AZ - 2, 0);
    let ry = P.position.y; down('KeyW'); yield 1.6; up('KeyW'); yield 0.4;
    const steepGain = P.position.y - ry;
    yield* place(AX + 22, AZ - 2, 0);
    ry = P.position.y; down('KeyW'); yield 1.6; up('KeyW'); yield 0.3;
    const gentleGain = P.position.y - ry;
    check('slope_limit', steepGain < 0.6 && gentleGain > 1.5, { steep60Gain: r3(steepGain), gentle24Gain: r3(gentleGain) });

    // M. jump buffering: press jump shortly before touching down
    yield* place(AX - 5, AZ + 10, 0);
    let jb = counts.jump; yield* tap('Space');
    yield until(() => P.velocity.y < 0 && P.position.y - AY < 0.3, 2);
    yield* tap('Space');
    yield until(() => counts.jump >= jb + 2, 0.4);
    check('jump_buffer', counts.jump === jb + 2, { jumps: counts.jump - jb });
    yield until(() => P.mode === 'ground', 3); yield 0.3;

    // N. coyote time: run off the edge, jump just after leaving it
    yield* place(AX, AZ - 27, 0);
    jb = counts.jump; down('KeyW');
    yield until(() => P.mode === 'air', 3);
    yield 0.07;
    yield* tap('Space'); up('KeyW');
    check('coyote', counts.jump === jb + 1, { jumps: counts.jump - jb });
    yield 0.6;

    // O. camera collision: wall right behind the player, camera wants to be behind it
    yield* place(AX - 12, AZ - 1.6, 0);
    cam.zoomTarget = cam.zoom = 6; yield 0.6;
    const cz = ctx.camera.position.z, wallFace = AZ - 0.3;
    const piv = cam.target.clone(), toCam = ctx.camera.position.clone().sub(piv);
    const blockedRay = phys.raycast(piv, toCam, toCam.length(), { groups: phys.QUERY.CAMERA });
    check('camera_collision', cz < wallFace - 0.05 && !blockedRay, { cameraZ: r3(cz), wallFaceZ: wallFace, camDistance: r3(cam.dist), lineOfSightClear: !blockedRay });
    yield* snap('camera_wall');
    cam.zoomTarget = cam.settings.distance;

    // P. performance
    const ms = phys.stats;
    check('perf', ms.frameMs < 2, { physicsFrameMsAvg: r3(ms.frameMs), physicsFrameMsMax: r3(ms.frameMsMax), stepMs: r3(ms.stepMs), kccMs: r3(P.debug.kccMs), colliders: ms.colliders, fps: Math.round(window.__AETHERIA_FPS || 0) });
  }

  let gen = null, waitT = 0, cond = null;
  function finish(err) {
    out.done = true;
    out.pass = !err && Object.values(R).every((r) => r.pass);
    if (err) { out.error = String(err && err.stack || err); log('ERROR', out.error); }
    log('DONE pass=' + out.pass);
  }
  return {
    update(dt) {
      if (out.done) return;
      if (!gen) {
        api = getApi(); if (!api) return;
        P = api.controller; cam = api.camera; phys = api.physics;
        for (const k of Object.keys(counts)) P.on(k, () => counts[k]++);
        gen = script();
      }
      frames++;
      perFrame?.();
      if (cond) { cond.timeout -= dt; if (!cond.until() && cond.timeout > 0) return; cond = null; }
      else if (waitT > 0) { waitT -= dt; if (waitT > 0) return; }
      try {
        const r = gen.next();
        if (r.done) finish();
        else if (typeof r.value === 'number') waitT = r.value;
        else if (r.value && r.value.until) cond = { ...r.value };
      } catch (e) { finish(e); }
    },
  };
}
