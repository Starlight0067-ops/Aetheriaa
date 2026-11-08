# Vael Harrow half-timbered house generator (headless Blender 5.2).
#   blender -b --factory-startup -P tools/blender/town/houses.py -- [--count N] [--preview out.png]
# Writes public/assets/town/houses.glb (one object per variant, one material slot per surface kind)
# and public/assets/town/houses.json (footprints for the runtime layout).
# House frame: ground-floor front wall on y=0 facing -Y, x centred, back wall at y=D, z up, floor at z=0.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import V, Builder, newell, lerp
from mathutils import Vector, Matrix

ROW_H = 0.22        # exposed tile row (matches roof_tiles.jpg: 10 rows per texture tile)
ROOF_TEX = 2.2      # metres covered by one roof texture tile
BEAM = 0.17         # timber width
BD = 0.065          # timber protrusion from plaster


def face_facing(b, mat, pts, want, uvs=None, col=(1, 1, 1), jitter=0.0):
    P = [b.tp(p) for p in pts]
    n = newell(P)
    w = b.tn(want)
    if n.dot(w) < 0:
        pts = list(reversed(pts))
        uvs = list(reversed(uvs)) if uvs else None
    b.face(mat, pts, uvs, col, jitter=jitter)


# ============================================================== roofs
def gable_roof(b, cx, cy, zt, halfL, halfS, pitch, axis='x', eave=0.45, verge=0.32, mat='roof',
               finial=False, ridge=True, rng=None, T=0.1, bargeboard=True, soffit='timber'):
    """Gable roof over a rectangle. Ridge along local x (axis='x') or world y (axis='y').
    Returns ridge height above zt."""
    rng = rng or random.Random(1)
    tp = math.tan(pitch)
    cp, sp = math.cos(pitch), math.sin(pitch)
    zr = halfS * tp
    rot = 0.0 if axis == 'x' else math.pi / 2
    with b.at((cx, cy, zt), rot):
        uL, uR = -(halfL + verge), halfL + verge
        Ls = (halfS + eave) / cp
        n_rows = max(2, int(math.ceil((Ls - 0.02) / ROW_H)))
        for sgn in (-1, 1):
            ye, ze = sgn * (halfS + eave), -eave * tp
            d = Vector((0, -sgn * cp, sp))
            n = Vector((0, sgn * sp, cp))
            O = Vector((0, ye, ze))

            def P(u, s, t):
                return O + Vector((u, 0, 0)) + d * s + n * t
            lift = 0.05
            for r in range(n_rows if not b.lod else 0):
                s0 = r * ROW_H
                s1 = min(s0 + ROW_H + 0.04, Ls + 0.02)
                if s0 >= Ls:
                    break
                v0 = 0.05 + r * 0.1
                v1 = v0 + (s1 - s0) / ROW_H * 0.1
                ua, ub = uL / ROOF_TEX, uR / ROOF_TEX
                face_facing(b, mat, [P(uL, s0, T + lift), P(uR, s0, T + lift), P(uR, s1, T), P(uL, s1, T)], n,
                            [(ua, v0), (ub, v0), (ub, v1), (ua, v1)], jitter=0.05)
                face_facing(b, mat, [P(uL, s0, T), P(uR, s0, T), P(uR, s0, T + lift), P(uL, s0, T + lift)], -d,
                            [(ua, v0 - 0.012), (ub, v0 - 0.012), (ub, v0), (ua, v0)])
                for u, side in ((uL, -1), (uR, 1)):
                    face_facing(b, mat, [P(u, s0, T), P(u, s0, T + lift), P(u, s1, T)], Vector((side, 0, 0)),
                                [(0, v0), (0.01, v0), (0, v1)])
            if b.lod:
                ua, ub = uL / ROOF_TEX, uR / ROOF_TEX
                v1 = 0.05 + Ls / ROW_H * 0.1
                face_facing(b, mat, [P(uL, 0, T), P(uR, 0, T), P(uR, Ls, T), P(uL, Ls, T)], n, [(ua, 0.05), (ub, 0.05), (ub, v1), (ua, v1)])
            # slab: soffit, fascia and verge edges
            face_facing(b, soffit, [P(uL, 0, 0), P(uR, 0, 0), P(uR, Ls, 0), P(uL, Ls, 0)], -n)
            face_facing(b, 'timber', [P(uL, 0, -0.05), P(uR, 0, -0.05), P(uR, 0, T + 0.02), P(uL, 0, T + 0.02)], -d,
                        [(uL / 2.5, 0.3), (uR / 2.5, 0.3), (uR / 2.5, 0.36), (uL / 2.5, 0.36)])
            for u, side in ((uL, -1), (uR, 1)):
                face_facing(b, 'timber', [P(u, 0, 0), P(u, Ls, 0), P(u, Ls, T), P(u, 0, T)], Vector((side, 0, 0)))
                if bargeboard:
                    a = P(u + side * 0.04, -0.02, T - 0.08)
                    c = P(u + side * 0.04, Ls, T - 0.08)
                    b.beam('timber', a, c, w=0.08, d=0.32, up=n)
        if ridge:
            # ridge caps: overlapping half tubes
            zc = zr + T / cp + 0.02
            seg = 0.42 if not b.lod else 50.0
            x = uL - 0.05
            while x < uR + 0.04:
                x1 = min(x + seg + 0.05, uR + 0.1)
                ra, rb = 0.15, 0.125
                k = 6
                for i in range(k):
                    a0 = math.pi * i / k
                    a1 = math.pi * (i + 1) / k
                    pts = [V(x, ra * math.cos(a0), zc - 0.05 + ra * math.sin(a0)), V(x1, rb * math.cos(a0), zc - 0.05 + rb * math.sin(a0)),
                           V(x1, rb * math.cos(a1), zc - 0.05 + rb * math.sin(a1)), V(x, ra * math.cos(a1), zc - 0.05 + ra * math.sin(a1))]
                    nm = [V(0, math.cos(a0), math.sin(a0)), V(0, math.cos(a0), math.sin(a0)), V(0, math.cos(a1), math.sin(a1)), V(0, math.cos(a1), math.sin(a1))]
                    P0 = [b.tp(p) for p in pts]
                    if newell(P0).dot(b.tn(V(0, math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2)))) < 0:
                        pts.reverse(); nm.reverse()
                    b.face(mat, pts, [(0.5, 0.95), (0.6, 0.95), (0.6, 0.99), (0.5, 0.99)], normals=nm)
                # end disc
                face_facing(b, mat, [V(x, ra * math.cos(math.pi * i / k), zc - 0.05 + ra * math.sin(math.pi * i / k)) for i in range(k + 1)],
                            Vector((-1, 0, 0)), [(0.5, 0.95)] * (k + 1))
                x += seg
        if finial:
            for u in (uL - 0.04, uR + 0.04):
                with b.at((u, 0, zr + 0.05)):
                    b.cuboid('timber', -0.06, 0.06, -0.06, 0.06, -0.25, 0.45, uv='beam')
                    b.lathe('metal', [(0.07, 0.45), (0.11, 0.55), (0.0, 0.95)], 6, smooth=False)
    return zr


# ============================================================== walls
def wall_surface(b, mat, w, h, openings, step=1.0, jitter=0.0, col=(1, 1, 1)):
    """Wall in local frame: x in [0,w], z in [0,h], surface at y=0 facing -Y. Openings are rect holes
    (dict x0,x1,z0,z1, arch radius optional: the top is a half circle)."""
    xs = {0.0, w}
    zs = {0.0, h, min(0.4, h)}
    for o in openings:
        xs.update([o['x0'], o['x1']])
        zs.update([o['z0'], o['top']])
        if o.get('arch'):
            zs.add(o['z1'])
    xs = sorted(x for x in xs if -1e-6 <= x <= w + 1e-6)
    zs = sorted(z for z in zs if -1e-6 <= z <= h + 1e-6)

    def refine(a, s):
        out = [a[0]]
        for v in a[1:]:
            n = max(1, int(math.ceil((v - out[-1]) / s - 1e-6)))
            p = out[-1]
            for k in range(1, n + 1):
                out.append(p + (v - p) * k / n)
        return out
    if b.lod:
        step = 3.5
    xs, zs = refine(xs, step), refine(zs, step)
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(o['x0'] < cx < o['x1'] and o['z0'] < cz < o['top'] for o in openings):
                continue
            b.face(mat, [V(xs[i], 0, zs[j]), V(xs[i + 1], 0, zs[j]), V(xs[i + 1], 0, zs[j + 1]), V(xs[i], 0, zs[j + 1])], col=col, jitter=jitter)
    for o in openings:
        dep = o.get('depth', 0.16)
        x0, x1, z0, z1 = o['x0'], o['x1'], o['z0'], o['z1']
        rmat = o.get('reveal', mat)
        if o.get('arch'):
            r = (x1 - x0) / 2
            xc = (x0 + x1) / 2
            k = 8
            arc = [(xc + r * math.cos(math.pi - math.pi * i / k), z1 + r * math.sin(math.pi * i / k)) for i in range(k + 1)]
            top = o['top']
            # spandrels
            mid = k // 2
            b.face(mat, [V(x, 0, z) for x, z in arc[:mid + 1]] + [V(x0, 0, top)], col=col)
            b.face(mat, [V(x, 0, z) for x, z in arc[mid:]] + [V(x1, 0, top)], col=col)
            # reveals: jambs + arch soffit
            b.face(rmat, [V(x0, 0, z0), V(x0, 0, z1), V(x0, dep, z1), V(x0, dep, z0)], col=col)
            b.face(rmat, [V(x1, 0, z0), V(x1, dep, z0), V(x1, dep, z1), V(x1, 0, z1)], col=col)
            for i in range(k):
                (ax, az), (bx, bz) = arc[i], arc[i + 1]
                b.face(rmat, [V(ax, 0, az), V(bx, 0, bz), V(bx, dep, bz), V(ax, dep, az)], col=col)
        else:
            b.face(rmat, [V(x0, 0, z0), V(x0, 0, z1), V(x0, dep, z1), V(x0, dep, z0)], col=col)
            b.face(rmat, [V(x1, 0, z0), V(x1, dep, z0), V(x1, dep, z1), V(x1, 0, z1)], col=col)
            b.face(rmat, [V(x0, 0, z1), V(x1, 0, z1), V(x1, dep, z1), V(x0, dep, z1)], col=col)
            b.face(rmat, [V(x0, 0, z0), V(x0, dep, z0), V(x1, dep, z0), V(x1, 0, z0)], col=col)


def window_fill(b, o, rng, style):
    """Glass, frame, mullions, sill, shutters and flower box for an opening dict o (wall-local frame)."""
    x0, x1, z0, z1 = o['x0'], o['x1'], o['z0'], o['z1']
    dep = o.get('depth', 0.16)
    arch = o.get('arch')
    zt = o['top']
    kit.glass_pane(b, x0, x1, z0, zt if not arch else z1 + (x1 - x0) * 0.45, dep - 0.01)
    if arch:
        r = (x1 - x0) / 2
        xc = (x0 + x1) / 2
        k = 6
        arc = [(xc + r * math.cos(math.pi - math.pi * i / k), z1 + r * math.sin(math.pi * i / k)) for i in range(k + 1)]
        b.face('glass', [V(x, dep - 0.012, z) for x, z in reversed(arc)], col=kit.GLASS_TOP) if False else None
    fm = 'timber'
    t = 0.07
    if b.lod:
        xm = (x0 + x1) / 2
        b.cuboid(fm, xm - 0.04, xm + 0.04, dep - 0.06, dep - 0.005, z0, z1, uv='beam', skip=('+y',))
        b.cuboid(fm, x0, x1, dep - 0.06, dep - 0.005, lerp(z0, z1, 0.62) - 0.04, lerp(z0, z1, 0.62) + 0.04, uv='beam', skip=('+y',))
        b.cuboid('stone' if o.get('ground') else 'timber', x0 - 0.1, x1 + 0.1, -0.1, dep, z0 - 0.08, z0, skip=('+y', '-z'))
        if o.get('shutters'):
            hw = (x1 - x0) / 2 + 0.02
            for side in (-1, 1):
                xa = x0 - hw - 0.03 if side < 0 else x1 + 0.03
                b.cuboid('paint', xa, xa + hw, -0.1, -0.05, z0 + 0.02, z1 - 0.02, skip=('+y', '-z', '+z'))
        if o.get('flowers'):
            b.cuboid('paint', x0 - 0.12, x1 + 0.12, -0.31, -0.04, z0 - 0.32, z0 - 0.1, col=(0.8, 0.8, 0.8), skip=('+y',))
            b.card('flowers', ((x0 + x1) / 2, -0.17, z0 - 0.2), x1 - x0 + 0.2, 0.4, uvrect=kit.FLOWER_RECTS[rng.randrange(4)], bottom=True)
        return
    # inner frame + mullions at the glass plane
    yb = dep - 0.06
    b.cuboid(fm, x0, x1, yb, dep - 0.005, z0, z0 + t, uv='beam')
    b.cuboid(fm, x0, x0 + t, yb, dep - 0.005, z0, z1, uv='beam')
    b.cuboid(fm, x1 - t, x1, yb, dep - 0.005, z0, z1, uv='beam')
    if not arch:
        b.cuboid(fm, x0, x1, yb, dep - 0.005, z1 - t, z1, uv='beam')
    xm = (x0 + x1) / 2
    b.cuboid(fm, xm - 0.03, xm + 0.03, yb - 0.01, dep - 0.005, z0, z1 if not arch else z1 + (x1 - x0) / 2, uv='beam')
    zm = lerp(z0, z1, 0.62)
    b.cuboid(fm, x0, x1, yb - 0.01, dep - 0.005, zm - 0.03, zm + 0.03, uv='beam')
    if style.get('panes') and (z1 - z0) > 1.0 and not arch:
        for q in (0.3,):
            zq = lerp(z0, zm, 0.5)
            b.cuboid(fm, x0, x1, yb, dep - 0.005, zq - 0.015, zq + 0.015, uv='beam')
    # sill
    sm = o.get('sillmat', 'stone' if o.get('ground') else 'timber')
    b.cuboid(sm, x0 - 0.1, x1 + 0.1, -0.1, dep, z0 - 0.08, z0, jitter=0.05, uv='beam' if sm == 'timber' else 'box')
    # stone surround on masonry
    if o.get('surround'):
        s = 0.16
        b.cuboid('stone', x0 - s, x0, -0.04, 0.0, z0, z1, jitter=0.08)
        b.cuboid('stone', x1, x1 + s, -0.04, 0.0, z0, z1, jitter=0.08)
        if not arch:
            b.cuboid('stone', x0 - s, x1 + s, -0.05, 0.0, z1, z1 + 0.2, jitter=0.08)
    if arch:
        voussoirs(b, x0, x1, z1, 0.22, 9 if (x1 - x0) > 1.0 else 7)
    # shutters
    if o.get('shutters'):
        hw = (x1 - x0) / 2 + 0.02
        for side in (-1, 1):
            xa = x0 - hw - 0.03 if side < 0 else x1 + 0.03
            b.cuboid('paint', xa, xa + hw, -0.09, -0.04, z0 + 0.02, (z1 if not arch else z1) - 0.02,
                     uvs_planks=None) if False else _shutter(b, xa, xa + hw, z0 + 0.02, z1 - 0.02)
    if o.get('flowers'):
        flower_box(b, x0 - 0.12, x1 + 0.12, z0 - 0.08, rng)


def _shutter(b, xa, xb, za, zb):
    # planks texture mapped once per leaf (u across ~3 planks, v along the height)
    y0, y1 = -0.1, -0.05
    for pts, n in (([V(xa, y0, za), V(xb, y0, za), V(xb, y0, zb), V(xa, y0, zb)], 'f'),):
        b.face('paint', pts, [(0, 0), ((xb - xa) / 1.6, 0), ((xb - xa) / 1.6, (zb - za) / 2.3), (0, (zb - za) / 2.3)])
    b.cuboid('paint', xa, xb, y0, y1, za, zb, skip=('-y', '+y'))
    # cross battens
    for zz in (za + 0.18, zb - 0.18):
        b.cuboid('paint', xa + 0.03, xb - 0.03, y0 - 0.025, y0, zz - 0.05, zz + 0.05, col=(0.85, 0.85, 0.85))


def flower_box(b, xa, xb, ztop, rng, depth=0.26):
    zb = ztop - 0.24
    b.cuboid('paint', xa, xb, -0.05 - depth, -0.04, zb, ztop - 0.02, col=(0.8, 0.8, 0.8))
    b.cuboid('timber', xa - 0.02, xb + 0.02, -0.07 - depth, -0.04, ztop - 0.05, ztop, uv='beam')
    # bracket blocks
    for x in (xa + 0.12, xb - 0.12):
        b.cuboid('timber', x - 0.04, x + 0.04, -0.05 - depth * 0.6, -0.04, zb - 0.18, zb, uv='beam')
    n = max(2, int((xb - xa) / 0.38))
    rect = kit.FLOWER_RECTS[rng.randrange(4)]
    for i in range(n):
        x = lerp(xa + 0.15, xb - 0.15, (i + 0.5) / n) + rng.uniform(-0.05, 0.05)
        if rng.random() < 0.35:
            rect = kit.FLOWER_RECTS[rng.randrange(4)]
        s = rng.uniform(0.42, 0.55)
        for a in (0.45, -0.45):
            b.card('flowers', (x, -0.04 - depth / 2, ztop - 0.12), s, s, rotz=a, uvrect=rect, bottom=True, tilt=0.12)


def voussoirs(b, x0, x1, zs, w, k):
    if b.lod:
        k = 3
    r = (x1 - x0) / 2
    xc = (x0 + x1) / 2
    for i in range(k):
        a0 = math.pi - math.pi * i / k
        a1 = math.pi - math.pi * (i + 1) / k
        ri, ro = r, r + w + (0.05 if i == k // 2 else 0)
        pts_f = [V(xc + ri * math.cos(a0), -0.05, zs + ri * math.sin(a0)), V(xc + ri * math.cos(a1), -0.05, zs + ri * math.sin(a1)),
                 V(xc + ro * math.cos(a1), -0.05, zs + ro * math.sin(a1)), V(xc + ro * math.cos(a0), -0.05, zs + ro * math.sin(a0))]
        # shrink slightly to show joints
        c = sum(pts_f, Vector((0, 0, 0))) / 4
        pts_f = [p.lerp(c, 0.06) for p in pts_f]
        pts_b = [p + Vector((0, 0.05, 0)) for p in pts_f]
        j = 1 - b.rng.random() * 0.12
        col = (j, j, j)
        face_facing(b, 'stone', pts_f, Vector((0, -1, 0)), col=col)
        for q in range(4):
            a, c2 = pts_f[q], pts_f[(q + 1) % 4]
            mid = (a + c2) / 2 - c
            face_facing(b, 'stone', [a, c2, pts_b[(q + 1) % 4], pts_b[q]], mid, col=col)


def wall_frame(m, x, y, rotz):
    return Matrix.Translation(Vector((x, y, 0))) @ Matrix.Rotation(rotz, 4, 'Z')


def timber_frame(b, w, h, wins, pattern, rng, sill=True):
    """Half-timbering on a plaster wall (local wall frame). wins: openings list."""
    y0, y1 = -BD, 0.0
    beam = BEAM
    sk = ('+y',)
    band = rng.random() * 0.9
    if sill:
        b.cuboid('timber', -0.02, w + 0.02, y0 - 0.02, y1, 0, 0.2, uv='beam', skip=sk, band=band)
    b.cuboid('timber', -0.02, w + 0.02, y0, y1, h - beam, h, uv='beam', skip=sk, band=band)
    posts = [0.0, w - beam]
    for o in wins:
        posts += [o['x0'] - beam, o['x1']]
    posts = sorted(set(round(p, 3) for p in posts if -0.01 <= p <= w - beam + 0.01))
    merged = []
    for p in posts:
        if merged and p - merged[-1] < beam * 1.2:
            continue
        merged.append(p)
    posts = merged
    for p in posts:
        b.cuboid('timber', p, p + beam, y0, y1, 0.18, h - beam, uv='beam', skip=sk)
    for o in wins:
        b.cuboid('timber', o['x0'] - 0.02, o['x1'] + 0.02, y0, y1, o['z0'] - 0.13, o['z0'], uv='beam', skip=sk)
        b.cuboid('timber', o['x0'] - 0.02, o['x1'] + 0.02, y0, y1, o['top'], o['top'] + 0.13, uv='beam', skip=sk)
        # parapet panel decoration under window
        za, zb = 0.2, o['z0'] - 0.13
        if zb - za > 0.35 and pattern in ('x', 'mann'):
            xa, xb = o['x0'], o['x1']
            yc = -BD / 2
            if pattern == 'x':
                b.beam('timber', V(xa, yc, za), V(xb, yc, zb), w=0.12, d=BD, up=(0, -1, 0))
                b.beam('timber', V(xb, yc, za), V(xa, yc, zb), w=0.12, d=BD, up=(0, -1, 0))
            else:
                xm = (xa + xb) / 2
                b.beam('timber', V(xa, yc, za), V(xm, yc, zb), w=0.12, d=BD, up=(0, -1, 0))
                b.beam('timber', V(xb, yc, za), V(xm, yc, zb), w=0.12, d=BD, up=(0, -1, 0))
    # braces in blind panels
    yc = -BD / 2
    for i in range(len(posts) - 1):
        a, c = posts[i] + beam, posts[i + 1]
        if c - a < 0.45:
            continue
        mid = (a + c) / 2
        if any(o['x0'] - 0.05 <= mid <= o['x1'] + 0.05 for o in wins):
            continue
        za, zb = 0.2, h - beam
        if pattern == 'grid' or (c - a) > 2.6:
            # stud + mid rail
            b.cuboid('timber', mid - beam / 2, mid + beam / 2, y0, y1, za, zb, uv='beam', skip=sk)
            b.cuboid('timber', a, c, y0, y1, h * 0.48, h * 0.48 + 0.14, uv='beam', skip=sk)
            if pattern != 'grid':
                b.beam('timber', V(a, yc, za), V(mid - beam / 2, yc, h * 0.48), w=0.14, d=BD, up=(0, -1, 0))
                b.beam('timber', V(c, yc, za), V(mid + beam / 2, yc, h * 0.48), w=0.14, d=BD, up=(0, -1, 0))
        elif pattern == 'x':
            b.beam('timber', V(a, yc, za), V(c, yc, zb), w=0.14, d=BD, up=(0, -1, 0))
            b.beam('timber', V(c, yc, za), V(a, yc, zb), w=0.14, d=BD, up=(0, -1, 0))
        elif pattern == 'mann':
            # "man" figure: braces from the posts' feet towards the middle of the panel
            b.beam('timber', V(a, yc, za), V(mid, yc, h * 0.62), w=0.14, d=BD, up=(0, -1, 0))
            b.beam('timber', V(c, yc, za), V(mid, yc, h * 0.62), w=0.14, d=BD, up=(0, -1, 0))
            b.cuboid('timber', mid - beam / 2, mid + beam / 2, y0, y1, za, zb, uv='beam', skip=sk)
        else:  # diag: braces lean outwards
            left = mid < w / 2
            if left:
                b.beam('timber', V(c, yc, za), V(a, yc, zb), w=0.14, d=BD, up=(0, -1, 0))
            else:
                b.beam('timber', V(a, yc, za), V(c, yc, zb), w=0.14, d=BD, up=(0, -1, 0))


def place_windows(w, n, width, z0, z1, margin=0.55):
    if n <= 0:
        return []
    out = []
    avail = w - 2 * margin
    for i in range(n):
        xc = margin + avail * (i + 0.5) / n
        out.append({'x0': xc - width / 2, 'x1': xc + width / 2, 'z0': z0, 'z1': z1, 'top': z1})
    return out


def gable_wall(b, w, hr, rng, pattern, attic=True, mat='plaster'):
    """Triangular gable in local wall frame: base x in [0,w] at z=0, apex (w/2, hr)."""
    def hw(z):
        return (w / 2) * (1 - z / hr)
    win = None
    if attic and hr > 2.3 and w > 3.2:
        ww = 0.75 if w < 6 else 0.9
        z0, z1 = 0.7, min(1.85, hr * 0.55)
        if hw(z1) > ww / 2 + 0.35:
            win = {'x0': w / 2 - ww / 2, 'x1': w / 2 + ww / 2, 'z0': z0, 'z1': z1, 'top': z1, 'depth': 0.14}
    zs = [0.0, 0.5]
    if win:
        zs += [win['z0'], win['z1']]
    z = 0.0
    while z < hr - 0.9:
        z += 0.9
        zs.append(z)
    zs = sorted(set(round(v, 4) for v in zs if v < hr - 0.05)) + [hr]
    for i in range(len(zs) - 1):
        za, zb = zs[i], zs[i + 1]
        la, lb = w / 2 - hw(za), w / 2 - hw(zb)
        ra, rb = w / 2 + hw(za), w / 2 + hw(zb)
        if win and za >= win['z0'] - 1e-6 and zb <= win['z1'] + 1e-6:
            b.face(mat, [V(la, 0, za), V(win['x0'], 0, za), V(win['x0'], 0, zb), V(lb, 0, zb)])
            b.face(mat, [V(win['x1'], 0, za), V(ra, 0, za), V(rb, 0, zb), V(win['x1'], 0, zb)])
        elif zb >= hr - 1e-6:
            b.face(mat, [V(la, 0, za), V(ra, 0, za), V(w / 2, 0, hr)])
        else:
            b.face(mat, [V(la, 0, za), V(ra, 0, za), V(rb, 0, zb), V(lb, 0, zb)])
    if mat != 'plaster':
        return win
    yc = -BD / 2
    # timber: plate, king post, collar, rafter edges, braces
    b.cuboid('timber', 0, w, -BD, 0, 0, 0.17, uv='beam', skip=('+y',))
    b.beam('timber', V(0.05, yc, 0.05), V(w / 2, yc, hr - 0.05), w=0.16, d=BD, up=(0, -1, 0))
    b.beam('timber', V(w - 0.05, yc, 0.05), V(w / 2, yc, hr - 0.05), w=0.16, d=BD, up=(0, -1, 0))
    zc = hr * 0.5 if not win else win['z1'] + 0.08
    if zc < hr - 0.5:
        b.cuboid('timber', w / 2 - hw(zc) + 0.05, w / 2 + hw(zc) - 0.05, -BD, 0, zc, zc + 0.14, uv='beam', skip=('+y',))
    if win:
        for xx in (win['x0'] - 0.15, win['x1']):
            b.cuboid('timber', xx, xx + 0.15, -BD, 0, 0.17, zc, uv='beam', skip=('+y',))
        b.cuboid('timber', win['x0'], win['x1'], -BD, 0, win['z0'] - 0.12, win['z0'], uv='beam', skip=('+y',))
        window_fill(b, win, rng, {})
        if pattern in ('x', 'mann', 'diag'):
            for side in (-1, 1):
                xa = win['x0'] - 0.15 if side < 0 else win['x1'] + 0.15
                xo = xa + side * (hw(0.4) - abs(xa - w / 2)) * 0.8
                b.beam('timber', V(xo, yc, 0.17), V(xa, yc, min(zc, 1.3)), w=0.13, d=BD, up=(0, -1, 0))
    else:
        b.cuboid('timber', w / 2 - 0.08, w / 2 + 0.08, -BD, 0, 0.17, hr - 0.2, uv='beam', skip=('+y',))
        if pattern != 'grid' and zc > 0.8:
            b.beam('timber', V(w / 2 - hw(0.17) * 0.6, yc, 0.17), V(w / 2 - 0.08, yc, zc), w=0.13, d=BD, up=(0, -1, 0))
            b.beam('timber', V(w / 2 + hw(0.17) * 0.6, yc, 0.17), V(w / 2 + 0.08, yc, zc), w=0.13, d=BD, up=(0, -1, 0))
    return win


# ============================================================== details
def quoins(b, x_corner, side, h, depth_axis_len=0.0):
    """Corner stones on the front face around x_corner (side=-1 left, +1 right)."""
    z = 0.0
    k = 0
    while z < h - 0.1:
        zh = min(0.42, h - z)
        L = 0.55 if k % 2 == 0 else 0.32
        x0, x1 = (x_corner, x_corner + L) if side < 0 else (x_corner - L, x_corner)
        j = 1 - b.rng.random() * 0.12
        b.cuboid('stone', x0 - (0.04 if side < 0 else 0), x1 + (0.04 if side > 0 else 0), -0.05, 0.0, z + 0.015, z + zh - 0.015,
                 col=(j, j, j))
        # return on the side face
        L2 = 0.32 if k % 2 == 0 else 0.55
        if side < 0:
            b.cuboid('stone', x_corner - 0.04, x_corner, -0.05, L2, z + 0.015, z + zh - 0.015, col=(j, j, j), skip=('-y',))
        else:
            b.cuboid('stone', x_corner, x_corner + 0.04, -0.05, L2, z + 0.015, z + zh - 0.015, col=(j, j, j), skip=('-y',))
        z += zh
        k += 1


def wall_lantern(b, x, z, out=-1):
    """Iron bracket lantern on a wall facing -Y (local)."""
    b.cuboid('metal', x - 0.03, x + 0.03, -0.55, 0.0, z + 0.25, z + 0.3)
    b.beam('metal', V(x, -0.02, z - 0.05), V(x, -0.4, z + 0.27), w=0.03, d=0.03, up=(1, 0, 0))
    with b.at((x, -0.5, z - 0.05)):
        b.cuboid('metal', -0.1, 0.1, -0.1, 0.1, -0.02, 0.02)
        for sx in (-0.09, 0.09):
            for sy in (-0.09, 0.09):
                b.cuboid('metal', sx - 0.012, sx + 0.012, sy - 0.012, sy + 0.012, 0.0, 0.26)
        b.cuboid('glow', -0.075, 0.075, -0.075, 0.075, 0.02, 0.25)
        b.lathe('metal', [(0.15, 0.26), (0.0, 0.42)], 4, smooth=False, phase=math.pi / 4)
        b.cuboid('metal', -0.015, 0.015, -0.015, 0.015, 0.25, 0.32)


def awning(b, x0, x1, z, out, color, rng, drop=0.5):
    """Striped cloth awning on a wall facing -Y (local)."""
    n = max(3, int((x1 - x0) / 0.32))
    c2 = (0.97, 0.93, 0.84)
    for i in range(n):
        xa, xb = lerp(x0, x1, i / n), lerp(x0, x1, (i + 1) / n)
        col = color if i % 2 == 0 else c2
        b.face('cloth', [V(xa, -out, z - drop), V(xb, -out, z - drop), V(xb, -0.02, z), V(xa, -0.02, z)],
               [(xa, 0), (xb, 0), (xb, 1), (xa, 1)], col)
        b.face('cloth', [V(xb, -out, z - drop), V(xa, -out, z - drop), V(xa, -0.02, z), V(xb, -0.02, z)],
               [(xa, 0), (xb, 0), (xb, 1), (xa, 1)], tuple(c * 0.8 for c in col))
        # scalloped valance
        xm = (xa + xb) / 2
        for sgn in (1, -1):
            pts = [V(xa, -out, z - drop), V(xb, -out, z - drop), V(xb, -out, z - drop - 0.12), V(xm, -out, z - drop - 0.24), V(xa, -out, z - drop - 0.12)]
            if sgn < 0:
                pts = [p + Vector((0, 0.005, 0)) for p in reversed(pts)]
            b.face('cloth', pts, None, col if sgn > 0 else tuple(c * 0.8 for c in col))
    # iron rods
    for x in (x0 + 0.05, x1 - 0.05):
        b.beam('metal', V(x, -0.02, z - drop - 0.35), V(x, -out, z - drop), w=0.03, d=0.03, up=(1, 0, 0))
    b.beam('metal', V(x0, -out, z - drop + 0.01), V(x1, -out, z - drop + 0.01), w=0.03, d=0.03, up=(0, 0, 1))


SIGN_COLORS = [(0.17, 0.55, 0.55), (0.62, 0.18, 0.15), (0.2, 0.3, 0.55), (0.85, 0.65, 0.25), (0.3, 0.45, 0.2)]


def hanging_sign(b, x, z, rng, side=1):
    """Iron bracket projecting from the wall (local -Y) with a painted board."""
    L = 1.0
    b.cuboid('metal', x - 0.03, x + 0.03, -L, 0.0, z, z + 0.05)
    b.beam('metal', V(x, -0.02, z - 0.45), V(x, -L * 0.7, z + 0.02), w=0.03, d=0.03, up=(1, 0, 0))
    # scroll
    b.lathe('metal', [(0.05, 0), (0.05, 0.05)], 6) if False else None
    col = SIGN_COLORS[rng.randrange(len(SIGN_COLORS))]
    with b.at((x, -L * 0.55, z - 0.06)):
        for yy in (-0.22, 0.22):
            b.cuboid('metal', -0.01, 0.01, yy - 0.01, yy + 0.01, -0.12, 0.0)
        shape = rng.randrange(3)
        w2, h = 0.3, 0.62
        if shape == 0:
            pts = [(-0.33, -0.7), (0.33, -0.7), (0.33, -0.12), (-0.33, -0.12)]
        elif shape == 1:
            pts = [(0.33 * math.cos(a), -0.42 + 0.3 * math.sin(a)) for a in [2 * math.pi * i / 12 for i in range(12)]]
        else:
            pts = [(-0.3, -0.12), (0.3, -0.12), (0.3, -0.48), (0.0, -0.78), (-0.3, -0.48)]
        # board: rotate into the plane x=0 (sign plane faces +-X)
        for xx, mat, c in ((0.035, 'paint', col), (-0.035, 'paint', col)):
            P3 = [V(xx, p[0], p[1]) for p in pts]
            face_facing(b, 'cloth', P3, Vector((1 if xx > 0 else -1, 0, 0)), col=c)
        n = len(pts)
        for i in range(n):
            a, c2 = pts[i], pts[(i + 1) % n]
            face_facing(b, 'timber', [V(-0.035, a[0], a[1]), V(0.035, a[0], a[1]), V(0.035, c2[0], c2[1]), V(-0.035, c2[0], c2[1])],
                        Vector((0, (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2 + 0.42)))
        # gold emblem (hexagon) on both faces
        for xx in (0.04, -0.04):
            hexp = [V(xx, 0.13 * math.cos(math.pi / 3 * i + math.pi / 6), -0.42 + 0.13 * math.sin(math.pi / 3 * i + math.pi / 6)) for i in range(6)]
            face_facing(b, 'gold', hexp, Vector((1 if xx > 0 else -1, 0, 0)))


def ivy_curtain(b, x0, x1, ztop, rng, length=None, y=-0.12):
    """Painted ivy cards hanging from ztop on a wall facing -Y (local)."""
    x = x0
    while x < x1 - 0.3:
        w = rng.uniform(0.9, 1.6)
        h = length or rng.uniform(2.0, 4.2)
        u0 = rng.uniform(0.0, 0.5)
        b.card('ivy', (x + w / 2, y - rng.uniform(0, 0.05), ztop + rng.uniform(-0.1, 0.25)), w, h, uvrect=(u0, 1 - h / 4.5 if h < 4.5 else 0.0, u0 + w / 2.2, 1.0))
        x += w * 0.7


# ============================================================== house
PATTERNS = ['x', 'diag', 'mann', 'grid', 'x', 'diag']
AWNING_COLS = [(0.75, 0.2, 0.18), (0.15, 0.55, 0.55), (0.22, 0.35, 0.65), (0.85, 0.62, 0.2), (0.35, 0.55, 0.25), (0.6, 0.25, 0.45)]


def build_house(p, name, lod=0):
    rng = random.Random(p['seed'])
    b = Builder(p['seed'])
    b.lod = lod
    W, D, U = p['W'], p['D'], p['U']
    g, f, J = p['g'], p['f'], p['J']
    pattern = p['pattern']
    zt = g + f * U
    front_top = -J * U

    # ---------------- foundation plinth (extends underground; the runtime adds more when needed)
    b.cuboid('stone', -W / 2 - 0.07, W / 2 + 0.07, -0.07, D + 0.07, -4.0, 0.32, jitter=0.0, sub=(max(1, int(W)), 1), skip=('-z',))

    # ---------------- ground floor
    gmat = 'stone' if p['stone'] else 'plaster'
    door_w = 1.15
    door_x = p.get('door_x', 0.0)
    openings = []
    door_arch = p['stone'] and rng.random() < 0.7
    if door_arch:
        openings.append({'x0': W / 2 + door_x - door_w / 2, 'x1': W / 2 + door_x + door_w / 2, 'z0': 0.0, 'z1': 1.75, 'arch': True,
                         'top': 1.75 + door_w / 2, 'depth': 0.22, 'door': True})
    else:
        openings.append({'x0': W / 2 + door_x - door_w / 2, 'x1': W / 2 + door_x + door_w / 2, 'z0': 0.0, 'z1': 2.25, 'top': 2.25, 'depth': 0.2, 'door': True})
    dx0, dx1 = openings[0]['x0'], openings[0]['x1']
    # shop window or small windows
    if p['shop']:
        sw_ = min(2.6, (W / 2 - 0.5) - max(abs(door_x) + door_w / 2 - W / 2 + W / 2, 0))
        side = -1 if door_x >= 0 else 1
        if side < 0:
            sx0, sx1 = 0.55, dx0 - 0.45
        else:
            sx0, sx1 = dx1 + 0.45, W - 0.55
        if sx1 - sx0 > 1.2:
            openings.append({'x0': sx0, 'x1': sx1, 'z0': 0.75, 'z1': 2.35, 'top': 2.35, 'depth': 0.22, 'shop': True, 'ground': True})
    else:
        for (a, c) in ((0.5, dx0 - 0.5), (dx1 + 0.5, W - 0.5)):
            if c - a > 0.9:
                ww = min(0.95, c - a)
                xc = (a + c) / 2
                arch = p['stone'] and rng.random() < 0.4
                o = {'x0': xc - ww / 2, 'x1': xc + ww / 2, 'z0': 0.95, 'z1': 1.85 if arch else 2.25, 'top': (1.85 + ww / 2) if arch else 2.25,
                     'depth': 0.2, 'ground': True, 'surround': p['stone'], 'arch': arch, 'shutters': (not arch) and rng.random() < p['shutter_p'],
                     'flowers': rng.random() < 0.5}
                openings.append(o)
    with b.at((-W / 2, 0, 0)):
        wall_surface(b, gmat, W, g, openings, jitter=0.06 if gmat == 'stone' else 0.0)
        for o in openings:
            if o.get('door'):
                door(b, o, rng, p)
            elif o.get('shop'):
                shop_window(b, o, rng, p)
            else:
                window_fill(b, o, rng, {'panes': True})
        if p['stone'] and not b.lod:
            quoins(b, 0.0, -1, g)
            quoins(b, W, 1, g)
            # string course
            b.cuboid('stone', -0.06, W + 0.06, -0.08, 0.0, g - 0.18, g - 0.02, jitter=0.05)
        else:
            timber_frame(b, W, g, [o for o in openings if not o.get('door')], 'grid', rng, sill=False)
        # lantern + sign
        if rng.random() < 0.75 and not b.lod:
            lx = dx1 + 0.35 if dx1 + 0.5 < W else dx0 - 0.35
            wall_lantern(b, lx, 2.1)
        if p['shop']:
            so = [o for o in openings if o.get('shop')]
            if so:
                o = so[0]
                awning(b, o['x0'] - 0.25, o['x1'] + 0.25, 2.85, 1.35, AWNING_COLS[p['seed'] % len(AWNING_COLS)], rng)
            sx = 0.35 if door_x >= 0 else W - 0.35
            if not b.lod:
                hanging_sign(b, sx, g + 0.6, rng)
    # side + back ground walls
    side_walls(b, W, D, 0.0, g, gmat, rng, ground=True, front_y=0.0, pattern='grid')

    # ---------------- upper floors
    for i in range(1, U + 1):
        z0 = g + f * (i - 1)
        yf = -J * i
        nwin = max(1, int((W - 0.8) / 1.75))
        ww = 0.92 if W > 6 else 0.85
        wins = place_windows(W, nwin, ww, 0.82, 2.0, margin=0.65)
        for o in wins:
            o['depth'] = 0.15
            o['shutters'] = rng.random() < p['shutter_p']
            o['flowers'] = rng.random() < p['flower_p'] and i <= 2
        with b.at((-W / 2, yf, z0)):
            wall_surface(b, 'plaster', W, f, wins)
            for o in wins:
                window_fill(b, o, rng, {})
            timber_frame(b, W, f, wins, pattern, rng)
        # jetty underside, joist ends and corner brackets
        yprev = -J * (i - 1)
        if J > 0.01:
            b.face('timber', [V(-W / 2, yf, z0), V(-W / 2, yprev, z0), V(W / 2, yprev, z0), V(W / 2, yf, z0)])
            x = -W / 2 + 0.12 + (100 if b.lod else 0)
            while x < W / 2 - 0.1:
                b.cuboid('timber', x, x + 0.12, yf - 0.02, yprev, z0 - 0.16, z0, uv='beam', skip=('+y', '+z'))
                x += 0.38
            for sx in (-W / 2 + 0.06, W / 2 - 0.06):
                b.beam('timber', V(sx, yprev - 0.04, z0 - 0.95), V(sx, yf + 0.08, z0 - 0.12), w=0.13, d=0.13, up=(1, 0, 0))
            # side faces of the jetty strip
            for sx, nd in ((-W / 2, -1), (W / 2, 1)):
                face_facing(b, 'timber', [V(sx, yf, z0), V(sx, yprev, z0), V(sx, yprev, z0 + 0.2), V(sx, yf, z0 + 0.2)], Vector((nd, 0, 0)))
        side_walls(b, W, D, z0, f, 'plaster', rng, ground=False, front_y=yf, pattern=pattern)
        # balcony
        if i == 1 and p.get('balcony') and not b.lod:
            balcony(b, wins[len(wins) // 2], -W / 2, yf, z0, rng)

    # ---------------- roof
    if p['roof'] == 'side':
        halfS = (D - front_top) / 2
        cy = (D + front_top) / 2
        zr = gable_roof(b, 0, cy, zt, W / 2, halfS, p['pitch'], 'x', rng=rng, finial=p.get('finial', False))
        for sx, rz in ((-W / 2, -math.pi / 2), (W / 2, math.pi / 2)):
            # side gables (wall frame x along wall). left: from back to front, right: front to back
            if sx < 0:
                with b.at((sx, D, zt), -math.pi / 2):
                    gable_wall(b, D - front_top, zr, rng, pattern)
            else:
                with b.at((sx, front_top, zt), math.pi / 2):
                    gable_wall(b, D - front_top, zr, rng, pattern)
        # dormers on the front slope
        nd = p.get('dormers', 0)
        for k in range(nd):
            xc = -W / 2 + W * (k + 0.5) / nd
            dormer(b, xc, front_top, zt, p['pitch'], zr, halfS, rng)
        chim_x = (W / 2 - 0.9) * (1 if rng.random() < 0.5 else -1)
        chim_y = cy + rng.uniform(-0.3, 0.6)
        ridge_top = zt + zr
    else:
        halfL = (D - front_top) / 2 + 0.0
        cy = (D + front_top) / 2
        zr = gable_roof(b, 0, cy, zt, (D - front_top) / 2, W / 2, p['pitch'], 'y', rng=rng, finial=p.get('finial', False),
                        verge=0.38)
        with b.at((-W / 2, front_top, zt)):
            win = gable_wall(b, W, zr, rng, pattern)
            # hoist beam under the apex
            if p.get('hoist'):
                b.cuboid('timber', W / 2 - 0.09, W / 2 + 0.09, -1.1, 0.0, zr - 0.95, zr - 0.77, uv='beam')
                b.cuboid('metal', W / 2 - 0.01, W / 2 + 0.01, -1.0, -0.98, zr - 1.8, zr - 0.95)
        with b.at((W / 2, D, zt), math.pi):
            gable_wall(b, W, zr, rng, pattern)
        chim_x = rng.uniform(-0.3, 0.3) * W / 2 + (W / 4 if rng.random() < 0.5 else -W / 4) * 0.3
        chim_y = D - 1.2
        ridge_top = zt + zr
    # chimney
    if p.get('chimney', True):
        cx, cy2 = chim_x, chim_y
        top = ridge_top + 0.85
        b.cuboid('stone', cx - 0.32, cx + 0.32, cy2 - 0.42, cy2 + 0.42, zt + 0.5, top, jitter=0.08, sub=(1, 3))
        b.cuboid('stone', cx - 0.42, cx + 0.42, cy2 - 0.52, cy2 + 0.52, top, top + 0.14, jitter=0.05)
        b.cuboid('stone', cx - 0.34, cx + 0.34, cy2 - 0.44, cy2 + 0.44, top + 0.14, top + 0.34, jitter=0.05)
        for k in range(0 if b.lod else (2 if rng.random() < 0.6 else 1)):
            with b.at((cx + (k - 0.5) * 0.3 if True else cx, cy2, top + 0.34)):
                b.lathe('stone', [(0.11, 0), (0.09, 0.28), (0.12, 0.33), (0.1, 0.36)], 8, smooth=True)
    # ivy
    if p.get('ivy'):
        side = rng.choice((-1, 1))
        x0 = -W / 2 + 0.1 if side < 0 else W / 2 - 2.6
        ivy_curtain(b, x0, x0 + 2.4, zt - 0.1, rng, y=front_top - 0.13)
    obj = b.finish(name, ao=True, ground=-0.02, ao_dist=1.5, rays=12 if not lod else 8)
    return obj, b.tri_count(), ridge_top + 1.2


def side_walls(b, W, D, z0, h, mat, rng, ground, front_y, pattern):
    # back wall
    nwin = max(1, int((W - 0.8) / 2.0))
    wins = place_windows(W, nwin, 0.8, 0.9 if not ground else 1.0, 2.0 if not ground else 2.2, margin=0.8)
    for o in wins:
        o['depth'] = 0.14
        o['shutters'] = rng.random() < 0.3
    with b.at((W / 2, D, z0), math.pi):
        wall_surface(b, mat, W, h, wins, jitter=0.06 if mat == 'stone' else 0.0)
        for o in wins:
            window_fill(b, o, rng, {})
        if mat == 'plaster':
            timber_frame(b, W, h, wins, pattern, rng)
    # sides: left goes from back to front
    depth = D - front_y
    wins_s = place_windows(depth, 1 if depth > 5 and not ground else 0, 0.75, 0.9, 1.95, margin=1.2)
    for o in wins_s:
        o['depth'] = 0.14
    for side in (-1, 1):
        if side < 0:
            m = (-W / 2, D, z0, -math.pi / 2)
        else:
            m = (W / 2, front_y, z0, math.pi / 2)
        with b.at((m[0], m[1], m[2]), m[3]):
            wall_surface(b, mat, depth, h, wins_s, jitter=0.06 if mat == 'stone' else 0.0)
            for o in wins_s:
                window_fill(b, o, rng, {})
            if mat == 'plaster':
                timber_frame(b, depth, h, wins_s, pattern, rng)


def door(b, o, rng, p):
    x0, x1, z0, z1 = o['x0'], o['x1'], o['z0'], o['z1']
    dep = o['depth']
    arch = o.get('arch')
    zt = o['top']
    mat = 'paint' if rng.random() < 0.55 else 'planks'
    # door leaf (planks texture once over the leaf)
    w = x1 - x0
    if arch:
        r = w / 2
        xc = (x0 + x1) / 2
        k = 8
        pts = [V(x0, dep, z0), V(x1, dep, z0)] + [V(xc + r * math.cos(math.pi * i / k), dep, z1 + r * math.sin(math.pi * i / k)) for i in range(k + 1)]
        uvs = [((pt.x - x0) / 2.2, (pt.z - z0) / 2.4) for pt in pts]
        face_facing(b, mat, pts, Vector((0, -1, 0)), uvs)
        voussoirs(b, x0, x1, z1, 0.24, 9)
    else:
        face_facing(b, mat, [V(x0, dep, z0), V(x1, dep, z0), V(x1, dep, z1), V(x0, dep, z1)], Vector((0, -1, 0)),
                    [(0, 0), (w / 2.2, 0), (w / 2.2, (z1 - z0) / 2.4), (0, (z1 - z0) / 2.4)])
        # frame + lintel
        b.cuboid('timber', x0 - 0.14, x0, -0.06, dep, z0, z1, uv='beam')
        b.cuboid('timber', x1, x1 + 0.14, -0.06, dep, z0, z1, uv='beam')
        b.cuboid('timber', x0 - 0.22, x1 + 0.22, -0.08, dep, z1, z1 + 0.2, uv='beam')
        # small hood
        if rng.random() < 0.5:
            with b.at((0, 0, 0)):
                b.cuboid('timber', x0 - 0.3, x1 + 0.3, -0.55, 0.0, z1 + 0.42, z1 + 0.5, uv='beam')
                for xx in (x0 - 0.2, x1 + 0.2):
                    b.beam('timber', V(xx, -0.02, z1 + 0.05), V(xx, -0.5, z1 + 0.44), w=0.08, d=0.08, up=(1, 0, 0))
    # iron bands + handle
    for zz in (z0 + 0.45, z0 + 1.5):
        b.cuboid('metal', x0 + 0.05, x1 - 0.05, dep - 0.02, dep, zz, zz + 0.05)
    b.cuboid('metal', x1 - 0.25, x1 - 0.18, dep - 0.05, dep, z0 + 1.0, z0 + 1.08)
    # threshold step
    b.cuboid('stone', x0 - 0.25, x1 + 0.25, -0.5, dep, -0.2, 0.0, jitter=0.05)
    b.cuboid('stone', x0 - 0.4, x1 + 0.4, -0.85, -0.5, -0.4, -0.2, jitter=0.05)


def shop_window(b, o, rng, p):
    x0, x1, z0, z1 = o['x0'], o['x1'], o['z0'], o['z1']
    dep = o['depth']
    kit.glass_pane(b, x0, x1, z0, z1, dep - 0.02)
    n = max(2, int((x1 - x0) / 0.55))
    for i in range(n + 1):
        x = lerp(x0, x1, i / n)
        b.cuboid('paint', x - 0.04, x + 0.04, dep - 0.08, dep - 0.01, z0, z1)
    for zz in (z0, z1 - 0.06, lerp(z0, z1, 0.7)):
        b.cuboid('paint', x0, x1, dep - 0.09, dep - 0.01, zz, zz + 0.06)
    # display ledge and panel below
    b.cuboid('paint', x0 - 0.12, x1 + 0.12, -0.25, 0.0, z0 - 0.08, z0, col=(0.85, 0.85, 0.85))
    b.cuboid('paint', x0, x1, -0.06, 0.0, 0.1, z0 - 0.1, col=(0.9, 0.9, 0.9))
    # goods on the ledge: little jars/loaves
    for i in range(int((x1 - x0) / 0.3)):
        x = x0 + 0.15 + i * 0.3
        c = [(0.8, 0.55, 0.3), (0.85, 0.3, 0.25), (0.35, 0.6, 0.45), (0.9, 0.8, 0.5)][rng.randrange(4)]
        with b.at((x, -0.13, z0)):
            b.lathe('cloth', [(0.07, 0), (0.08, 0.06), (0.05, 0.14), (0.0, 0.15)], 6, col=c, smooth=False)
    # frame on the wall
    b.cuboid('timber', x0 - 0.15, x1 + 0.15, -0.07, 0.0, z1, z1 + 0.18, uv='beam')
    b.cuboid('timber', x0 - 0.15, x0, -0.07, 0.0, 0.0, z1, uv='beam')
    b.cuboid('timber', x1, x1 + 0.15, -0.07, 0.0, 0.0, z1, uv='beam')


def balcony(b, win, xoff, yf, z0, rng):
    xc = xoff + (win['x0'] + win['x1']) / 2
    w = 2.2
    dep = 0.85
    x0, x1 = xc - w / 2, xc + w / 2
    y0 = yf - dep
    b.cuboid('planks', x0, x1, y0, yf, z0 + 0.0, z0 + 0.1)
    for x in (x0 + 0.15, x1 - 0.15):
        b.beam('timber', V(x, yf - 0.02, z0 - 0.8), V(x, y0 + 0.1, z0), w=0.12, d=0.12, up=(1, 0, 0))
    hr = 0.95
    b.cuboid('timber', x0, x1, y0, y0 + 0.1, z0 + hr - 0.08, z0 + hr, uv='beam')
    for x in (x0, x1 - 0.1):
        b.cuboid('timber', x, x + 0.1, y0, yf, z0 + hr - 0.08, z0 + hr, uv='beam')
        b.cuboid('timber', x, x + 0.1, y0, y0 + 0.1, z0 + 0.1, z0 + hr, uv='beam')
    n = int((x1 - x0) / 0.17)
    for i in range(1, n):
        x = x0 + i * (x1 - x0) / n
        b.cuboid('timber', x - 0.03, x + 0.03, y0 + 0.02, y0 + 0.08, z0 + 0.1, z0 + hr - 0.08, uv='beam')
    for y in (y0 + 0.3, y0 + 0.6):
        for x in (x0 + 0.02, x1 - 0.08):
            b.cuboid('timber', x, x + 0.06, y - 0.03, y + 0.03, z0 + 0.1, z0 + hr - 0.08, uv='beam')
    # flower pots on the balcony
    with b.at((0, y0 - 0.0, 0)):
        pass
    for xx in (x0 + 0.3, x1 - 0.3):
        with b.at((xx, y0 + 0.3, z0 + 0.1)):
            b.lathe('stone', [(0.12, 0), (0.16, 0.25), (0.17, 0.28)], 8, col=(0.85, 0.5, 0.35))
            b.card('flowers', (0, 0, 0.15), 0.5, 0.5, rotz=0.6, uvrect=kit.FLOWER_RECTS[rng.randrange(4)], bottom=True)
            b.card('flowers', (0, 0, 0.15), 0.5, 0.5, rotz=-0.9, uvrect=kit.FLOWER_RECTS[rng.randrange(4)], bottom=True)


def dormer(b, xc, front_top, zt, pitch, zr, halfS, rng):
    tp = math.tan(pitch)
    wd = 1.35
    yd = front_top + 0.9            # dormer front wall position
    zs = zt + (yd - front_top) * tp - 0.05   # roof surface height there (approx)
    hwall = 1.35
    if zs + hwall + (wd / 2 + 0.3) * math.tan(math.radians(50)) > zt + zr - 0.25:
        hwall = max(0.9, zt + zr - 0.25 - zs - (wd / 2 + 0.3) * math.tan(math.radians(50)))
    zw = zs + hwall
    # cheeks reach back to where the roof plane reaches zw
    yb = front_top + (zw - zt) / tp + 0.2
    x0, x1 = xc - wd / 2, xc + wd / 2
    win = {'x0': 0.22, 'x1': wd - 0.22, 'z0': 0.25, 'z1': hwall - 0.18, 'top': hwall - 0.18, 'depth': 0.12}
    with b.at((x0, yd, zs)):
        wall_surface(b, 'plaster', wd, hwall, [win])
        window_fill(b, win, rng, {})
        b.cuboid('timber', -0.05, wd + 0.05, -BD, 0, -0.05, 0.12, uv='beam', skip=('+y',))
        b.cuboid('timber', -0.05, 0.12, -BD, 0, 0, hwall, uv='beam', skip=('+y',))
        b.cuboid('timber', wd - 0.12, wd + 0.05, -BD, 0, 0, hwall, uv='beam', skip=('+y',))
    for sx, nd in ((x0, -1), (x1, 1)):
        face_facing(b, 'plaster', [V(sx, yd, zs), V(sx, yb, zw), V(sx, yd, zw)], Vector((nd, 0, 0)))
        face_facing(b, 'plaster', [V(sx, yd, zs - 0.3), V(sx, yb, zw - 0.3), V(sx, yb, zw), V(sx, yd, zs)], Vector((nd, 0, 0))) if False else None
    gable_roof(b, xc, (yd + yb) / 2 - 0.1, zw, (yb - yd) / 2 + 0.1, wd / 2, math.radians(50), 'y', eave=0.18, verge=0.2, rng=rng, bargeboard=True)
    with b.at((x0, yd, zw)):
        gable_wall(b, wd, (wd / 2) * math.tan(math.radians(50)), rng, 'grid', attic=False)


# ============================================================== variants
def variants(count):
    out = []
    rng = random.Random(4242)
    widths = [5.4, 6.2, 7.0, 7.8, 8.6, 9.6]
    for i in range(count):
        W = widths[i % len(widths)] + rng.uniform(-0.25, 0.25)
        U = [1, 2, 2, 3, 2, 3, 1, 2][i % 8]
        roof = 'front' if (i % 3 == 1 or (W < 6.0 and i % 2 == 0)) else 'side'
        if W > 9.0:
            roof = 'side'
        p = {
            'seed': 1000 + i * 17, 'W': round(W, 2), 'D': round(rng.uniform(7.2, 9.2), 2), 'U': U,
            'g': round(rng.uniform(3.0, 3.35), 2), 'f': round(rng.uniform(2.65, 2.85), 2),
            'J': 0.0 if rng.random() < 0.15 else round(rng.uniform(0.28, 0.42), 2),
            'pattern': PATTERNS[i % len(PATTERNS)], 'roof': roof,
            'pitch': math.radians(rng.uniform(47, 58) if roof == 'front' else rng.uniform(44, 54)),
            'stone': rng.random() < 0.72, 'shop': i % 3 == 0,
            'shutter_p': rng.choice([0.0, 0.5, 0.9]), 'flower_p': rng.choice([0.3, 0.6, 0.9]),
            'dormers': (0 if roof == 'front' else (1 if W < 7 else 2)) if rng.random() < 0.8 else 0,
            'balcony': rng.random() < 0.25, 'ivy': rng.random() < 0.35, 'finial': rng.random() < 0.4,
            'hoist': rng.random() < 0.4, 'door_x': round(rng.choice([-1, 1]) * rng.uniform(0.6, 1.2) if W > 6 else 0.0, 2),
        }
        out.append(p)
    return out


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    count = int(argv[argv.index('--count') + 1]) if '--count' in argv else 24
    preview = argv[argv.index('--preview') + 1] if '--preview' in argv else None
    kit.reset_scene()
    manifest = []
    total = 0
    for i, p in enumerate(variants(count)):
        name = 'H%02d' % i
        obj, tris, height = build_house(p, name)
        total += tris
        if not preview:
            o1, tris1, _ = build_house(p, name + '_L1', lod=1)
            print('LOD1', name, tris1)
        m = dict(name=name, W=p['W'], D=p['D'], J=p['J'], U=p['U'], height=round(height, 2), roof=p['roof'], shop=p['shop'],
                 tris=tris, front=round(-p['J'] * p['U'], 2), floors=p['U'] + 1, g=p['g'], f=p['f'])
        manifest.append(m)
        print('HOUSE', name, tris, 'tris')
        if preview:
            obj.location = ((i % 3) * 13.0, (i // 3) * 18.0, 0)
    print('TOTAL TRIS', total)
    if preview:
        import preview as pv
        pv.render(preview)
    else:
        kit.export_glb('houses.glb')
        kit.write_json('houses.json', manifest)


if __name__ == '__main__':
    main()
