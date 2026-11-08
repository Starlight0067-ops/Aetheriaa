# AETHERIA / Vael Harrow — modular town kit: shared geometry builder for headless Blender 5.2.
# Pieces are built face-by-face per material (flat, toon friendly), get world-scale UVs (1 unit = 1 m,
# scaled per texture at runtime), a baked per-corner ambient-occlusion vertex colour (BVH ray casts,
# optional ground plane) and are exported to GLB with one material slot per surface kind.
# Blender coordinates: Z up, building fronts face -Y (glTF export turns that into +Z, Y up).
import bpy, bmesh, math, random, json, os, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'town')

# material slot names understood by src/world/town/materials.js
MATS = ['roof', 'slate', 'plaster', 'timber', 'stone', 'planks', 'paint', 'glass', 'metal',
        'cloth', 'glow', 'flowers', 'ivy', 'gold', 'water', 'cobble', 'leaf']


def V(x, y=None, z=None):
    if y is None:
        return Vector(x)
    return Vector((x, y, z))


def newell(pts):
    n = Vector((0, 0, 0))
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    if n.length < 1e-12:
        return Vector((0, 0, 1))
    return n.normalized()


def box_uv(p, n):
    ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
    if az >= ax and az >= ay:
        return (p.x, p.y if n.z > 0 else -p.y)
    if ax >= ay:
        return (p.y if n.x < 0 else -p.y, p.z)
    return (p.x if n.y < 0 else -p.x, p.z)


class Builder:
    """Accumulates faces per material. Every face carries per-corner uv, colour and normal."""

    def __init__(self, seed=1):
        self.rng = random.Random(seed)
        self.verts = []
        self.faces = []   # (mat, [vi...], [uv...], col, [normals] or None)
        self.stack = [Matrix.Identity(4)]
        self.lod = 0

    # ---------------------------------------------------------------- transforms
    @property
    def M(self):
        return self.stack[-1]

    def push(self, m):
        self.stack.append(self.M @ m)
        return self

    def pop(self):
        self.stack.pop()

    def at(self, loc=(0, 0, 0), rotz=0.0, scale=None):
        m = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rotz, 4, 'Z')
        if scale is not None:
            m = m @ Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1)))
        return _Ctx(self, m)

    def tp(self, p):
        return self.M @ Vector(p)

    def tn(self, n):
        return (self.M.to_3x3().inverted_safe().transposed() @ Vector(n)).normalized()

    # ---------------------------------------------------------------- faces
    def face(self, mat, pts, uvs=None, col=(1, 1, 1), normals=None, local=True, uvscale=1.0, jitter=0.0):
        P = [self.tp(p) for p in pts] if local else [Vector(p) for p in pts]
        n = newell(P)
        if uvs is None:
            uvs = [tuple(c * uvscale for c in box_uv(p, n)) for p in P]
        if normals is not None and local:
            normals = [self.tn(x) for x in normals]
        if jitter:
            j = 1.0 - self.rng.random() * jitter
            col = (col[0] * j, col[1] * j, col[2] * j)
        base = len(self.verts)
        self.verts.extend(P)
        self.faces.append((mat, list(range(base, base + len(P))), list(uvs), tuple(col), normals))

    def quad(self, mat, a, b, c, d, sub=(1, 1), col=(1, 1, 1), uvs=None, jitter=0.0, uvscale=1.0):
        """a,b,c,d counter-clockwise seen from the front. sub subdivides (along ab, along ad)."""
        nu, nv = sub
        a, b, c, d = Vector(a), Vector(b), Vector(c), Vector(d)
        if nu == 1 and nv == 1:
            self.face(mat, [a, b, c, d], uvs, col, jitter=jitter, uvscale=uvscale)
            return

        def P(u, v):
            return a.lerp(b, u).lerp(d.lerp(c, u), v)

        def UV(u, v):
            if uvs is None:
                return None
            A, Bq, C, D = [Vector(x) for x in uvs]
            return tuple(A.lerp(Bq, u).lerp(D.lerp(C, u), v))
        for i in range(nu):
            for j in range(nv):
                u0, u1, v0, v1 = i / nu, (i + 1) / nu, j / nv, (j + 1) / nv
                fu = None if uvs is None else [UV(u0, v0), UV(u1, v0), UV(u1, v1), UV(u0, v1)]
                self.face(mat, [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], fu, col, jitter=jitter, uvscale=uvscale)

    def cuboid(self, mat, x0, x1, y0, y1, z0, z1, col=(1, 1, 1), skip=(), uv='box', band=None, jitter=0.0, sub=None, uvscale=1.0):
        """Axis aligned box in the current frame. skip: subset of {'-x','+x','-y','+y','-z','+z'}.
        uv='beam' maps u along the longest axis and v into a random plank band (timber texture)."""
        c = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0),
             V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)]
        fl = {'-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7), '-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6),
              '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5)}
        dims = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
        long_axis = dims.index(max(dims))
        b0 = band if band is not None else self.rng.random() * 0.9
        for k, idx in fl.items():
            if k in skip:
                continue
            pts = [c[i] for i in idx]
            uvs = None
            if uv == 'beam':
                uvs = []
                n = newell(pts)
                for p in pts:
                    along = p[long_axis]
                    # cross coordinate: the other axis lying in this face
                    other = [a for a in range(3) if a != long_axis and abs(n[a]) < 0.5]
                    cr = p[other[0]] if other else 0.0
                    uvs.append((along / 2.5, b0 + cr * 0.32))
            if sub and k in ('-y', '+y', '-x', '+x'):
                a, b_, cc, d = pts
                self.quad(mat, a, b_, cc, d, sub=sub, col=col, uvs=uvs, jitter=jitter, uvscale=uvscale)
            else:
                self.face(mat, pts, uvs, col, jitter=jitter, uvscale=uvscale)

    def beam(self, mat, a, b, w=0.18, d=0.18, up=(0, 0, 1), col=(1, 1, 1), band=None):
        """Oriented square beam from a to b (centre line), w across, d along 'up'-perpendicular depth."""
        a, b = Vector(a), Vector(b)
        L = (b - a).length
        if L < 1e-4:
            return
        x = (b - a).normalized()
        upv = Vector(up)
        y = upv.cross(x)
        if y.length < 1e-4:
            y = Vector((0, 1, 0)).cross(x)
        y.normalize()
        z = x.cross(y).normalized()
        m = Matrix(((x.x, y.x, z.x, a.x), (x.y, y.y, z.y, a.y), (x.z, y.z, z.z, a.z), (0, 0, 0, 1)))
        self.push(m)
        self.cuboid(mat, 0, L, -w / 2, w / 2, -d / 2, d / 2, col=col, uv='beam', band=band)
        self.pop()

    def lathe(self, mat, prof, n=12, col=(1, 1, 1), smooth=True, cap_top=False, cap_bot=False, phase=0.0, uvscale=1.0, jitter=0.0):
        """Surface of revolution around local Z. prof: list of (r, z) from bottom to top."""
        ang = [phase + 2 * math.pi * i / n for i in range(n + 1)]
        circ = 2 * math.pi * max(r for r, _ in prof)
        for j in range(len(prof) - 1):
            (r0, z0), (r1, z1) = prof[j], prof[j + 1]
            dr, dz = r1 - r0, z1 - z0
            # profile normal in (r,z): (dz, -dr)
            ln = math.hypot(dz, dr) or 1
            nr, nz = dz / ln, -dr / ln
            vs0 = sum(math.hypot(prof[k + 1][0] - prof[k][0], prof[k + 1][1] - prof[k][1]) for k in range(j))
            vs1 = vs0 + ln
            for i in range(n):
                a0, a1 = ang[i], ang[i + 1]
                pts = [V(r0 * math.cos(a0), r0 * math.sin(a0), z0), V(r0 * math.cos(a1), r0 * math.sin(a1), z0),
                       V(r1 * math.cos(a1), r1 * math.sin(a1), z1), V(r1 * math.cos(a0), r1 * math.sin(a0), z1)]
                uvs = [(i / n * circ, vs0), ((i + 1) / n * circ, vs0), ((i + 1) / n * circ, vs1), (i / n * circ, vs1)]
                uvs = [(u * uvscale, v * uvscale) for u, v in uvs]
                nm = None
                if smooth:
                    nm = [V(nr * math.cos(a0), nr * math.sin(a0), nz), V(nr * math.cos(a1), nr * math.sin(a1), nz),
                          V(nr * math.cos(a1), nr * math.sin(a1), nz), V(nr * math.cos(a0), nr * math.sin(a0), nz)]
                if r0 < 1e-5:
                    pts, uvs = pts[1:], uvs[1:]
                    nm = nm[1:] if nm else None
                elif r1 < 1e-5:
                    pts, uvs = pts[:3], uvs[:3]
                    nm = nm[:3] if nm else None
                self._face_n(mat, pts, uvs, col, nm, jitter)
        if cap_top and prof[-1][0] > 1e-5:
            r, z = prof[-1]
            self._face_n(mat, [V(r * math.cos(a), r * math.sin(a), z) for a in ang[:-1]], None, col, None, 0)
        if cap_bot and prof[0][0] > 1e-5:
            r, z = prof[0]
            self._face_n(mat, [V(r * math.cos(a), r * math.sin(a), z) for a in reversed(ang[:-1])], None, col, None, 0)

    def _face_n(self, mat, pts, uvs, col, nm, jitter):
        self.face(mat, pts, uvs, col, normals=nm, jitter=jitter)

    def cyl(self, mat, r, z0, z1, n=10, col=(1, 1, 1), caps=True, smooth=True, phase=0.0):
        self.lathe(mat, [(r, z0), (r, z1)], n, col, smooth, caps, caps, phase)

    def cone(self, mat, r, z0, z1, n=12, col=(1, 1, 1), smooth=True, phase=0.0, uvscale=1.0):
        self.lathe(mat, [(r, z0), (0.0, z1)], n, col, smooth, False, True, phase, uvscale=uvscale)

    def prism(self, mat, pts2d, z0, z1, col=(1, 1, 1), caps=True, jitter=0.0):
        """Vertical extrusion of a CCW 2D polygon (x,y)."""
        n = len(pts2d)
        for i in range(n):
            (x0, y0), (x1, y1) = pts2d[i], pts2d[(i + 1) % n]
            self.face(mat, [V(x0, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y0, z1)], col=col, jitter=jitter)
        if caps:
            self.face(mat, [V(x, y, z1) for x, y in pts2d], col=col)
            self.face(mat, [V(x, y, z0) for x, y in reversed(pts2d)], col=col)

    def card(self, mat, center, w, h, rotz=0.0, uvrect=(0, 0, 1, 1), col=(1, 1, 1), tilt=0.0, bottom=False):
        """Vertical alpha card (two-sided material at runtime). center = bottom-centre if bottom else top-centre."""
        cx, cy, cz = center
        dx, dy = math.cos(rotz) * w / 2, math.sin(rotz) * w / 2
        tx, ty = -math.sin(rotz) * math.sin(tilt) * h, math.cos(rotz) * math.sin(tilt) * h
        u0, v0, u1, v1 = uvrect
        if bottom:
            z0, z1 = cz, cz + h * math.cos(tilt)
            pts = [V(cx - dx, cy - dy, z0), V(cx + dx, cy + dy, z0), V(cx + dx + tx, cy + dy + ty, z1), V(cx - dx + tx, cy - dy + ty, z1)]
        else:
            z1, z0 = cz, cz - h * math.cos(tilt)
            pts = [V(cx - dx + tx, cy - dy + ty, z0), V(cx + dx + tx, cy + dy + ty, z0), V(cx + dx, cy + dy, z1), V(cx - dx, cy - dy, z1)]
        self.face(mat, pts, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], col)

    # ---------------------------------------------------------------- output
    def tri_count(self):
        return sum(len(f[1]) - 2 for f in self.faces)

    def finish(self, name, ao=True, ground=None, ao_dist=1.6, rays=14, ao_strength=0.85, ao_skip=('glow', 'flowers', 'ivy', 'water')):
        mats_used = []
        for f in self.faces:
            if f[0] not in mats_used:
                mats_used.append(f[0])
        me = bpy.data.meshes.new(name)
        polys = [f[1] for f in self.faces]
        me.from_pydata([tuple(v) for v in self.verts], [], polys)
        me.update()
        for m in mats_used:
            me.materials.append(get_mat(m))
        for i, f in enumerate(self.faces):
            me.polygons[i].material_index = mats_used.index(f[0])
        uv = me.uv_layers.new(name='UVMap')
        colattr = me.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
        # AO
        occl = None
        if ao and len(self.verts):
            occl = bake_ao(self.verts, self.faces, ground, ao_dist, rays, ao_skip)
        loop_normals = []
        li = 0
        for i, f in enumerate(self.faces):
            poly = me.polygons[i]
            fn = newell([self.verts[k] for k in f[1]])
            for c in range(len(f[1])):
                lidx = poly.loop_start + c
                uv.data[lidx].uv = f[2][c]
                a = occl[li] if occl is not None else 1.0
                a = 1.0 - (1.0 - a) * ao_strength
                colattr.data[lidx].color = (f[3][0] * a, f[3][1] * a, f[3][2] * a, 1.0)
                loop_normals.append(tuple(f[4][c]) if f[4] else tuple(fn))
                li += 1
        try:
            me.normals_split_custom_set(loop_normals)
        except Exception as e:
            print('custom normals failed', e)
        me.color_attributes.active_color = colattr
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        return obj


class _Ctx:
    def __init__(self, b, m):
        self.b, self.m = b, m

    def __enter__(self):
        self.b.push(self.m)
        return self.b

    def __exit__(self, *a):
        self.b.pop()


_DIRS = None


def _dirs(k):
    global _DIRS
    if _DIRS and len(_DIRS) == k:
        return _DIRS
    rng = random.Random(7)
    out = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(k):
        # cosine-weighted hemisphere, stratified spiral
        u = (i + 0.5) / k
        r = math.sqrt(u)
        a = i * golden
        out.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0, 1 - u)))))
    _DIRS = out
    return out


def bake_ao(verts, faces, ground, maxd, rays, skip):
    polys = [f[1] for f in faces if f[0] not in skip and f[0] not in ('flowers', 'ivy')]
    tree = BVHTree.FromPolygons([tuple(v) for v in verts], polys, all_triangles=False, epsilon=0.0)
    dirs = _dirs(rays)
    res = []
    for f in faces:
        pts = [verts[k] for k in f[1]]
        n = newell(pts)
        if f[0] in skip:
            res.extend([1.0] * len(pts))
            continue
        t = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))
        t = (t - n * t.dot(n)).normalized()
        bt = n.cross(t)
        ctr = sum(pts, Vector((0, 0, 0))) / len(pts)
        for p in pts:
            o = p.lerp(ctr, 0.06) + n * 0.015
            occ = 0.0
            for d in dirs:
                w = t * d.x + bt * d.y + n * d.z
                hit = tree.ray_cast(o, w, maxd)
                dist = hit[3] if hit[0] is not None else None
                if ground is not None and w.z < -1e-4 and o.z > ground:
                    tg = (ground - o.z) / w.z
                    if tg < maxd and (dist is None or tg < dist):
                        dist = tg
                if dist is not None:
                    occ += 1.0 - (dist / maxd) ** 0.7
            res.append(max(0.0, 1.0 - occ / len(dirs)))
    return res


_MAT_CACHE = {}
_COLORS = {'roof': (0.76, 0.31, 0.16), 'slate': (0.3, 0.45, 0.5), 'plaster': (0.95, 0.9, 0.78), 'timber': (0.35, 0.2, 0.1),
           'stone': (0.6, 0.6, 0.6), 'planks': (0.65, 0.43, 0.2), 'paint': (0.2, 0.55, 0.55), 'glass': (0.3, 0.5, 0.6),
           'metal': (0.15, 0.15, 0.17), 'cloth': (0.8, 0.3, 0.3), 'glow': (1.0, 0.85, 0.5), 'flowers': (0.9, 0.4, 0.6),
           'ivy': (0.3, 0.6, 0.3), 'gold': (0.9, 0.72, 0.35), 'water': (0.3, 0.6, 0.8), 'cobble': (0.6, 0.55, 0.5), 'leaf': (0.35, 0.6, 0.3)}


def get_mat(name):
    if name in _MAT_CACHE:
        return _MAT_CACHE[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    c = _COLORS.get(name, (0.8, 0.8, 0.8))
    m.diffuse_color = (c[0], c[1], c[2], 1)
    _MAT_CACHE[name] = m
    return m


def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    _MAT_CACHE.clear()


def export_glb(filename):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=False,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_materials='EXPORT', export_image_format='NONE', export_animations=False,
                              export_texcoords=True, export_normals=True, export_extras=False,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=16, export_draco_texcoord_quantization=14,
                              export_draco_color_quantization=10, export_draco_normal_quantization=10)
    print('EXPORTED', path, os.path.getsize(path))
    return path


def write_json(filename, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, filename), 'w') as f:
        json.dump(data, f, indent=1)


# ---------------------------------------------------------------- shared detail helpers
def lerp(a, b, t):
    return a + (b - a) * t


GLASS_TOP = (0.62, 0.86, 0.95)
GLASS_BOT = (0.16, 0.3, 0.45)


def glass_pane(b, x0, x1, z0, z1, y):
    """Window glass facing -Y with an anime highlight: light top-left, deep blue bottom."""
    pts = [V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1)]
    # two triangles-ish via a quad with a diagonal band: split into lower dark and upper light quads
    zm = lerp(z0, z1, 0.55)
    b.face('glass', [V(x0, y, z0), V(x1, y, z0), V(x1, y, zm), V(x0, y, zm)], [(0, 0), (1, 0), (1, .5), (0, .5)], GLASS_BOT)
    b.face('glass', [V(x0, y, zm), V(x1, y, zm), V(x1, y, z1), V(x0, y, z1)], [(0, .5), (1, .5), (1, 1), (0, 1)], GLASS_TOP)


FLOWER_RECTS = [(0.0, 0.5, 0.5, 1.0), (0.5, 0.5, 1.0, 1.0), (0.0, 0.0, 0.5, 0.5), (0.5, 0.0, 1.0, 0.5)]
