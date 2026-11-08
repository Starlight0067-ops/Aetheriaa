"""AETHERIA - original anime-style character generator (Blender 5.x, headless).

    blender -b --factory-startup -P blender/scripts/build_characters.py [-- kael lyra ...]

Each character is generated from code: skin-modifier body, sculpted anime head,
procedurally painted eye textures, ribbon hair clumps, layered outfit pieces
with trims and accessories, a named armature with distance-based skin weights,
and keyed animations (Idle, Walk, Run, Attack, Cast, Talk, Jump, Hurt).
Exports one GLB per character to assets/models/characters/.
All designs are original to AETHERIA.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "models", "characters")
os.makedirs(OUT, exist_ok=True)
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


# ============================================================ basic helpers
def srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def lin(h):
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb(h)) + (1.0,)


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def material(name, hexcol, emission=0.0, image=None, clip=False, rough=0.7):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = lin(hexcol)
    b.inputs["Roughness"].default_value = rough
    if emission:
        b.inputs["Emission Color"].default_value = lin(hexcol)
        b.inputs["Emission Strength"].default_value = emission
    if image is not None:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        if clip:
            r = nt.nodes.new("ShaderNodeMath")
            r.operation = "ROUND"
            nt.links.new(t.outputs["Alpha"], r.inputs[0])
            nt.links.new(r.outputs[0], b.inputs["Alpha"])
    return m


def set_mat(o, m, smooth=True):
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = smooth


def bake(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    o.modifiers.clear()
    old = o.data
    o.data = me
    bpy.data.meshes.remove(old)


def mesh_obj(name, verts, faces, m, uvs=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    if uvs:
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    o = link(bpy.data.objects.new(name, me))
    set_mat(o, m, smooth)
    return o


def apply_xform(o):
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)


def prim(kind, name, m, loc=(0, 0, 0), scale=(1, 1, 1), rot=None, **kw):
    getattr(bpy.ops.mesh, "primitive_%s_add" % kind)(location=(0, 0, 0), **kw)
    o = bpy.context.active_object
    o.name = name
    mat_r = rot if rot is not None else Matrix.Identity(4)
    o.matrix_world = Matrix.Translation(Vector(loc)) @ mat_r @ Matrix.Diagonal(Vector(scale).to_4d())
    apply_xform(o)
    set_mat(o, m, kind != "cube")
    return o


def look_rot(direction):
    """Rotation matrix taking +Z to direction."""
    return Vector((0, 0, 1)).rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()


def ring(name, m, center, R, r, rot=None, scale=(1, 1, 1)):
    return prim("torus", name, m, center, scale, rot, major_radius=R, minor_radius=r, major_segments=28, minor_segments=6)


def sphere(name, m, center, scale, seg=12):
    return prim("uv_sphere", name, m, center, scale, None, segments=seg, ring_count=max(6, seg // 2), radius=1.0)


def cyl(name, m, start, end, r1, r2, verts=10):
    s, e = Vector(start), Vector(end)
    return prim("cone", name, m, (s + e) / 2, (1, 1, 1), look_rot(e - s), vertices=verts, radius1=r1, radius2=r2, depth=(e - s).length)


def box(name, m, center, size, rot=None):
    return prim("cube", name, m, center, (size[0] / 2, size[1] / 2, size[2] / 2), rot, size=2.0)


def gem(name, m, center, s):
    v = [(0, 0, s * 1.4), (s, 0, 0), (0, s, 0), (-s, 0, 0), (0, -s, 0), (0, 0, -s * 1.4)]
    f = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)]
    return mesh_obj(name, [Vector(p) + Vector(center) for p in v], f, m, smooth=False)


def skin(name, nodes, edges, m, subdiv=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata([n[0] for n in nodes], edges, [])
    o = link(bpy.data.objects.new(name, me))
    mod = o.modifiers.new("Skin", "SKIN")
    mod.use_smooth_shade = True
    mod.branch_smoothing = 0.5
    sv = me.skin_vertices[0].data
    for i, n in enumerate(nodes):
        sv[i].radius = n[1]
        sv[i].use_root = i == 0
    if subdiv:
        o.modifiers.new("Sub", "SUBSURF").levels = subdiv
    bake(o)
    set_mat(o, m)
    return o


def drape(name, m, profile, a0=0.0, a1=360.0, cols=32, rows=10, depth=0.78, wave=0.0, hem_wave=0.0, thick=0.007, cy=0.0, cx=0.0):
    """Cloth sheet around the body axis. profile: [(z, radius), ...] top->bottom.
    Angle 0 = front (-Y), 90 = character's left (+X)."""
    full = (a1 - a0) >= 359.9
    ncol = cols if full else cols + 1
    zs = [p[0] for p in profile]
    verts = []
    for i in range(rows + 1):
        t = i / rows
        z = zs[0] + (zs[-1] - zs[0]) * t
        # piecewise-linear radius lookup
        r = profile[-1][1]
        for (z0, r0), (z1, r1) in zip(profile[:-1], profile[1:]):
            if z1 <= z <= z0:
                k = (z0 - z) / max(z0 - z1, 1e-6)
                r = r0 + (r1 - r0) * k
                break
        for j in range(ncol):
            a = math.radians(a0 + (a1 - a0) * j / cols)
            rr = r * (1.0 + wave * math.sin(a * 7.0) * t)
            zz = z + hem_wave * math.sin(a * 5.0) * t ** 3
            verts.append((cx + math.sin(a) * rr, cy - math.cos(a) * rr * depth, zz))
    faces = []
    for i in range(rows):
        for j in range(cols):
            j2 = (j + 1) % ncol if full else j + 1
            faces.append((i * ncol + j, (i + 1) * ncol + j, (i + 1) * ncol + j2, i * ncol + j2))
    o = mesh_obj(name, verts, faces, m)
    sol = o.modifiers.new("Sol", "SOLIDIFY")
    sol.thickness = thick
    bake(o)
    set_mat(o, m)
    return o


# ============================================================ eye texture (procedural paint)
def eye_image(name, iris_hex, lash_hex, size=160):
    img = bpy.data.images.new(name, size, size, alpha=True)
    ir = srgb(iris_hex)
    la = srgb(lash_hex)
    px = [0.0] * (size * size * 4)
    cu, cv, ru, rv = 0.52, 0.45, 0.25, 0.31
    for yy in range(size):
        v = (yy + 0.5) / size
        for xx in range(size):
            u = (xx + 0.5) / size
            s = math.sin(math.pi * min(max(u, 0.0), 1.0))
            yt = 0.42 + 0.38 * s ** 0.7 + 0.07 * u
            yb = 0.36 - 0.22 * s ** 1.4 + 0.05 * u
            col = None
            if yb < v < yt and 0.03 < u < 0.97:
                shade = 1.0 - 0.3 * max(0.0, (v - (yt - 0.15)) / 0.15)
                col = (0.98 * shade, 0.96 * shade, 0.97 * shade, 1.0)
                d = math.hypot((u - cu) / ru, (v - cv) / rv)
                if d < 1.0:
                    t = min(max((v - (cv - rv)) / (2 * rv), 0.0), 1.0)
                    k = 1.3 - 0.9 * t
                    c = [min(1.0, ch * k + 0.04 * (1 - t)) for ch in ir]
                    if d > 0.8:
                        c = [ch * 0.5 for ch in c]
                    elif 0.5 < d < 0.8 and v < cv:
                        c = [min(1.0, ch * 1.25 + 0.06) for ch in c]
                    if math.hypot((u - cu) / (ru * 0.42), (v - cv - 0.02) / (rv * 0.48)) < 1.0:
                        c = [ir[0] * 0.12, ir[1] * 0.12, ir[2] * 0.16]
                    if math.hypot((u - cu + 0.07) / 0.075, (v - cv - 0.11) / 0.095) < 1.0:
                        c = [1.0, 1.0, 1.0]
                    if math.hypot((u - cu - 0.085) / 0.035, (v - cv + 0.13) / 0.04) < 1.0:
                        c = [1.0, 1.0, 1.0]
                    col = (c[0], c[1], c[2], 1.0)
            th = 0.055 + 0.05 * u
            if -0.01 < u < 1.0 and yt - th < v < yt + 0.02 + 0.015 * u:
                col = (la[0], la[1], la[2], 1.0)
            if 0.82 < u < 1.02 and yt - 0.03 < v < yt + 0.03 + 0.13 * (u - 0.82) / 0.2 and v > yt - 0.03 + 0.3 * (u - 0.82):
                col = (la[0], la[1], la[2], 1.0)
            if u > 0.55 and abs(v - yb) < 0.012:
                col = (la[0], la[1], la[2], 1.0)
            if col:
                i = (yy * size + xx) * 4
                px[i:i + 4] = col
    img.pixels.foreach_set(px)
    img.pack()
    return img


# ============================================================ anatomy
def skeleton(H, build):
    s = H / 1.7
    W = {"male": 1.0, "female": 0.9, "burly": 1.18, "kid": 0.86}[build]
    T = {"male": 1.0, "female": 0.88, "burly": 1.3, "kid": 0.9}[build]
    HW = {"male": 1.0, "female": 1.1, "burly": 1.05, "kid": 0.95}[build]
    J = {
        "pelvis": (0, 0, 0.93), "spine1": (0, 0, 1.05), "chest": (0, 0, 1.20), "upper_chest": (0, 0, 1.33),
        "neck_base": (0, 0, 1.40), "neck_top": (0, 0, 1.47),
    }
    side = {
        "hip": (0.085 * HW, 0, 0.90), "knee": (0.095, -0.01, 0.50), "ankle": (0.10, 0.02, 0.085), "toe": (0.105, -0.12, 0.03),
        "clav": (0.075 * W, 0, 1.355), "shoulder": (0.165 * W, 0, 1.345), "elbow": (0.30 * W, 0.02, 1.155),
        "wrist": (0.41 * W, -0.01, 0.975), "hand": (0.455 * W, -0.03, 0.895), "thumb": (0.43 * W, -0.06, 0.94),
    }
    for k, (x, y, z) in side.items():
        J[k + ".L"] = (x, y, z)
        J[k + ".R"] = (-x, y, z)
    J = {k: Vector(v) * s for k, v in J.items()}
    R = {
        "pelvis": (0.125 * HW, 0.095), "spine1": (0.11 * W, 0.08), "chest": (0.13 * W, 0.09), "upper_chest": (0.135 * W, 0.085),
        "neck_base": (0.055, 0.055), "neck_top": (0.045, 0.045),
        "hip": (0.078 * HW * T, 0.078 * T), "knee": (0.05 * T, 0.05 * T), "ankle": (0.038 * T, 0.038 * T), "toe": (0.03, 0.042),
        "clav": (0.05 * T, 0.05 * T), "shoulder": (0.05 * T, 0.05 * T), "elbow": (0.037 * T, 0.037 * T),
        "wrist": (0.029 * T, 0.026 * T), "hand": (0.03 * T, 0.014 * T), "thumb": (0.012, 0.012),
    }
    R = {k: (v[0] * s, v[1] * s) for k, v in R.items()}
    return J, R, s


def rad(R, name, extra=0.0):
    base = R[name.split(".")[0]]
    return (base[0] + extra, base[1] + extra)


def body_mesh(J, R, m):
    names = ["pelvis", "spine1", "chest", "upper_chest", "neck_base", "neck_top"]
    for sd in ("L", "R"):
        names += ["hip." + sd, "knee." + sd, "ankle." + sd, "toe." + sd,
                  "clav." + sd, "shoulder." + sd, "elbow." + sd, "wrist." + sd, "hand." + sd, "thumb." + sd]
    idx = {n: i for i, n in enumerate(names)}
    nodes = [(J[n], rad(R, n)) for n in names]
    e = [("pelvis", "spine1"), ("spine1", "chest"), ("chest", "upper_chest"), ("upper_chest", "neck_base"), ("neck_base", "neck_top")]
    for sd in ("L", "R"):
        e += [("pelvis", "hip." + sd), ("hip." + sd, "knee." + sd), ("knee." + sd, "ankle." + sd), ("ankle." + sd, "toe." + sd),
              ("upper_chest", "clav." + sd), ("clav." + sd, "shoulder." + sd), ("shoulder." + sd, "elbow." + sd),
              ("elbow." + sd, "wrist." + sd), ("wrist." + sd, "hand." + sd), ("wrist." + sd, "thumb." + sd)]
    return skin("Body", nodes, [(idx[a], idx[b]) for a, b in e], m, 1)


def chain(name, J, R, joints, m, extra, subdiv=1, overrides=None):
    nodes = []
    for j in joints:
        r = rad(R, j, extra)
        if overrides and j in overrides:
            r = overrides[j]
        nodes.append((J[j], r))
    return skin(name, nodes, [(i, i + 1) for i in range(len(nodes) - 1)], m, subdiv)


def make_head(c, hs, m):
    hr = Vector((0.098, 0.106, 0.122)) * hs
    o = sphere("Head", m, (0, 0, 0), (1, 1, 1), seg=28)
    for v in o.data.vertices:
        x, y, z = v.co
        t = max(0.0, -z)
        cheek = 1.0 + 0.06 * math.exp(-((t - 0.3) / 0.22) ** 2)
        nx = x * hr.x * (1.0 - 0.34 * t ** 1.8) * cheek
        ny = y * hr.y
        ny *= (1.0 - 0.28 * t) if y > 0 else (0.93 - 0.08 * t)
        if y < 0 and t > 0.55:
            ny -= 0.012 * hs * (t - 0.55) / 0.45 * max(0.0, 1.0 - abs(x) * 2.2)
        v.co = Vector((nx, ny, z * hr.z)) + Vector(c)
    o.data.update()
    return o, hr


def scalp(hc, hr, th, ph, k=1.04):
    th, ph = math.radians(th), math.radians(ph)
    return Vector((hc.x + math.sin(th) * math.cos(ph) * hr.x * k,
                   hc.y - math.cos(th) * math.cos(ph) * hr.y * k,
                   hc.z + math.sin(ph) * hr.z * k))


def push(p, hc, hr, m=1.08):
    d = Vector(((p.x - hc.x) / hr.x, (p.y - hc.y) / hr.y, (p.z - hc.z) / hr.z))
    L = d.length
    if 1e-6 < L < m:
        d *= m / L
        return Vector((hc.x + d.x * hr.x, hc.y + d.y * hr.y, hc.z + d.z * hr.z))
    return p


def decal(name, bvh, cx, cz, w, h, m, nx=6, nz=4, flip=False, off=0.0016, shape=None):
    verts, uvs, faces = [], [], []
    for j in range(nz + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            dx, dz = (u - 0.5) * w, (v - 0.5) * h
            if shape:
                ax, az = shape(u, v)
                dx += ax
                dz += az
            hit = bvh.ray_cast(Vector((cx + dx, -1.0, cz + dz)), Vector((0, 1, 0)))
            loc, nor = hit[0], hit[1]
            if loc is None:
                loc, nor = Vector((cx + dx, -0.1, cz + dz)), Vector((0, -1, 0))
            verts.append(loc + nor * off)
            uvs.append(((1 - u) if flip else u, v))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    return mesh_obj(name, verts, faces, m, uvs=uvs)


# ============================================================ hair
def clump(name, pts, width, m, hc, tip=0.06, flat=0.36, res=4):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = res
    cu.bevel_depth = width
    cu.bevel_resolution = 1
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    n = len(pts)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
        bp.co = Vector(p)
        t = i / (n - 1)
        bp.radius = max(tip, 1.0 - (t ** 2.2) * (1.0 - tip))
    ob = link(bpy.data.objects.new(name, cu))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    P = [Vector(p) for p in pts]
    for v in me.vertices:
        co = v.co.copy()
        best, bd = P[0], 1e9
        for a, b in zip(P[:-1], P[1:]):
            ab = b - a
            t = max(0.0, min(1.0, (co - a).dot(ab) / max(ab.length_squared, 1e-9)))
            q = a + ab * t
            d = (co - q).length
            if d < bd:
                bd, best = d, q
        radial = best - hc
        radial.z *= 0.35
        if radial.length < 1e-6:
            continue
        radial.normalize()
        along = (co - best).dot(radial)
        v.co = co - radial * along * (1.0 - flat)
    o = link(bpy.data.objects.new(name, me))
    set_mat(o, m)
    return o


def hair_cap(hc, hr, m, front_cut=0.32, low_cut=-0.3):
    o = sphere("HairCap", m, (0, 0, 0), (1, 1, 1), seg=24)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = [v for v in bm.verts if (v.co.y < -front_cut and v.co.z < 0.5) or (v.co.z < low_cut and v.co.y < 0.35) or v.co.z < -0.75]
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    for v in o.data.vertices:
        v.co = Vector((v.co.x * hr.x * 1.11, v.co.y * hr.y * 1.12 + 0.006, v.co.z * hr.z * 1.09 + 0.01)) + hc
    sol = o.modifiers.new("Sol", "SOLIDIFY")
    sol.thickness = 0.006
    bake(o)
    set_mat(o, m)
    return o


def hair_style(style, hc, hr, m, rnd):
    parts = [hair_cap(hc, hr, m, front_cut=0.25 if style in ("bun", "short") else 0.32)]
    C = []   # (points, width)

    def S(th, ph, k=1.12):
        return push(scalp(hc, hr, th, ph, k), hc, hr)

    def bangs(n, spread, tip_ph, w, sweep=0.0, lens=None):
        for i in range(n):
            f = i / (n - 1) if n > 1 else 0.5
            th = -spread + 2 * spread * f
            tp = tip_ph if lens is None else lens[i]
            C.append(([scalp(hc, hr, th * 0.45, 66, 1.02), S(th * 0.8, 38, 1.12), S(th + sweep * 0.5, 12, 1.14),
                       S(th * 1.05 + sweep, tp + rnd.uniform(-3, 3), 1.12)], w))

    def sides(th_list, tip_ph, w, extra_drop=0.0):
        for th in th_list:
            pts = [scalp(hc, hr, th * 0.8, 52, 1.02), S(th, 22, 1.12), S(th * 0.97, -20, 1.14), S(th * 0.93, tip_ph, 1.12)]
            if extra_drop:
                last = pts[-1]
                pts.append(Vector((last.x * 1.05, last.y - 0.01, last.z - extra_drop * 0.5)))
                pts.append(Vector((last.x * 1.0, last.y - 0.02, last.z - extra_drop)))
            C.append((pts, w))

    def back(n, th0, th1, tip_ph, w, drop=0.0, flick=0.03, wavy=0.0):
        for i in range(n):
            th = th0 + (th1 - th0) * i / max(n - 1, 1)
            pts = [scalp(hc, hr, th, 58, 1.02), S(th, 25, 1.13), S(th, -25, 1.14), S(th, tip_ph, 1.16)]
            last = pts[-1]
            out = Vector((last.x - hc.x, last.y - hc.y, 0)).normalized() if (last.xy - hc.xy).length > 1e-4 else Vector((0, 1, 0))
            if drop:
                for k, f in enumerate((0.35, 0.7, 1.0)):
                    wv = wavy * math.sin(f * 7 + i) * 0.5
                    pts.append(Vector((last.x + out.x * (0.02 + 0.04 * f) + wv, max(last.y + out.y * 0.03 * f, 0.07 + 0.0 * f), last.z - drop * f)))
            else:
                pts.append(last + out * flick + Vector((0, 0, -0.01)))
            C.append((pts, w))

    if style == "kael":
        bangs(7, 62, 2, 0.02, sweep=8, lens=[-14, 0, 6, -10, 4, 0, -16])
        sides([78, 96, -78, -96], -62, 0.02)
        back(9, 115, 245, -60, 0.024, flick=0.045)
        for th in (110, 140, 170, 200, 230, 155, 185):
            C.append(([scalp(hc, hr, th, 72, 1.0), S(th, 60, 1.28), S(th + 6, 36, 1.36), S(th + 12, 8, 1.3)], 0.03))
        top = scalp(hc, hr, 0, 88, 1.02)
        C.append(([top, top + Vector((0, -0.015, 0.035)), top + Vector((0, 0.012, 0.055)), top + Vector((0, 0.032, 0.045))], 0.006))
    elif style == "ponytail":
        bangs(6, 55, 0, 0.019, sweep=-10, lens=[-6, 2, 6, 4, -2, -12])
        sides([74, -74], -70, 0.017, extra_drop=0.2)
        back(7, 125, 235, -45, 0.022)
        tie = scalp(hc, hr, 180, 42, 1.06)
        for i in range(11):
            jx = (i - 5) * 0.007
            C.append(([tie, tie + Vector((jx, 0.06, 0.035)), tie + Vector((jx * 1.6, 0.11, -0.12)),
                       tie + Vector((jx * 1.3, 0.1, -0.3)), tie + Vector((jx * 0.6 + 0.01, 0.075, -0.46))], 0.021))
        parts.append(ring("HairTie", material("ORN_brass", "#D9A441", rough=0.4), tie + Vector((0, 0.03, 0.0)), 0.018, 0.008,
                          look_rot((0, 1, 0.2))))
    elif style == "bun":
        sides([70, -70], -40, 0.014)
        back(8, 120, 240, -10, 0.022, flick=0.01)
        bun_c = scalp(hc, hr, 180, 30, 1.25)
        parts.append(sphere("Bun", m, bun_c, (0.045, 0.04, 0.045), seg=12))
        parts.append(ring("BunWrap", m, bun_c, 0.04, 0.012, look_rot((0, 1, 0))))
        parts.append(cyl("HairPin", material("ORN_gold", "#D9A441", rough=0.4), bun_c + Vector((-0.07, 0.0, 0.03)), bun_c + Vector((0.07, 0.01, -0.02)), 0.004, 0.004, 6))
    elif style == "messy":
        bangs(5, 50, 6, 0.02, sweep=12, lens=[-2, 8, 2, 10, -4])
        sides([84, -84], -45, 0.019)
        back(7, 120, 240, -40, 0.024, flick=0.05)
        for i in range(9):
            th = rnd.uniform(-160, 160)
            C.append(([scalp(hc, hr, th, 70, 1.0), S(th, 62, 1.25), S(th + rnd.uniform(-20, 20), 42, 1.3)], 0.026))
    elif style == "short":
        bangs(5, 45, 18, 0.017, sweep=6)
        back(7, 120, 240, -25, 0.02, flick=0.015)
        sides([80, -80], -20, 0.016)
    elif style == "long":
        bangs(6, 58, 2, 0.019, sweep=0, lens=[-14, 0, 4, 4, 0, -14])
        sides([74, 90, -74, -90], -70, 0.019, extra_drop=0.3)
        back(11, 110, 250, -50, 0.025, drop=0.42, wavy=0.03)
    for i, (pts, w) in enumerate(C):
        parts.append(clump("Hair%02d" % i, [Vector(p) for p in pts], w * 1.65, m, hc))
    return parts


def beard(hc, hr, m):
    out = []
    for i, th in enumerate((-95, -70, -45, -20, 0, 20, 45, 70, 95)):
        a = scalp(hc, hr, th, -25, 1.02)
        b = scalp(hc, hr, th * 0.85, -60, 1.1)
        c = Vector((b.x * 0.7, b.y - 0.01, hc.z - hr.z - 0.035 - (0.02 if abs(th) < 30 else 0.0)))
        out.append(clump("Beard%d" % i, [a, b, c], 0.016, m, hc, tip=0.2))
    for sd in (-1, 1):
        a = scalp(hc, hr, sd * 6, -38, 1.06)
        out.append(clump("Moustache%d" % sd, [a, a + Vector((sd * 0.025, -0.008, -0.008)), a + Vector((sd * 0.045, -0.002, -0.025))], 0.008, m, hc))
    return out


# ============================================================ rig, weights, animation
BONES = [("hips", "pelvis", "spine1", None), ("spine", "spine1", "chest", "hips"), ("chest", "chest", "upper_chest", "spine"),
         ("neck", "neck_base", "neck_top", "chest"), ("head", "neck_top", "head_top", "neck")]
for _s in ("L", "R"):
    BONES += [("clav." + _s, "upper_chest", "shoulder." + _s, "chest"), ("upper_arm." + _s, "shoulder." + _s, "elbow." + _s, "clav." + _s),
              ("forearm." + _s, "elbow." + _s, "wrist." + _s, "upper_arm." + _s), ("hand." + _s, "wrist." + _s, "hand." + _s, "forearm." + _s),
              ("thigh." + _s, "hip." + _s, "knee." + _s, "hips"), ("shin." + _s, "knee." + _s, "ankle." + _s, "thigh." + _s),
              ("foot." + _s, "ankle." + _s, "toe." + _s, "shin." + _s)]
ALL = [b[0] for b in BONES]
HEAD = ["head"]
TORSO = ["hips", "spine", "chest", "neck", "clav.L", "clav.R", "upper_arm.L", "upper_arm.R"]
LEGS = ["hips", "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R"]
SKIRT = ["hips", "spine", "chest", "thigh.L", "thigh.R"]
ROBE = ["hips", "spine", "chest", "clav.L", "clav.R", "thigh.L", "thigh.R", "shin.L", "shin.R"]
DAMP = {"thigh.L": 0.3, "thigh.R": 0.3, "shin.L": 0.12, "shin.R": 0.12}


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def weight(o, allowed, segs, damp=None):
    groups = {b: (o.vertex_groups.get(b) or o.vertex_groups.new(name=b)) for b in allowed}
    for v in o.data.vertices:
        p = v.co
        ws = []
        for b in allowed:
            d = seg_dist(p, *segs[b])
            w = 1.0 / (d * d + 0.0004) ** 2
            if damp and b in damp:
                w *= damp[b]
            ws.append((w, b))
        ws.sort(reverse=True)
        top = ws[:3]
        tot = sum(w for w, _ in top)
        for w, b in top:
            groups[b].add([v.index], w / tot, "REPLACE")


def build_armature(J):
    arm = bpy.data.armatures.new("Rig")
    ao = link(bpy.data.objects.new("Armature", arm))
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for name, h, t, parent in BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail, b.roll = J[h], J[t], 0.0
        if parent:
            b.parent = eb[parent]
        eb[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return ao


AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}


def pose(ao, spec):
    for pb in ao.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    for bone, rots in spec.items():
        if bone == "hips_loc":
            continue
        pb = ao.pose.bones[bone]
        q = Quaternion()
        for axis, deg in rots:
            q = Quaternion(AX[axis], math.radians(deg)) @ q
        rest = pb.bone.matrix_local.to_3x3()
        pb.rotation_quaternion = (rest.inverted() @ q.to_matrix() @ rest).to_quaternion()
    if "hips_loc" in spec:
        pb = ao.pose.bones["hips"]
        pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(spec["hips_loc"])


def merge(*dicts):
    out = {}
    for d in dicts:
        for k, v in d.items():
            out[k] = (out.get(k, []) + list(v)) if k != "hips_loc" else v
    return out


def mirror(spec):
    m = {}
    for k, v in spec.items():
        if k == "hips_loc":
            m[k] = v
            continue
        nk = k.replace(".L", ".TMP").replace(".R", ".L").replace(".TMP", ".R")
        m[nk] = [(a, d if a == "X" else -d) for a, d in v]
    return m


def actions(ao):
    rest_arms = {"upper_arm.L": [("Y", 30)], "upper_arm.R": [("Y", -30)], "forearm.L": [("X", -14)], "forearm.R": [("X", -14)]}
    walk_a = {"thigh.L": [("X", -28)], "shin.L": [("X", 6)], "thigh.R": [("X", 22)], "shin.R": [("X", 22)], "foot.R": [("X", -12)],
              "upper_arm.L": [("X", 20)], "upper_arm.R": [("X", -20)], "hips": [("Z", -5)], "chest": [("Z", 6)], "hips_loc": (0, 0, -0.015)}
    walk_b = {"thigh.L": [("X", -4)], "shin.L": [("X", 5)], "thigh.R": [("X", -10)], "shin.R": [("X", 55)], "hips_loc": (0, 0, 0.012)}
    run_a = {"thigh.L": [("X", -55)], "shin.L": [("X", 20)], "thigh.R": [("X", 35)], "shin.R": [("X", 50)], "foot.R": [("X", -20)],
             "upper_arm.L": [("X", 40)], "upper_arm.R": [("X", -45)], "forearm.L": [("X", -70)], "forearm.R": [("X", -80)],
             "spine": [("X", 10)], "hips": [("Z", -8)], "chest": [("Z", 9)], "hips_loc": (0, 0, -0.03)}
    run_b = {"thigh.L": [("X", -10)], "shin.L": [("X", 15)], "thigh.R": [("X", -20)], "shin.R": [("X", 95)],
             "forearm.L": [("X", -75)], "forearm.R": [("X", -75)], "spine": [("X", 10)], "hips_loc": (0, 0, 0.03)}
    base = rest_arms
    A = {
        "Idle-loop": [(1, merge(base, {})), (31, merge(base, {"chest": [("X", -2.5)], "spine": [("X", 1)], "head": [("X", 1.5)], "hips_loc": (0, 0, 0.004)})), (61, merge(base, {}))],
        "Walk-loop": [(1, merge(base, walk_a)), (8, merge(base, walk_b)), (15, merge(base, mirror(walk_a))), (22, merge(base, mirror(walk_b))), (29, merge(base, walk_a))],
        "Run-loop": [(1, merge(base, run_a)), (6, merge(base, run_b)), (11, merge(base, mirror(run_a))), (16, merge(base, mirror(run_b))), (21, merge(base, run_a))],
        "Attack": [(1, merge(base, {})),
                   (5, merge(base, {"upper_arm.R": [("X", -115), ("Z", -25)], "forearm.R": [("X", -35)], "chest": [("Z", 28)], "spine": [("Z", 10)]})),
                   (9, merge(base, {"upper_arm.R": [("X", -35), ("Z", 65)], "forearm.R": [("X", -8)], "chest": [("Z", -32)], "spine": [("Z", -12)],
                                    "thigh.L": [("X", -22)], "shin.L": [("X", 16)], "hips": [("Z", -8)]})),
                   (16, merge(base, {}))],
        "Cast": [(1, merge(base, {})),
                 (6, {"upper_arm.L": [("Y", 12), ("X", -78)], "upper_arm.R": [("Y", -12), ("X", -78)], "forearm.L": [("X", -18)], "forearm.R": [("X", -18)], "chest": [("X", -6)]}),
                 (12, {"upper_arm.L": [("Y", 8), ("X", -82)], "upper_arm.R": [("Y", -8), ("X", -82)], "forearm.L": [("X", -10)], "forearm.R": [("X", -10)], "chest": [("X", -8)]}),
                 (18, merge(base, {}))],
        "Talk-loop": [(1, merge(base, {"upper_arm.R": [("X", -20)], "forearm.R": [("X", -60)]})),
                      (21, merge(base, {"upper_arm.R": [("X", -28)], "forearm.R": [("X", -75)], "head": [("X", 3)]})),
                      (41, merge(base, {"upper_arm.R": [("X", -18)], "forearm.R": [("X", -55)], "head": [("X", -2), ("Z", 4)]})),
                      (61, merge(base, {"upper_arm.R": [("X", -20)], "forearm.R": [("X", -60)]}))],
        "Jump": [(1, {"thigh.L": [("X", -50)], "shin.L": [("X", 70)], "thigh.R": [("X", -18)], "shin.R": [("X", 40)],
                      "upper_arm.L": [("Y", -10)], "upper_arm.R": [("Y", 10)], "forearm.L": [("X", -30)], "forearm.R": [("X", -30)]}),
                 (11, {"thigh.L": [("X", -50)], "shin.L": [("X", 70)], "thigh.R": [("X", -18)], "shin.R": [("X", 40)],
                       "upper_arm.L": [("Y", -14)], "upper_arm.R": [("Y", 14)], "forearm.L": [("X", -30)], "forearm.R": [("X", -30)]})],
        "Hurt": [(1, merge(base, {})), (4, merge(base, {"chest": [("X", -16)], "head": [("X", -12)], "spine": [("X", -6)]})), (10, merge(base, {}))],
    }
    ao.animation_data_create()
    for name, keys in A.items():
        act = bpy.data.actions.new(name)
        ao.animation_data.action = act
        for frame, spec in keys:
            pose(ao, spec)
            for pb in ao.pose.bones:
                pb.keyframe_insert("rotation_quaternion", frame=frame)
                pb.keyframe_insert("location", frame=frame)
        track = ao.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, int(keys[0][0]), act)
        ao.animation_data.action = None
    pose(ao, {})


# ============================================================ characters
def build_character(cid, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    rnd = random.Random(cid)
    J, R, s = skeleton(cfg["height"], cfg["build"])
    hs = cfg.get("head", 1.0) * 1.1 * s ** 0.35
    M = lambda key, hexcol, **kw: material("%s_%s" % (cid.upper(), key), hexcol, **kw)
    SKIN = M("SKIN", cfg["skin"])
    HAIR = M("HAIR", cfg["hair"])
    parts = []          # (object, allowed bones, damping)

    body = body_mesh(J, R, SKIN)
    parts.append((body, ALL, None))
    hc = Vector((0, 0, J["neck_top"].z + 0.105 * hs))
    head, hr = make_head(hc, hs, SKIN)
    J["head_top"] = hc + Vector((0, 0, hr.z))
    parts.append((head, HEAD, None))
    for sd in (-1, 1):
        parts.append((sphere("Ear%d" % sd, SKIN, hc + Vector((sd * hr.x * 0.97, 0.006, -0.012 * hs)), (0.012 * hs, 0.02 * hs, 0.028 * hs), 8), HEAD, None))

    # face decals (eyes painted procedurally, brows, mouth, nose shadow)
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(head, dg)
    eye_img = eye_image("%s_eye" % cid, cfg["eyes"], cfg.get("lash", "#231A26"))
    EYE = material("%s_EYE" % cid.upper(), "#FFFFFF", image=eye_img, clip=True)
    ez = hc.z - 0.014 * hs
    ew, eh = 0.06 * hs * cfg.get("eye_size", 1.0), 0.05 * hs * cfg.get("eye_size", 1.0)
    for sd in (1, -1):
        parts.append((decal("Eye%d" % sd, bvh, sd * 0.041 * hs, ez, ew, eh, EYE, flip=(sd < 0)), HEAD, None))
        brow_shape = (lambda u, v, sd=sd: (0.0, 0.005 * hs * math.sin(math.pi * u) - (0.002 * hs * u if cfg.get("stern") else 0.0)))
        parts.append((decal("Brow%d" % sd, bvh, sd * 0.043 * hs, ez + 0.039 * hs, 0.046 * hs, 0.0065 * hs, HAIR, nx=6, nz=1, flip=(sd < 0), off=0.0022, shape=brow_shape), HEAD, None))
    MOUTH = M("MOUTH", cfg.get("mouth", "#9C4A4A"))
    parts.append((decal("Mouth", bvh, 0.0, hc.z - 0.074 * hs, 0.02 * hs, 0.0035 * hs, MOUTH, nx=6, nz=1,
                        shape=lambda u, v: (0.0, 0.003 * hs * (abs(u - 0.5) * 2) ** 2)), HEAD, None))
    NOSE = M("NOSE", cfg.get("nose", "#E2B39A"))
    parts.append((decal("Nose", bvh, 0.003, hc.z - 0.045 * hs, 0.006 * hs, 0.009 * hs, NOSE, nx=2, nz=2, off=0.0012), HEAD, None))
    if cfg.get("blush"):
        BL = M("BLUSH", "#F2A6A0")
        for sd in (1, -1):
            parts.append((decal("Blush%d" % sd, bvh, sd * 0.05 * hs, hc.z - 0.05 * hs, 0.022 * hs, 0.008 * hs, BL, nx=3, nz=1, off=0.0012), HEAD, None))

    for o in hair_style(cfg["hair_style"], hc, hr, HAIR, rnd):
        parts.append((o, HEAD, None))
    if cfg.get("beard"):
        for o in beard(hc, hr, HAIR):
            parts.append((o, HEAD, None))

    # outfit (character-specific)
    for o, allowed, damp in cfg["outfit"](J, R, s, hc, hr, hs, M):
        parts.append((o, allowed, damp))

    ao = build_armature(J)
    segs = {name: (J[h], J[t]) for name, h, t, _ in BONES}
    for o, allowed, damp in parts:
        weight(o, allowed, segs, damp)
    objs = [p[0] for p in parts]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    with bpy.context.temp_override(active_object=body, selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    body.name = cid
    body.parent = ao
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = ao
    actions(ao)
    bpy.ops.object.select_all(action="DESELECT")
    ao.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = ao
    path = os.path.join(OUT, cid + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=False, export_animations=True, export_animation_mode="NLA_TRACKS")
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print("[AETHERIA] %s exported  tris~%d  verts=%d" % (cid, tris, len(body.data.vertices)))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "projects", "char_%s.blend" % cid))


# ------------------------------------------------------------ outfits
def torso_wear(name, J, R, m, extra):
    names = ["pelvis", "spine1", "chest", "upper_chest", "neck_base", "clav.L", "shoulder.L", "clav.R", "shoulder.R"]
    nodes = [(J[n], rad(R, n, extra)) for n in names]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5), (5, 6), (3, 7), (7, 8)]
    return skin(name, nodes, edges, m, 1)


def pelvis_wear(J, R, m, extra=0.013):
    nodes = [(J["pelvis"], rad(R, "pelvis", extra)), (J["hip.L"], rad(R, "hip", extra)), (J["hip.R"], rad(R, "hip", extra))]
    return skin("PelvisWear", nodes, [(0, 1), (0, 2)], m, 1)


GOLD = "#D9A441"


def outfit_kael(J, R, s, hc, hr, hs, M):
    coat, navy, gold, leather = M("CLOTH_coat", "#2B6E7C"), M("CLOTH_vest", "#222A44"), M("ORN_gold", GOLD, rough=0.35), M("CLOTH_leather", "#5A3B2A")
    out = []
    out.append((torso_wear("Vest", J, R, navy, 0.012), TORSO, None))
    out.append((pelvis_wear(J, R, M("CLOTH_pants", "#252A3D")), LEGS, None))
    out.append((drape("Coat", coat, [(1.385 * s, 0.158 * s), (1.2 * s, 0.155 * s), (1.04 * s, 0.135 * s), (0.95 * s, 0.165 * s), (0.6 * s, 0.27 * s)],
                      a0=28, a1=332, depth=0.74, hem_wave=0.012), SKIRT, DAMP))
    out.append((drape("CoatHem", gold, [(0.632 * s, 0.258 * s), (0.6 * s, 0.276 * s)], a0=28, a1=332, rows=1, depth=0.745), SKIRT, DAMP))
    for sd in ("L", "R"):
        out.append((chain("Sleeve" + sd, J, R, ["clav." + sd, "shoulder." + sd, "elbow." + sd, "wrist." + sd], coat, 0.013,
                          overrides={"wrist." + sd: (0.042 * s, 0.04 * s)}), ALL, None))
        out.append((chain("Glove" + sd, J, R, ["wrist." + sd, "hand." + sd], M("CLOTH_glove", "#2B2530"), 0.006, subdiv=1), ALL, None))
        w = J["wrist." + sd]
        out.append((ring("Cuff" + sd, gold, w + (J["elbow." + sd] - w) * 0.12, 0.043 * s, 0.008 * s, look_rot(J["elbow." + sd] - w)), ALL, None))
        out.append((chain("Pants" + sd, J, R, ["hip." + sd, "knee." + sd, "ankle." + sd], M("CLOTH_pants", "#252A3D"), 0.01), LEGS, None))
        k, a = J["knee." + sd], J["ankle." + sd]
        top = k + (a - k) * 0.12
        out.append((skin("Boot" + sd, [(top, (0.062 * s, 0.062 * s)), (a, (0.052 * s, 0.052 * s)), (J["toe." + sd], (0.042 * s, 0.054 * s))],
                         [(0, 1), (1, 2)], leather, 2), LEGS, None))
        out.append((ring("BootCuff" + sd, M("CLOTH_leather2", "#3E281C"), top + Vector((0, 0, 0.01)), 0.066 * s, 0.014 * s), LEGS, None))
    out.append((cyl("Collar", navy, (0, 0.008, 1.395 * s), (0, 0.008, 1.442 * s), 0.064 * s, 0.07 * s, 14), ["neck", "chest", "head"], None))
    out.append((ring("CollarTrim", gold, (0, 0.008, 1.442 * s), 0.07 * s, 0.005 * s), ["neck", "chest", "head"], None))
    out.append((ring("Belt", leather, (0, 0, 1.0 * s), 0.132 * s, 0.017 * s, None, (1, 0.78, 1)), TORSO, None))
    out.append((box("Buckle", gold, (0, -0.108 * s, 1.0 * s), (0.04 * s, 0.012 * s, 0.032 * s)), TORSO, None))
    out.append((drape("Sash", M("CLOTH_sash", "#EDEBE4"), [(1.0 * s, 0.142 * s), (0.62 * s, 0.17 * s)], a0=62, a1=96, cols=4, rows=6, depth=0.8), SKIRT, DAMP))
    out.append((ring("Strap", leather, (0, 0, 1.2 * s), 0.16 * s, 0.009 * s, Matrix.Rotation(math.radians(32), 4, "Y"), (1, 0.62, 1)), TORSO, None))
    out.append((gem("Pendant", M("GLOW_pendant", "#7FF5FF", emission=4.0), (0, -0.112 * s, 1.27 * s), 0.016 * s), TORSO, None))
    out.append((sphere("Pauldron", coat, J["shoulder.L"] + Vector((0.01, 0, 0.03 * s)), (0.075 * s, 0.07 * s, 0.05 * s)), ["clav.L", "upper_arm.L", "chest"], None))
    out.append((ring("PauldronTrim", gold, J["shoulder.L"] + Vector((0.01, 0, 0.012 * s)), 0.07 * s, 0.007 * s, None, (1, 0.95, 1)), ["clav.L", "upper_arm.L", "chest"], None))
    out.append((gem("Earring", M("GLOW_earring", "#7FF5FF", emission=3.0), hc + Vector((hr.x * 1.0, 0.004, -0.05 * hs)), 0.006 * s), HEAD, None))
    # traveler's blade held in the right hand
    hand, wrist = J["hand.R"], J["wrist.R"]
    d = Vector((0, -0.55, -0.83)).normalized()
    out.append((cyl("Grip", M("CLOTH_grip", "#3A2A20"), hand - d * 0.05, hand + d * 0.06, 0.012, 0.012, 6), ["hand.R"], None))
    out.append((box("Guard", gold, hand + d * 0.065, (0.09 * s, 0.018, 0.02), look_rot(d)), ["hand.R"], None))
    out.append((box("Blade", M("METAL_blade", "#DDE8F2", rough=0.25), hand + d * 0.42, (0.03, 0.007, 0.68), look_rot(d)), ["hand.R"], None))
    out.append((box("BladeRune", M("GLOW_blade", "#7FF5FF", emission=3.0), hand + d * 0.42 + Vector((0, -0.004, 0)), (0.008, 0.004, 0.6), look_rot(d)), ["hand.R"], None))
    return out


def outfit_lyra(J, R, s, hc, hr, hs, M):
    cream, mint, brown, brass = M("CLOTH_dress", "#EFE3C6"), M("CLOTH_mint", "#4FCF9C"), M("CLOTH_leather", "#7A4E32"), M("ORN_brass", GOLD, rough=0.35)
    out = []
    out.append((torso_wear("Bodice", J, R, cream, 0.011), TORSO, None))
    out.append((chain("Corset", J, R, ["spine1", "chest"], brown, 0.02, overrides={"spine1": (0.118 * s, 0.088 * s), "chest": (0.128 * s, 0.094 * s)}), TORSO, None))
    out.append((drape("Skirt", cream, [(1.03 * s, 0.128 * s), (0.95 * s, 0.17 * s), (0.56 * s, 0.27 * s)], depth=0.82, hem_wave=0.015), SKIRT, DAMP))
    out.append((drape("SkirtTrim", mint, [(0.585 * s, 0.262 * s), (0.555 * s, 0.276 * s)], rows=1, depth=0.825), SKIRT, DAMP))
    for sd in ("L", "R"):
        sh = J["shoulder." + sd]
        out.append((sphere("Puff" + sd, cream, sh + (J["elbow." + sd] - sh) * 0.25, (0.062 * s, 0.062 * s, 0.07 * s)), ["clav." + sd, "upper_arm." + sd, "chest"], None))
        out.append((chain("Stocking" + sd, J, R, ["hip." + sd, "knee." + sd, "ankle." + sd], M("CLOTH_stocking", "#3C4656"), 0.005), LEGS, None))
        k, a = J["knee." + sd], J["ankle." + sd]
        top = k + (a - k) * 0.45
        out.append((skin("Boot" + sd, [(top, (0.05 * s, 0.05 * s)), (a, (0.047 * s, 0.047 * s)), (J["toe." + sd], (0.038 * s, 0.05 * s))], [(0, 1), (1, 2)], brown, 2), LEGS, None))
    out.append((chain("Bracer", J, R, ["elbow.L", "wrist.L"], brown, 0.01, subdiv=1), ALL, None))
    out.append((ring("Scarf", mint, (0, 0.004, 1.42 * s), 0.07 * s, 0.022 * s), ["neck", "chest"], None))
    out.append((drape("ScarfTail", mint, [(1.4 * s, 0.09 * s), (1.16 * s, 0.11 * s)], a0=150, a1=190, cols=4, rows=5, depth=1.0), ["chest", "neck"], None))
    out.append((box("Satchel", brown, (-0.16 * s, 0.03 * s, 0.93 * s), (0.05 * s, 0.13 * s, 0.1 * s)), ["hips", "thigh.R"], None))
    out.append((ring("SatchelStrap", brown, (0, 0, 1.15 * s), 0.16 * s, 0.008 * s, Matrix.Rotation(math.radians(-35), 4, "Y"), (1, 0.6, 1)), TORSO, None))
    for i in range(3):
        out.append((sphere("Button%d" % i, brass, (0, -0.103 * s, (1.08 + i * 0.05) * s), (0.007, 0.004, 0.007), 6), TORSO, None))
    # Lanternwright goggles pushed up on the head
    out.append((ring("GoggleBand", M("CLOTH_band", "#4A3426"), hc + Vector((0, 0.004, hr.z * 0.42)), hr.x * 1.13, 0.008,
                     Matrix.Rotation(math.radians(-16), 4, "X"), (1.0, hr.y / hr.x * 1.03, 1.0)), HEAD, None))
    for sd in (-1, 1):
        p = scalp(hc, hr, sd * 22, 50, 1.16)
        out.append((cyl("Goggle%d" % sd, brass, p, p + (p - hc).normalized() * 0.022, 0.021, 0.019, 12), HEAD, None))
        out.append((cyl("Lens%d" % sd, M("GLOW_lens", "#9FF8E8", emission=1.5), p + (p - hc).normalized() * 0.021, p + (p - hc).normalized() * 0.024, 0.016, 0.016, 12), HEAD, None))
    return out


def robe_set(J, R, s, M, main, trim, length=0.05, sleeve_flare=True):
    out = []
    gold = M("ORN_gold", GOLD, rough=0.35)
    out.append((torso_wear("RobeTop", J, R, main, 0.013), TORSO, None))
    out.append((drape("Robe", main, [(1.1 * s, 0.13 * s), (0.95 * s, 0.155 * s), (length * s + 0.02, 0.26 * s)], depth=0.82), ROBE, DAMP))
    out.append((drape("RobeHem", trim, [(length * s + 0.05, 0.255 * s), (length * s + 0.02, 0.265 * s)], rows=1, depth=0.825), ROBE, DAMP))
    for sd in ("L", "R"):
        out.append((chain("RobeSleeve" + sd, J, R, ["clav." + sd, "shoulder." + sd, "elbow." + sd, "wrist." + sd], main, 0.015), ALL, None))
        if sleeve_flare:
            e, w = J["elbow." + sd], J["wrist." + sd]
            out.append((cyl("Bell" + sd, main, e + (w - e) * 0.35, w + (w - e) * 0.05, 0.046 * s, 0.075 * s, 12), ["forearm." + sd], None))
            out.append((ring("BellTrim" + sd, gold, w + (w - e) * 0.05, 0.075 * s, 0.006 * s, look_rot(w - e)), ["forearm." + sd], None))
        out.append((skin("Shoe" + sd, [(J["ankle." + sd], (0.045 * s, 0.045 * s)), (J["toe." + sd], (0.036 * s, 0.05 * s))], [(0, 1)], M("CLOTH_shoe", "#3A2A22"), 2), LEGS, None))
    out.append((ring("Sash", gold, (0, 0, 1.0 * s), 0.14 * s, 0.014 * s, None, (1, 0.8, 1)), TORSO, None))
    return out


def outfit_maren(J, R, s, hc, hr, hs, M):
    main, trim, gold = M("CLOTH_robe", "#5A3A5A"), M("ORN_gold", GOLD, rough=0.35), M("ORN_gold", GOLD, rough=0.35)
    out = robe_set(J, R, s, M, main, trim)
    out.append((drape("Mantle", M("CLOTH_mantle", "#3A2840"), [(1.43 * s, 0.09 * s), (1.36 * s, 0.17 * s), (1.17 * s, 0.22 * s)], depth=0.8), ["chest", "clav.L", "clav.R", "neck"], None))
    out.append((drape("MantleTrim", gold, [(1.19 * s, 0.216 * s), (1.165 * s, 0.226 * s)], rows=1, depth=0.805), ["chest", "clav.L", "clav.R"], None))
    out.append((cyl("OfficeSeal", gold, (0, -0.15 * s, 1.27 * s), (0, -0.162 * s, 1.27 * s), 0.028 * s, 0.028 * s, 16), TORSO, None))
    for sd in (-1, 1):
        out.append((gem("Earring%d" % sd, gold, hc + Vector((sd * hr.x * 1.0, 0.004, -0.055 * hs)), 0.006 * s), HEAD, None))
    return out


def outfit_ostin(J, R, s, hc, hr, hs, M):
    main, white, gold = M("CLOTH_robe", "#9AA7D9"), M("CLOTH_tabard", "#F2EBDD"), M("ORN_gold", GOLD, rough=0.35)
    out = robe_set(J, R, s, M, main, white, length=0.06)
    out.append((drape("Tabard", white, [(1.39 * s, 0.155 * s), (1.0 * s, 0.15 * s), (0.25 * s, 0.24 * s)], a0=-24, a1=24, cols=6, rows=10, depth=0.86), ROBE, DAMP))
    out.append((cyl("Bell", gold, (0, -0.16 * s, 1.24 * s), (0, -0.16 * s, 1.19 * s), 0.008 * s, 0.026 * s, 12), TORSO, None))
    out.append((ring("Hood", M("CLOTH_hood", "#7C88BC"), (0, 0.045 * s, 1.43 * s), 0.085 * s, 0.035 * s, Matrix.Rotation(math.radians(-25), 4, "X")), ["neck", "chest"], None))
    out.append((ring("Rope", M("CLOTH_rope", "#C9A87A"), (0, 0, 0.99 * s), 0.142 * s, 0.01 * s, None, (1, 0.8, 1)), TORSO, None))
    return out


def outfit_toma(J, R, s, hc, hr, hs, M):
    orange, brown, dark = M("CLOTH_jacket", "#E3893F"), M("CLOTH_shorts", "#6B5440"), M("CLOTH_boot", "#4A3426")
    out = []
    out.append((torso_wear("Shirt", J, R, M("CLOTH_shirt", "#E9E2CF"), 0.008), TORSO, None))
    out.append((chain("Jacket", J, R, ["spine1", "chest", "upper_chest", "neck_base"], orange, 0.03), TORSO, None))
    out.append((pelvis_wear(J, R, brown, 0.02), LEGS, None))
    out.append((drape("JacketHem", orange, [(1.08 * s, 0.13 * s), (0.9 * s, 0.17 * s)], a0=20, a1=340, rows=3, depth=0.8), SKIRT, DAMP))
    out.append((sphere("HoodBack", orange, (0, 0.11 * s, 1.40 * s), (0.11 * s, 0.06 * s, 0.07 * s)), ["chest", "neck"], None))
    for sd in ("L", "R"):
        out.append((chain("JSleeve" + sd, J, R, ["clav." + sd, "shoulder." + sd, "elbow." + sd, "wrist." + sd], orange, 0.024), ALL, None))
        w = J["wrist." + sd]
        out.append((ring("Roll" + sd, orange, w + (J["elbow." + sd] - w) * 0.15, 0.05 * s, 0.014 * s, look_rot(J["elbow." + sd] - w)), ALL, None))
        h, k = J["hip." + sd], J["knee." + sd]
        out.append((skin("Shorts" + sd, [(h, rad(R, "hip", 0.02)), (h + (k - h) * 0.6, (0.07 * s, 0.07 * s))], [(0, 1)], brown, 2), LEGS, None))
        a = J["ankle." + sd]
        top = k + (a - k) * 0.4
        out.append((skin("Boot" + sd, [(top, (0.058 * s, 0.058 * s)), (a, (0.056 * s, 0.056 * s)), (J["toe." + sd], (0.048 * s, 0.062 * s))], [(0, 1), (1, 2)], dark, 2), LEGS, None))
    out.append((box("Plaster", M("CLOTH_plaster", "#F3EEE2"), hc + Vector((-0.055 * hs, -0.088 * hs, -0.045 * hs)), (0.022 * hs, 0.004, 0.012 * hs),
                    Matrix.Rotation(math.radians(-20), 4, "Y") @ Matrix.Rotation(math.radians(30), 4, "Z")), HEAD, None))
    return out


def outfit_hesk(J, R, s, hc, hr, hs, M):
    shirt, apron, dark = M("CLOTH_shirt", "#D8CFC0"), M("CLOTH_apron", "#5E4330"), M("CLOTH_boot", "#3A2A20")
    out = []
    out.append((torso_wear("Shirt", J, R, shirt, 0.01), TORSO, None))
    out.append((pelvis_wear(J, R, M("CLOTH_pants", "#3A3530")), LEGS, None))
    for sd in ("L", "R"):
        sh, e = J["shoulder." + sd], J["elbow." + sd]
        out.append((skin("SleeveUp" + sd, [(J["clav." + sd], rad(R, "clav", 0.012)), (sh, rad(R, "shoulder", 0.012)), (sh + (e - sh) * 0.8, rad(R, "elbow", 0.02))], [(0, 1), (1, 2)], shirt, 2), ALL, None))
        out.append((ring("Rolled" + sd, shirt, sh + (e - sh) * 0.8, 0.055 * s, 0.016 * s, look_rot(e - sh)), ALL, None))
        out.append((chain("Glove" + sd, J, R, ["wrist." + sd, "hand." + sd], M("CLOTH_glove", "#4A3426"), 0.012, subdiv=1), ALL, None))
        out.append((chain("Pants" + sd, J, R, ["hip." + sd, "knee." + sd, "ankle." + sd], M("CLOTH_pants", "#3A3530"), 0.012), LEGS, None))
        k, a = J["knee." + sd], J["ankle." + sd]
        top = k + (a - k) * 0.3
        out.append((skin("Boot" + sd, [(top, (0.068 * s, 0.068 * s)), (a, (0.062 * s, 0.062 * s)), (J["toe." + sd], (0.05 * s, 0.064 * s))], [(0, 1), (1, 2)], dark, 2), LEGS, None))
    out.append((drape("Apron", apron, [(1.32 * s, 0.17 * s), (1.0 * s, 0.17 * s), (0.5 * s, 0.22 * s)], a0=-62, a1=62, cols=8, rows=10, depth=0.84), ROBE, DAMP))
    out.append((ring("ApronStrap", apron, (0, 0.02, 1.38 * s), 0.1 * s, 0.01 * s, Matrix.Rotation(math.radians(20), 4, "X")), ["neck", "chest"], None))
    out.append((box("Hammer", M("METAL_iron", "#5A5A66", rough=0.4), (0.17 * s, 0.03, 0.9 * s), (0.04 * s, 0.09 * s, 0.05 * s)), ["hips", "thigh.L"], None))
    return out


def outfit_wenna(J, R, s, hc, hr, hs, M):
    wine, cream, white, green = M("CLOTH_bodice", "#8A3B3B"), M("CLOTH_blouse", "#F2EBDD"), M("CLOTH_apron", "#FAF7F0"), M("CLOTH_scarf", "#4E8A5A")
    out = []
    out.append((torso_wear("Blouse", J, R, cream, 0.01), TORSO, None))
    out.append((chain("Bodice", J, R, ["pelvis", "spine1", "chest"], wine, 0.02), TORSO, None))
    out.append((drape("Skirt", wine, [(1.0 * s, 0.13 * s), (0.92 * s, 0.17 * s), (0.12 * s, 0.27 * s)], depth=0.82, hem_wave=0.012), ROBE, DAMP))
    out.append((drape("Apron", white, [(1.01 * s, 0.148 * s), (0.45 * s, 0.25 * s)], a0=-58, a1=58, cols=8, rows=8, depth=0.84), ROBE, DAMP))
    for sd in ("L", "R"):
        sh, e = J["shoulder." + sd], J["elbow." + sd]
        out.append((sphere("Puff" + sd, cream, sh + (e - sh) * 0.35, (0.07 * s, 0.07 * s, 0.085 * s)), ["clav." + sd, "upper_arm." + sd], None))
        out.append((skin("Shoe" + sd, [(J["ankle." + sd], (0.045 * s, 0.045 * s)), (J["toe." + sd], (0.036 * s, 0.05 * s))], [(0, 1)], M("CLOTH_shoe", "#3A2A22"), 2), LEGS, None))
    out.append((drape("Headscarf", green, [(hc.z + hr.z * 1.12, 0.02), (hc.z + hr.z * 0.6, hr.x * 1.15), (hc.z + hr.z * 0.05, hr.x * 1.2)],
                      a0=40, a1=320, cols=16, rows=6, depth=hr.y / hr.x * 1.02, cy=0.006), HEAD, None))
    out.append((sphere("ScarfKnot", green, hc + Vector((0, hr.y * 1.15, hr.z * 0.15)), (0.028, 0.022, 0.024)), HEAD, None))
    return out


CHARS = {
    "kael":  {"height": 1.70, "build": "male", "skin": "#F1CDB3", "hair": "#D3DDEA", "eyes": "#E8A33C", "hair_style": "kael", "outfit": outfit_kael},
    "lyra":  {"height": 1.62, "build": "female", "skin": "#F2CFB8", "hair": "#2F6A5E", "eyes": "#43B07F", "hair_style": "ponytail", "blush": True, "outfit": outfit_lyra, "eye_size": 1.06},
    "maren": {"height": 1.68, "build": "female", "skin": "#EAC7AA", "hair": "#C9C9D3", "eyes": "#6A86A8", "hair_style": "bun", "stern": True, "outfit": outfit_maren, "eye_size": 0.9},
    "ostin": {"height": 1.74, "build": "male", "skin": "#DDB592", "hair": "#4A3A2A", "eyes": "#5A4A3E", "hair_style": "short", "outfit": outfit_ostin, "eye_size": 0.9},
    "toma":  {"height": 1.36, "build": "kid", "head": 1.1, "skin": "#D9A27C", "hair": "#2A1E18", "eyes": "#B8742E", "hair_style": "messy", "outfit": outfit_toma, "eye_size": 1.1},
    "hesk":  {"height": 1.80, "build": "burly", "skin": "#DDA582", "hair": "#A8452A", "eyes": "#4A3A2A", "hair_style": "short", "beard": True, "stern": True, "outfit": outfit_hesk, "eye_size": 0.85},
    "wenna": {"height": 1.62, "build": "female", "skin": "#EEC4A6", "hair": "#B5602E", "eyes": "#5E9A4A", "hair_style": "long", "blush": True, "outfit": outfit_wenna},
}

for cid, cfg in CHARS.items():
    if ONLY and cid not in ONLY:
        continue
    build_character(cid, cfg)
print("[AETHERIA] characters done")
