// AETHERIA — physics world (owner: player/physics). Rapier 3D (compat build, wasm inlined).
// Builds static colliders from ctx.colliders descriptors, polls for descriptors pushed after boot,
// and offers ray / shape-cast helpers for the camera and gameplay.
//
// Descriptor kinds (see docs/ARCHITECTURE.md):
//   {kind:'heightfield', heightAt, size, resolution}        grid centred at the origin (resolution = cells per side)
//   {kind:'box', center:[x,y,z], half:[x,y,z], rotationY}
//   {kind:'mesh', object}                                    trimesh from world-space geometry (Mesh / InstancedMesh)
// Extensions (optional, backwards compatible):
//   {kind:'sphere', center, radius} · {kind:'capsule'|'cylinder', center, radius, halfHeight, rotationY}
//   any descriptor: camera:false (does not block the camera, e.g. thin posts) · player:false (camera-only blocker,
//   e.g. foliage canopies) · tag:'any string' (returned by queries as hit.tag) · center for heightfield: [x,z].
//   Mesh children with userData.collider === false are skipped.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const GROUP = { STATIC: 0x0001, PLAYER: 0x0002, CAMERA_ONLY: 0x0004, PLAYER_ONLY: 0x0008, CAMERA: 0x0010, DYNAMIC: 0x0020 };
export const groups = (membership, filter) => (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
/** Query filters: what the camera / the player collide with. */
export const QUERY = {
  CAMERA: groups(GROUP.CAMERA, GROUP.STATIC | GROUP.CAMERA_ONLY),
  PLAYER: groups(GROUP.PLAYER, GROUP.STATIC | GROUP.PLAYER_ONLY),
  WORLD: groups(0xffff, GROUP.STATIC | GROUP.PLAYER_ONLY | GROUP.CAMERA_ONLY),
};

let initPromise = null;
const ID_ROT = { x: 0, y: 0, z: 0, w: 1 };
const v3 = (a) => (Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : a ? { x: a.x, y: a.y, z: a.z } : { x: 0, y: 0, z: 0 });
const quatY = (a) => ({ x: 0, y: Math.sin((a || 0) / 2), z: 0, w: Math.cos((a || 0) / 2) });

export async function createPhysics(ctx, opts = {}) {
  if (!initPromise) initPromise = RAPIER.init();
  await initPromise;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const built = new Map();      // descriptor -> Collider[]
  const tagOf = new Map();      // collider handle -> descriptor
  const queue = [];
  let lastLen = -1, lastList = null, dirty = true, triangles = 0;
  const stats = { colliders: 0, triangles: 0, pending: 0, stepMs: 0, buildMs: 0, frameMs: 0, frameMsMax: 0 };

  function membershipFor(desc) {
    const cam = desc.camera !== false, ply = desc.player !== false;
    if (cam && ply) return GROUP.STATIC;
    if (ply) return GROUP.PLAYER_ONLY;
    if (cam) return GROUP.CAMERA_ONLY;
    return 0;
  }

  function finish(desc, cd) {
    const m = membershipFor(desc);
    if (!m) return null;
    cd.setCollisionGroups(groups(m, 0xffff)).setFriction(0.8);
    const c = world.createCollider(cd);
    tagOf.set(c.handle, desc);
    return c;
  }

  function buildHeightfield(desc) {
    const size = desc.size || 800;
    const res = Math.max(2, Math.round(desc.resolution || 256));
    const n = res + 1, half = size / 2;
    const cx = desc.center ? desc.center[0] : 0, cz = desc.center ? desc.center[1] : 0;
    const heights = new Float32Array(n * n);
    // Rapier: column j runs along +X, row i along +Z, column-major storage.
    for (let j = 0; j < n; j++) {
      const x = cx - half + (j / res) * size;
      for (let i = 0; i < n; i++) heights[j * n + i] = desc.heightAt(x, cz - half + (i / res) * size);
    }
    triangles += res * res * 2;
    const cd = RAPIER.ColliderDesc.heightfield(res, res, heights, { x: size, y: 1, z: size }, RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES)
      .setTranslation(cx, 0, cz);
    return [finish(desc, cd)];
  }

  function buildBox(desc) {
    const c = v3(desc.center), h = v3(desc.half);
    const cd = RAPIER.ColliderDesc.cuboid(Math.max(0.01, h.x), Math.max(0.01, h.y), Math.max(0.01, h.z))
      .setTranslation(c.x, c.y, c.z).setRotation(quatY(desc.rotationY));
    return [finish(desc, cd)];
  }

  function buildPrimitive(desc) {
    const c = v3(desc.center), r = desc.radius || 0.5, hh = desc.halfHeight || 0.5;
    const cd = desc.kind === 'sphere' ? RAPIER.ColliderDesc.ball(r)
      : desc.kind === 'capsule' ? RAPIER.ColliderDesc.capsule(hh, r) : RAPIER.ColliderDesc.cylinder(hh, r);
    cd.setTranslation(c.x, c.y, c.z).setRotation(quatY(desc.rotationY));
    return [finish(desc, cd)];
  }

  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();
  function buildMesh(desc) {
    const obj = desc.object;
    if (!obj) return [];
    obj.updateWorldMatrix(true, true);
    const verts = [], idx = [];
    let base = 0;
    obj.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.userData?.collider === false) return;
      const g = o.geometry, pos = g?.attributes?.position;
      if (!pos) return;
      const index = g.index;
      const count = o.isInstancedMesh ? o.count : 1;
      for (let k = 0; k < count; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, _mi); _m.multiplyMatrices(o.matrixWorld, _mi); } else _m.copy(o.matrixWorld);
        for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m); verts.push(_v.x, _v.y, _v.z); }
        if (index) { for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i)); }
        else { for (let i = 0; i < pos.count; i++) idx.push(base + i); }
        base += pos.count;
      }
    });
    if (idx.length < 3) return [];
    const tri = Math.floor(idx.length / 3);
    if (tri > 150000) console.warn(`[physics] mesh collider "${obj.name}" has ${tri} triangles — use a low-poly proxy`);
    triangles += tri;
    const vf = new Float32Array(verts), ia = new Uint32Array(idx.slice(0, tri * 3));
    let cd;
    try { cd = RAPIER.ColliderDesc.trimesh(vf, ia, RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES); }
    catch { cd = RAPIER.ColliderDesc.trimesh(vf, ia); }
    return [finish(desc, cd)];
  }

  function build(desc) {
    const t0 = performance.now();
    let list = [];
    try {
      switch (desc && desc.kind) {
        case 'heightfield': list = buildHeightfield(desc); break;
        case 'box': list = buildBox(desc); break;
        case 'mesh': list = buildMesh(desc); break;
        case 'sphere': case 'ball': case 'capsule': case 'cylinder': list = buildPrimitive(desc); break;
        default: console.warn('[physics] unknown collider descriptor', desc);
      }
    } catch (e) { console.warn('[physics] failed to build collider', desc?.kind, e); }
    list = list.filter(Boolean);
    built.set(desc, list);
    stats.buildMs += performance.now() - t0;
    dirty = true;
  }

  function remove(desc) {
    for (const c of built.get(desc) || []) { tagOf.delete(c.handle); world.removeCollider(c, false); }
    built.delete(desc);
    dirty = true;
  }

  /** Pick up new (or removed) descriptors. budgetMs limits build time per frame (large meshes still build whole). */
  function poll(budgetMs = 6) {
    const list = ctx.colliders || [];
    if (list.length !== lastLen || list !== lastList) {
      const present = new Set(list);
      for (const d of list) if (!built.has(d) && !queue.includes(d)) queue.push(d);
      for (const d of [...built.keys()]) if (!present.has(d)) remove(d);
      lastLen = list.length; lastList = list;
    }
    const t0 = performance.now();
    while (queue.length && (budgetMs === Infinity || performance.now() - t0 < budgetMs)) build(queue.shift());
    stats.pending = queue.length;
  }

  function step(dt) {
    const t0 = performance.now();
    world.timestep = Math.max(1 / 240, Math.min(dt || 1 / 60, 1 / 20));
    world.step();   // also refreshes the broad-phase BVH used by every scene query
    dirty = false;
    stats.stepMs = stats.stepMs * 0.9 + (performance.now() - t0) * 0.1;
    stats.colliders = world.colliders.len();
    stats.triangles = triangles;
  }

  // ---------------------------------------------------------------- queries
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  const ball = new RAPIER.Ball(0.2);
  const pack = (collider, distance, ox, oy, oz, dx, dy, dz, n) => ({
    distance, collider,
    point: new THREE.Vector3(ox + dx * distance, oy + dy * distance, oz + dz * distance),
    normal: n ? new THREE.Vector3(n.x, n.y, n.z) : null,
    tag: tagOf.get(collider?.handle)?.tag ?? null,
  });

  /** Closest ray hit. dir need not be normalised. opts: {groups, exclude (Collider), solid, predicate}. */
  function raycast(origin, dir, maxDist, o = {}) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / l, dy = dir.y / l, dz = dir.z / l;
    ray.origin = { x: origin.x, y: origin.y, z: origin.z }; ray.dir = { x: dx, y: dy, z: dz };
    const hit = world.castRayAndGetNormal(ray, maxDist, o.solid ?? true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      o.groups ?? QUERY.WORLD, o.exclude, undefined, o.predicate);
    return hit ? pack(hit.collider, hit.timeOfImpact, origin.x, origin.y, origin.z, dx, dy, dz, hit.normal) : null;
  }

  /** Sweep a sphere of `radius` from origin along dir for maxDist. Initial overlaps are ignored when moving out. */
  function sphereCast(origin, dir, maxDist, radius, o = {}) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / l, dy = dir.y / l, dz = dir.z / l;
    ball.radius = radius;
    const hit = world.castShape({ x: origin.x, y: origin.y, z: origin.z }, ID_ROT, { x: dx, y: dy, z: dz }, ball, 0, maxDist,
      o.stopAtPenetration ?? false, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, o.groups ?? QUERY.WORLD, o.exclude, undefined, o.predicate);
    return hit ? pack(hit.collider, hit.time_of_impact, origin.x, origin.y, origin.z, dx, dy, dz, hit.normal1) : null;
  }

  /** Generic shape-cast with any Rapier shape (e.g. new RAPIER.Capsule(hh, r)). */
  function shapeCast(shape, origin, dir, maxDist, o = {}) {
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / l, dy = dir.y / l, dz = dir.z / l;
    const hit = world.castShape({ x: origin.x, y: origin.y, z: origin.z }, o.rotation ?? ID_ROT, { x: dx, y: dy, z: dz }, shape, 0, maxDist,
      o.stopAtPenetration ?? false, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, o.groups ?? QUERY.WORLD, o.exclude, undefined, o.predicate);
    return hit ? pack(hit.collider, hit.time_of_impact, origin.x, origin.y, origin.z, dx, dy, dz, hit.normal1) : null;
  }

  /** True if the shape placed at `pos` overlaps any collider. */
  function overlap(shape, pos, o = {}) {
    return !!world.intersectionWithShape({ x: pos.x, y: pos.y, z: pos.z }, o.rotation ?? ID_ROT, shape,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, o.groups ?? QUERY.WORLD, o.exclude, undefined, o.predicate);
  }

  /** Highest walkable surface under (x,z) found by a downward ray from fromY. Returns {y, normal} or null. */
  function groundAt(x, z, fromY = 1000, o = {}) {
    const h = raycast({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }, fromY + 1000, { groups: QUERY.PLAYER, ...o });
    return h ? { y: h.point.y, normal: h.normal, tag: h.tag } : null;
  }

  // ---------------------------------------------------------------- debug lines (?physdebug)
  let debugLines = null;
  function setDebug(on) {
    if (!on) { if (debugLines) { debugLines.removeFromParent(); debugLines.geometry.dispose(); debugLines = null; } return; }
    if (!debugLines) {
      debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff40ff, depthTest: true }));
      debugLines.frustumCulled = false; debugLines.renderOrder = 999;
      ctx.scene.add(debugLines);
    }
    const buf = world.debugRender(undefined, (c) => c.shapeType() !== RAPIER.ShapeType.HeightField);
    debugLines.geometry.setAttribute('position', new THREE.BufferAttribute(buf.vertices.slice(), 3));
  }

  // Build everything known at boot synchronously so the player has ground on frame one.
  poll(Infinity);
  step(1 / 60);
  if (ctx.params?.has?.('physdebug')) setDebug(true);

  const api = {
    RAPIER, world, GROUP, QUERY, groups, stats,
    get ready() { return true; },
    get pending() { return queue.length; },
    poll, step, raycast, sphereCast, shapeCast, overlap, groundAt, setDebug,
    descriptorOf: (collider) => tagOf.get(collider?.handle) || null,
    /** Force a step every frame (only needed if someone adds dynamic / kinematic bodies). */
    alwaysStep: false,
    /**
     * Per-frame: add new descriptors, then step only when the static set changed (the step refreshes the BVH that
     * every scene query uses). The character collider is excluded from all queries, so moving it needs no step.
     */
    update(dt) {
      const before = built.size;
      poll(opts.budgetMs ?? 6);
      if (dirty || api.alwaysStep || world.bodies.len() > 0) step(dt);
      else stats.stepMs *= 0.9;
      if (debugLines && built.size !== before) setDebug(true);
    },
  };
  return api;
}

export const create = createPhysics;
