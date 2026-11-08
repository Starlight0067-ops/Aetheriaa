# Vael Harrow landmark kit: town wall segment, round towers, West Gate gatehouse, viaduct bridge,
# Concord Hall keep, Choir fountain + Aether crystal, windmill + sails, terrace balustrade.
#   blender -b --factory-startup -P tools/blender/town/landmarks.py -- [--only name,name] [--preview out.png]
# Outputs public/assets/town/landmarks.glb. Fronts face -Y in Blender (+Z at runtime).
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import V, Builder, newell, lerp
from mathutils import Vector
import houses as H

STONE_J = 0.1


def ring_wall(b, mat, r0, r1, z0, z1, n=20, rows=None, jitter=0.0, phase=0.0):
    """Cylindrical (optionally tapered) wall subdivided in rows for AO."""
    rows = rows or max(1, int((z1 - z0) / 1.2))
    prof = [(lerp(r0, r1, k / rows), lerp(z0, z1, k / rows)) for k in range(rows + 1)]
    b.lathe(mat, prof, n, smooth=True, jitter=jitter, phase=phase)


def crenel_ring(b, r_in, r_out, z0, h, n_merlons, mat='stone'):
    """Parapet ring with merlons."""
    ring_wall(b, mat, r_out, r_out, z0, z0 + h * 0.5, n=n_merlons * 2, rows=1)
    b.lathe(mat, [(r_in, z0 + h * 0.5), (r_in, z0)], n_merlons * 2, smooth=True)
    # top of the low parapet
    b.lathe(mat, [(r_in, z0 + h * 0.5), (r_out, z0 + h * 0.5)], n_merlons * 2, smooth=False)
    for i in range(n_merlons):
        a0 = 2 * math.pi * i / n_merlons
        a1 = a0 + 2 * math.pi / n_merlons * 0.55
        pts_o = [V(r_out * math.cos(a), r_out * math.sin(a), 0) for a in (a0, a1)]
        pts_i = [V(r_in * math.cos(a), r_in * math.sin(a), 0) for a in (a0, a1)]
        za, zb = z0 + h * 0.5, z0 + h
        j = 1 - b.rng.random() * 0.1
        c = (j, j, j)
        po, pi = pts_o, pts_i
        H.face_facing(b, mat, [po[0] + V(0, 0, za), po[1] + V(0, 0, za), po[1] + V(0, 0, zb), po[0] + V(0, 0, zb)], (po[0] + po[1]) / 2, col=c)
        H.face_facing(b, mat, [pi[0] + V(0, 0, za), pi[1] + V(0, 0, za), pi[1] + V(0, 0, zb), pi[0] + V(0, 0, zb)], -(pi[0] + pi[1]) / 2, col=c)
        H.face_facing(b, mat, [po[0] + V(0, 0, zb), po[1] + V(0, 0, zb), pi[1] + V(0, 0, zb), pi[0] + V(0, 0, zb)], V(0, 0, 1), col=c)
        for k, (o, ii) in enumerate(((po[0], pi[0]), (po[1], pi[1]))):
            tang = V(-o.y, o.x, 0).normalized() * (1 if k else -1)
            H.face_facing(b, mat, [o + V(0, 0, za), ii + V(0, 0, za), ii + V(0, 0, zb), o + V(0, 0, zb)], tang, col=c)


def corbel_ring(b, r, z, n, mat='stone'):
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        with b.at((r * math.cos(a), r * math.sin(a), z), a):
            b.cuboid(mat, -0.05, 0.45, -0.18, 0.18, -0.55, 0.0, jitter=0.1)
            b.cuboid(mat, -0.05, 0.25, -0.18, 0.18, -0.85, -0.55, jitter=0.1)


def slit_ring(b, r, zs, n, w=0.22, h=1.1, phase=0.0):
    for z in zs:
        for i in range(n):
            a = phase + 2 * math.pi * i / n
            with b.at((r * math.cos(a), r * math.sin(a), z), a + math.pi / 2):
                # local -Y faces outward
                b.cuboid('stone', -w / 2 - 0.12, w / 2 + 0.12, -0.08, 0.02, -0.12, h + 0.12, jitter=0.1, skip=('+y',))
                kit.glass_pane(b, -w / 2, w / 2, 0, h, -0.085)


def cone_roof(b, r, z0, h, mat='slate', n=16, finial=True, flare=0.35):
    # slightly flared bell-cone: profile r -> 0 with a kick at the eave
    prof = [(r + flare, z0 - 0.25), (r, z0 + 0.25), (r * 0.62, z0 + h * 0.42), (r * 0.25, z0 + h * 0.8), (0.0, z0 + h)]
    rows = []
    # tile rows: build as stacked frustums with small lips so the cone reads as tiled
    k = max(6, int(h / 0.45))
    pts = []
    for i in range(k + 1):
        t = i / k
        # interpolate along the profile polyline by height fraction
        zz = lerp(prof[0][1], prof[-1][1], t)
        for j in range(len(prof) - 1):
            if prof[j][1] <= zz <= prof[j + 1][1]:
                u = (zz - prof[j][1]) / max(1e-6, prof[j + 1][1] - prof[j][1])
                pts.append((lerp(prof[j][0], prof[j + 1][0], u), zz))
                break
    for i in range(len(pts) - 1):
        (ra, za), (rb, zb) = pts[i], pts[i + 1]
        lip = 0.05 if b.lod == 0 else 0.0
        seg = [(ra + lip, za), (rb, zb)]
        b.lathe(mat, seg, n, smooth=True, uvscale=1.0 / 2.2)
        if lip:
            b.lathe(mat, [(ra, za), (ra + lip, za)], n, smooth=False, uvscale=1.0 / 2.2)
    b.lathe('timber', [(r + flare, z0 - 0.25), (r - 0.3, z0 - 0.15)], n, smooth=False)
    if finial:
        top = z0 + h
        b.lathe('gold', [(0.12, top - 0.1), (0.1, top + 0.3), (0.22, top + 0.45), (0.22, top + 0.6), (0.06, top + 0.75), (0.03, top + 1.5), (0.0, top + 1.6)], 8, smooth=True)


# ============================================================== wall segment
def wall_segment(name, ivy=False, seed=1):
    b = Builder(seed)
    L = 4.0
    t = 1.3
    top = 6.6
    # body (outer face at y=-t)
    b.cuboid('stone', -L, L, -t, t, -6.0, top, jitter=STONE_J, sub=(6, 9), skip=('+z', '-z', '-x', '+x'))
    b.cuboid('stone', -L, L, -t - 0.25, t + 0.15, -6.0, 0.9, jitter=STONE_J, sub=(6, 2), skip=('-z', '-x', '+x'))
    # walkway
    b.quad('cobble', V(-L, -t + 0.45, top), V(L, -t + 0.45, top), V(L, t - 0.3, top), V(-L, t - 0.3, top), sub=(4, 1))
    # string course + corbels (machicolation look)
    b.cuboid('stone', -L, L, -t - 0.22, -t, top - 0.65, top - 0.45, jitter=0.05, skip=('-x', '+x'))
    x = -L + 0.4
    while x < L - 0.2:
        b.cuboid('stone', x - 0.16, x + 0.16, -t - 0.45, -t, top - 0.45, top - 0.05, jitter=0.1, skip=('+y',))
        b.cuboid('stone', x - 0.13, x + 0.13, -t - 0.3, -t, top - 0.75, top - 0.45, jitter=0.1, skip=('+y',))
        x += 0.9
    # outer parapet with merlons
    py0, py1 = -t - 0.45, -t + 0.45
    b.cuboid('stone', -L, L, py0, py1, top - 0.05, top + 0.95, jitter=0.05, skip=('-x', '+x'))
    x = -L
    k = 0
    while x < L - 0.05:
        x1 = min(x + 1.1, L)
        j = 1 - b.rng.random() * 0.1
        b.cuboid('stone', x + 0.02, x1 - 0.02, py0, py1, top + 0.95, top + 1.95, col=(j, j, j))
        b.cuboid('stone', x - 0.02, x1 + 0.02, py0 - 0.05, py1 + 0.05, top + 1.95, top + 2.08, col=(j, j, j))
        x += 1.85
        k += 1
    # inner low parapet
    b.cuboid('stone', -L, L, t - 0.3, t, top - 0.05, top + 0.7, jitter=0.05, skip=('-x', '+x'))
    # buttress
    with b.at((0, -t, 0)):
        b.cuboid('stone', -0.55, 0.55, -0.85, 0.0, -6.0, 3.2, jitter=STONE_J, sub=(1, 4), skip=('+y',))
        H.face_facing(b, 'stone', [V(-0.55, -0.85, 3.2), V(0.55, -0.85, 3.2), V(0.55, 0.0, 4.6), V(-0.55, 0.0, 4.6)], V(0, -1, 1))
        for sx in (-0.55, 0.55):
            H.face_facing(b, 'stone', [V(sx, -0.85, 3.2), V(sx, 0.0, 3.2), V(sx, 0.0, 4.6)], V(sx, 0, 0))
    # arrow slits
    for sx in (-2.3, 2.3):
        with b.at((sx, -t, 2.4)):
            b.cuboid('stone', -0.22, 0.22, -0.06, 0.0, -0.1, 1.2, jitter=0.1, skip=('+y',))
            kit.glass_pane(b, -0.08, 0.08, 0.0, 1.1, -0.065)
    if ivy:
        rng = random.Random(seed)
        with b.at((0, -t - 0.25, 0)):
            H.ivy_curtain(b, -L + 0.3, L - 1.0, top - 0.6, rng, y=-0.08)
    return b.finish(name, ground=-0.02, ao_dist=1.8, rays=10)


# ============================================================== round tower
def tower(name, roof=True, seed=2, r=3.7, h=12.5):
    b = Builder(seed)
    ring_wall(b, 'stone', r + 0.6, r + 0.6, -6, 0.0, n=22, rows=2, jitter=STONE_J)
    ring_wall(b, 'stone', r + 0.6, r, 0.0, 1.6, n=22, rows=1, jitter=STONE_J)
    ring_wall(b, 'stone', r, r, 1.6, h, n=22, rows=int(h / 1.3), jitter=STONE_J)
    b.lathe('stone', [(r, 1.6), (r + 0.12, 1.6), (r + 0.12, 1.85), (r, 1.85)], 22, smooth=False)
    corbel_ring(b, r, h + 0.6, 20)
    ring_wall(b, 'stone', r + 0.45, r + 0.45, h - 0.2, h + 0.6, n=22, rows=1)
    b.lathe('stone', [(r, h - 0.2), (r + 0.45, h - 0.2)], 22, smooth=False)
    crenel_ring(b, r - 0.05, r + 0.45, h + 0.6, 1.9, 10)
    slit_ring(b, r, [3.5, 7.5], 4, phase=0.4)
    if roof:
        cone_roof(b, r + 0.1, h + 1.2, 7.8 + r * 0.4, 'slate', n=18)
        # little lucarnes on the cone
        for i in range(2):
            a = math.pi * i + 0.9
            rr = r * 0.7
            with b.at((rr * math.cos(a), rr * math.sin(a), h + 2.6), a + math.pi / 2):
                b.cuboid('timber', -0.45, 0.45, -0.25, 0.6, 0.0, 1.0, uv='beam')
                kit.glass_pane(b, -0.3, 0.3, 0.15, 0.85, -0.26)
                H.gable_roof(b, 0, 0.15, 1.0, 0.45, 0.45, math.radians(50), 'y', eave=0.12, verge=0.12, mat='slate', ridge=False)
    else:
        b.quad('cobble', V(-r, -r, h + 0.6), V(r, -r, h + 0.6), V(r, r, h + 0.6), V(-r, r, h + 0.6))
    return b.finish(name, ground=-0.02, ao_dist=1.8, rays=10)


# ============================================================== gatehouse
def gatehouse(name, seed=3):
    b = Builder(seed)
    hw, hd, Hc = 5.2, 4.6, 13.5
    pw, ps = 4.6, 4.3          # passage width, arch spring
    pr = pw / 2
    # foundations
    b.cuboid('stone', -hw - 0.3, hw + 0.3, -hd - 0.3, hd + 0.3, -6, 0.4, jitter=STONE_J, skip=('-z',))
    # front & back walls with arch
    op = {'x0': hw - pr, 'x1': hw + pr, 'z0': 0.0, 'z1': ps, 'arch': True, 'top': ps + pr, 'depth': 0.02}
    for yy, rz in ((-hd, 0.0), (hd, math.pi)):
        with b.at((-hw if rz == 0 else hw, yy, 0), rz):
            H.wall_surface(b, 'stone', hw * 2, Hc, [op], step=1.4, jitter=STONE_J)
            H.voussoirs(b, op['x0'], op['x1'], ps, 0.55, 13)
            # crest plaque
            with b.at((hw, -0.0, ps + pr + 2.2)):
                b.cuboid('stone', -1.0, 1.0, -0.2, 0.0, -1.0, 1.0, jitter=0.05)
                hexp = [V(0.75 * math.cos(math.pi / 3 * i + math.pi / 6), -0.22, 0.75 * math.sin(math.pi / 3 * i + math.pi / 6)) for i in range(6)]
                H.face_facing(b, 'gold', hexp, V(0, -1, 0))
                shard = [V(0, -0.24, -0.5), V(0.18, -0.24, -0.05), V(0.0, -0.24, 0.55), V(-0.18, -0.24, -0.05)]
                H.face_facing(b, 'glow', shard, V(0, -1, 0))
            # windows above the arch
            for sx in (-2.6, 2.6):
                w = {'x0': hw + sx - 0.35, 'x1': hw + sx + 0.35, 'z0': ps + pr + 3.6, 'z1': ps + pr + 4.5, 'arch': True, 'top': ps + pr + 4.85, 'depth': 0.25}
            # string course
            b.cuboid('stone', -0.1, hw * 2 + 0.1, -0.25, 0.0, Hc - 1.6, Hc - 1.35, jitter=0.05)
            # lanterns
            for sx in (hw - pr - 0.8, hw + pr + 0.8):
                H.wall_lantern(b, sx, 3.2)
    # passage side walls + vault
    for sx in (-pr, pr):
        with b.at((sx, hd if sx < 0 else -hd, 0), (-math.pi / 2 if sx < 0 else math.pi / 2)):
            # local x along the passage, outward = into the passage
            pass
    for sx, nd in ((-pr, 1), (pr, -1)):
        b.quad('stone', V(sx, -hd, 0), V(sx, hd, 0), V(sx, hd, ps), V(sx, -hd, ps), sub=(5, 3)) if nd > 0 else \
            b.quad('stone', V(sx, hd, 0), V(sx, -hd, 0), V(sx, -hd, ps), V(sx, hd, ps), sub=(5, 3))
    k = 10
    for i in range(k):
        a0, a1 = math.pi * i / k, math.pi * (i + 1) / k
        p = lambda a, y: V(pr * math.cos(a), y, ps + pr * math.sin(a))
        H.face_facing(b, 'stone', [p(a0, -hd), p(a1, -hd), p(a1, hd), p(a0, hd)], V(-math.cos((a0 + a1) / 2), 0, -math.sin((a0 + a1) / 2)))
    # floor
    b.quad('cobble', V(-pr, -hd, 0.02), V(pr, -hd, 0.02), V(pr, hd, 0.02), V(-pr, hd, 0.02), sub=(2, 4))
    # portcullis (half raised)
    yb = -hd + 0.9
    zbot = 2.4
    xs = [-pr + 0.25 + i * 0.42 for i in range(int((pw - 0.4) / 0.42) + 1)]
    for x in xs:
        b.cuboid('metal', x - 0.05, x + 0.05, yb - 0.05, yb + 0.05, zbot, ps + pr)
        b.lathe('metal', [(0.06, zbot), (0.0, zbot - 0.3)], 4, smooth=False) if False else None
        with b.at((x, yb, zbot)):
            b.lathe('metal', [(0.07, 0.0), (0.0, -0.3)], 4, smooth=False)
    for z in [zbot + 0.3 + i * 0.5 for i in range(6)]:
        if z < ps + pr * 0.9:
            b.cuboid('metal', -pr, pr, yb - 0.07, yb + 0.07, z - 0.05, z + 0.05)
    # side walls of the block
    for sx in (-hw, hw):
        with b.at((sx, hd if sx < 0 else -hd, 0), -math.pi / 2 if sx < 0 else math.pi / 2):
            H.wall_surface(b, 'stone', hd * 2, Hc, [], step=1.4, jitter=STONE_J)
    # roof platform with crenellation
    top = Hc
    b.quad('cobble', V(-hw, -hd, top), V(hw, -hd, top), V(hw, hd, top), V(-hw, hd, top))
    for (x0, x1, y0, y1) in ((-hw - 0.3, hw + 0.3, -hd - 0.3, -hd + 0.3), (-hw - 0.3, hw + 0.3, hd - 0.3, hd + 0.3)):
        b.cuboid('stone', x0, x1, y0, y1, top - 0.6, top + 0.9, jitter=0.05)
        x = x0
        while x < x1 - 0.3:
            b.cuboid('stone', x + 0.02, min(x + 1.0, x1) - 0.02, y0, y1, top + 0.9, top + 1.9, jitter=0.1)
            x += 1.7
    # corbels under the front parapet
    x = -hw
    while x < hw:
        b.cuboid('stone', x - 0.15, x + 0.15, -hd - 0.3, -hd, top - 1.1, top - 0.6, jitter=0.1, skip=('+y',))
        x += 0.8
    # small slate roof (guard house) on top
    H.gable_roof(b, 0, 0, top, 3.6, 2.6, math.radians(52), 'x', eave=0.3, verge=0.3, mat='slate')
    with b.at((-3.6, 2.6, top), -math.pi / 2):
        H.gable_wall(b, 5.2, 2.6 * math.tan(math.radians(52)), random.Random(1), 'grid', attic=True, mat='stone')
    with b.at((3.6, -2.6, top), math.pi / 2):
        H.gable_wall(b, 5.2, 2.6 * math.tan(math.radians(52)), random.Random(2), 'grid', attic=True, mat='stone')
    b.cuboid('stone', -3.6, 3.6, -2.6, 2.6, top, top + 0.1)
    for sx in (-3.6, 3.6):
        pass
    # twin towers
    for sx in (-hw - 2.6, hw + 2.6):
        with b.at((sx, -0.6, 0)):
            r = 3.5
            ring_wall(b, 'stone', r + 0.5, r + 0.5, -6, 0.0, n=22, rows=2, jitter=STONE_J)
            ring_wall(b, 'stone', r + 0.5, r, 0.0, 1.5, n=22, rows=1, jitter=STONE_J)
            ring_wall(b, 'stone', r, r, 1.5, 16.0, n=22, rows=11, jitter=STONE_J)
            corbel_ring(b, r, 16.6, 20)
            ring_wall(b, 'stone', r + 0.45, r + 0.45, 15.8, 16.6, n=22, rows=1)
            b.lathe('stone', [(r, 15.8), (r + 0.45, 15.8)], 22, smooth=False)
            crenel_ring(b, r - 0.05, r + 0.45, 16.6, 1.9, 10)
            slit_ring(b, r, [4.0, 8.0, 12.0], 3, phase=-math.pi / 2 - 0.6)
            cone_roof(b, r + 0.1, 17.2, 9.5, 'slate', n=18)
            # band
            b.lathe('stone', [(r, 7.0), (r + 0.15, 7.0), (r + 0.15, 7.3), (r, 7.3)], 22, smooth=False)
    return b.finish(name, ground=-0.02, ao_dist=2.0, rays=10)


# ============================================================== bridge
def bridge(name, seed=4, length=70.0, nspan=6):
    b = Builder(seed)
    W = 4.0                    # half deck width
    span = length / nspan
    pw = 2.6                   # pier width along x
    rr = (span - pw) / 2       # arch radius
    zs = -1.6 - rr             # springing height
    bottom = -24.0
    piers = [span * k for k in range(1, nspan)]
    # deck
    b.quad('cobble', V(-6, -W + 0.5, 0.0), V(length + 6, -W + 0.5, 0.0), V(length + 6, W - 0.5, 0.0), V(-6, W - 0.5, 0.0), sub=(40, 2))
    # spandrel faces with arch openings on both sides
    for side in (-1, 1):
        y = side * W
        ops = []
        for k in range(nspan):
            xa = (piers[k - 1] + pw / 2) if k > 0 else -0.01
            xb = (piers[k] - pw / 2) if k < nspan - 1 else length + 0.01
            if k == 0 or k == nspan - 1:
                continue
            ops.append({'x0': xa + 6, 'x1': xb + 6, 'z0': bottom - zs, 'z1': 0.0, 'arch': True, 'top': rr, 'depth': 0.0})
        with b.at((-6 if side < 0 else length + 6, y, zs), 0.0 if side < 0 else math.pi):
            if side < 0:
                H.wall_surface(b, 'stone', length + 12, -zs, ops, step=1.6, jitter=STONE_J) if False else None
    # build spandrels explicitly per span (simpler + correct for both faces)
    def arch_pts(xa, xb, k=12):
        xc, r = (xa + xb) / 2, (xb - xa) / 2
        return [(xc + r * math.cos(math.pi - math.pi * i / k), zs + r * math.sin(math.pi * i / k)) for i in range(k + 1)]
    spans = []
    for k in range(nspan):
        xa = (piers[k - 1] + pw / 2) if k > 0 else 0.0 + pw / 2 - 1.3
        xb = (piers[k] - pw / 2) if k < nspan - 1 else length - pw / 2 + 1.3
        spans.append((xa, xb))
    for side in (-1, 1):
        y = side * W
        want = V(0, side, 0)
        for (xa, xb) in spans:
            arc = arch_pts(xa, xb)
            # spandrel: polygon between arch and deck line, split into vertical strips
            for i in range(len(arc) - 1):
                (x0, z0), (x1, z1) = arc[i], arc[i + 1]
                H.face_facing(b, 'stone', [V(x0, y, z0), V(x1, y, z1), V(x1, y, -0.15), V(x0, y, -0.15)], want, jitter=STONE_J)
            # voussoir ring
            kk = 15
            xc, r = (xa + xb) / 2, (xb - xa) / 2
            for i in range(kk):
                a0 = math.pi - math.pi * i / kk
                a1 = math.pi - math.pi * (i + 1) / kk
                ro = r + 0.75
                P = [V(xc + r * math.cos(a0), y, zs + r * math.sin(a0)), V(xc + r * math.cos(a1), y, zs + r * math.sin(a1)),
                     V(xc + ro * math.cos(a1), y, zs + ro * math.sin(a1)), V(xc + ro * math.cos(a0), y, zs + ro * math.sin(a0))]
                c = sum(P, Vector()) / 4
                P = [p.lerp(c, 0.05) + V(0, side * 0.12, 0) for p in P]
                j = 1 - b.rng.random() * 0.14
                H.face_facing(b, 'stone', P, want, col=(j, j, j))
                for q in range(4):
                    a, cc = P[q], P[(q + 1) % 4]
                    H.face_facing(b, 'stone', [a, cc, cc - V(0, side * 0.12, 0), a - V(0, side * 0.12, 0)], (a + cc) / 2 - c, col=(j, j, j))
        # intrados (barrel vault)
    for (xa, xb) in spans:
        arc = arch_pts(xa, xb, 14)
        xc = (xa + xb) / 2
        for i in range(len(arc) - 1):
            (x0, z0), (x1, z1) = arc[i], arc[i + 1]
            H.face_facing(b, 'stone', [V(x0, -W, z0), V(x1, -W, z1), V(x1, W, z1), V(x0, W, z0)], V(xc - (x0 + x1) / 2, 0, zs - (z0 + z1) / 2))
    # piers with cutwaters (refuge bays on the parapet)
    for px in piers:
        x0, x1 = px - pw / 2, px + pw / 2
        b.cuboid('stone', x0, x1, -W, W, bottom, zs, jitter=STONE_J, sub=(1, 5), skip=('+z', '-z'))
        for side in (-1, 1):
            y0 = side * W
            tip = side * (W + 2.0)
            # cutwater prism up to the parapet
            P = [(x0, y0), (px, tip), (x1, y0)]
            for (ax, ay), (bx, by) in ((P[0], P[1]), (P[1], P[2])):
                H.face_facing(b, 'stone', [V(ax, ay, bottom), V(bx, by, bottom), V(bx, by, -0.3), V(ax, ay, -0.3)], V((ax + bx) / 2 - px, (ay + by) / 2 - y0 + side * 0.1, 0), jitter=STONE_J)
            # refuge floor + parapet around it
            H.face_facing(b, 'cobble', [V(x0, y0, 0.0), V(px, tip - side * 0.45, 0.0), V(x1, y0, 0.0)], V(0, 0, 1))
            for (ax, ay), (bx, by) in ((P[0], P[1]), (P[1], P[2])):
                a, c = V(ax, ay, -0.3), V(bx, by, -0.3)
                d = (c - a).normalized()
                nrm = V(-d.y, d.x, 0) * (1 if side < 0 else -1)
                inner = lambda p: p - nrm * 0.45
                H.face_facing(b, 'stone', [a, c, c + V(0, 0, 1.45), a + V(0, 0, 1.45)], nrm, jitter=0.06)
                H.face_facing(b, 'stone', [inner(a) + V(0, 0, 0.3), inner(c) + V(0, 0, 0.3), inner(c) + V(0, 0, 1.45), inner(a) + V(0, 0, 1.45)], -nrm)
                H.face_facing(b, 'stone', [a + V(0, 0, 1.45), c + V(0, 0, 1.45), inner(c) + V(0, 0, 1.45), inner(a) + V(0, 0, 1.45)], V(0, 0, 1))
            # cutwater cap
            # lamp post on the refuge
            lamp_post(b, px, side * (W + 0.9), 0.0)
    # parapets along the deck
    for side in (-1, 1):
        yo, yi = side * W, side * (W - 0.5)
        segs = []
        x = -6.0
        cuts = [(p - pw / 2, p + pw / 2) for p in piers]
        pts = [-6.0] + [c for ab in cuts for c in ab] + [length + 6]
        for i in range(0, len(pts), 2):
            xa, xb = pts[i], pts[i + 1]
            lo, hi = min(yo, yi), max(yo, yi)
            b.cuboid('stone', xa, xb, lo, hi, -0.3, 1.1, jitter=0.06, sub=(max(1, int((xb - xa) / 2)), 1), skip=('-z',))
            b.cuboid('stone', xa - 0.0, xb + 0.0, lo - 0.08, hi + 0.08, 1.1, 1.28, jitter=0.04)
        # string course under the parapet
        sy0, sy1 = (W, W + 0.18) if side > 0 else (-W - 0.18, -W)
        b.cuboid('stone', -6, length + 6, sy0, sy1, -0.75, -0.45, jitter=0.03)
    # abutments (buried in the banks)
    for xa, xb in ((-6, spans[0][0]), (spans[-1][1], length + 6)):
        b.cuboid('stone', xa, xb, -W, W, bottom, -0.15, jitter=STONE_J, sub=(2, 6), skip=('+z',))
    return b.finish(name, ground=None, ao_dist=2.5, rays=10)


def lamp_post(b, x, y, z, h=3.6):
    with b.at((x, y, z)):
        b.lathe('metal', [(0.2, 0), (0.2, 0.25), (0.12, 0.4), (0.07, 0.6), (0.06, h - 0.4), (0.09, h - 0.3), (0.05, h - 0.2)], 8, smooth=True)
        b.cuboid('metal', -0.35, 0.35, -0.03, 0.03, h - 0.35, h - 0.28)
        for sx in (-0.33, 0.33):
            with b.at((sx, 0, h - 0.62)):
                b.cuboid('metal', -0.12, 0.12, -0.12, 0.12, -0.02, 0.02)
                for qx in (-0.11, 0.11):
                    for qy in (-0.11, 0.11):
                        b.cuboid('metal', qx - 0.012, qx + 0.012, qy - 0.012, qy + 0.012, 0, 0.3)
                b.cuboid('glow', -0.09, 0.09, -0.09, 0.09, 0.02, 0.29)
                b.lathe('metal', [(0.17, 0.3), (0.0, 0.48)], 4, smooth=False, phase=math.pi / 4)
                b.cuboid('metal', -0.01, 0.01, -0.01, 0.01, 0.3, 0.36)


# ============================================================== Concord Hall
def hall(name, seed=5):
    b = Builder(seed)
    rng = random.Random(seed)
    # ---- terrace plinth
    b.cuboid('stone', -14, 14, -11, 18, -8, 0.5, jitter=STONE_J, sub=(10, 2), skip=('-z',))
    b.quad('cobble', V(-14, -11, 0.5), V(14, -11, 0.5), V(14, 18, 0.5), V(-14, 18, 0.5), sub=(6, 6))
    # front steps
    for i in range(4):
        b.cuboid('stone', -4.5 - i * 0.3, 4.5 + i * 0.3, -11 - 0.45 * (i + 1), -11 - 0.45 * i, -0.4, 0.5 - 0.22 * (i + 1) + 0.22, jitter=0.05)
    # ---- front hall wing: x[-11,11], y[-8,4]
    wx, wy0, wy1, wh = 11.0, -8.0, 4.0, 11.0
    portal = {'x0': wx - 1.7, 'x1': wx + 1.7, 'z0': 0.5, 'z1': 4.3, 'arch': True, 'top': 6.0, 'depth': 0.6, 'door': True}
    wins = []
    for sx in (-8.2, -4.6, 4.6, 8.2):
        wins.append({'x0': wx + sx - 0.7, 'x1': wx + sx + 0.7, 'z0': 3.2, 'z1': 7.6, 'arch': True, 'top': 8.3, 'depth': 0.35, 'ground': True, 'surround': False})
    with b.at((-wx, wy0, 0)):
        H.wall_surface(b, 'stone', wx * 2, wh, [portal] + wins, step=1.4, jitter=STONE_J)
        for o in wins:
            H.window_fill(b, o, rng, {'panes': True})
        H.door(b, dict(portal, depth=0.6), random.Random(2), {})
        # buttresses between bays
        for sx in (-10.9, -6.4, -2.8, 2.8, 6.4, 10.9):
            x = wx + sx
            b.cuboid('stone', x - 0.45, x + 0.45, -1.0, 0.0, 0.5, 8.4, jitter=STONE_J, skip=('+y',))
            H.face_facing(b, 'stone', [V(x - 0.45, -1.0, 8.4), V(x + 0.45, -1.0, 8.4), V(x + 0.45, 0, 9.6), V(x - 0.45, 0, 9.6)], V(0, -1, 1))
            for xx in (x - 0.45, x + 0.45):
                H.face_facing(b, 'stone', [V(xx, -1.0, 8.4), V(xx, 0, 8.4), V(xx, 0, 9.6)], V(xx - x, 0, 0))
        # cornice
        b.cuboid('stone', -0.2, wx * 2 + 0.2, -0.35, 0.0, wh - 0.5, wh - 0.2, jitter=0.04)
        # crest above the portal
        with b.at((wx, -0.05, 7.4)):
            hexp = [V(1.0 * math.cos(math.pi / 3 * i + math.pi / 6), -0.25, 1.0 * math.sin(math.pi / 3 * i + math.pi / 6)) for i in range(6)]
            b.cuboid('stone', -1.3, 1.3, -0.25, 0.0, -1.2, 1.2, jitter=0.04)
            H.face_facing(b, 'gold', [p + V(0, -0.02, 0) for p in hexp], V(0, -1, 0))
            H.face_facing(b, 'aether', [V(0, -0.3, -0.7), V(0.25, -0.3, 0.0), V(0, -0.3, 0.8), V(-0.25, -0.3, 0.0)], V(0, -1, 0))
        for sx in (wx - 2.6, wx + 2.6):
            H.wall_lantern(b, sx, 3.6)
    for sx in (-wx, wx):
        with b.at((sx, wy1 if sx < 0 else wy0, 0), -math.pi / 2 if sx < 0 else math.pi / 2):
            sw = [{'x0': 3.0 + i * 3.6, 'x1': 4.2 + i * 3.6, 'z0': 3.4, 'z1': 7.2, 'arch': True, 'top': 7.8, 'depth': 0.3} for i in range(2)]
            H.wall_surface(b, 'stone', wy1 - wy0, wh, sw, step=1.4, jitter=STONE_J)
            for o in sw:
                H.window_fill(b, o, rng, {})
    H.gable_roof(b, 0, (wy0 + wy1) / 2, wh, wx, (wy1 - wy0) / 2, math.radians(50), 'x', eave=0.5, verge=0.4, mat='slate', rng=rng)
    zr = ((wy1 - wy0) / 2) * math.tan(math.radians(50))
    for sx in (-wx, wx):
        with b.at((sx, wy1 if sx < 0 else wy0, wh), -math.pi / 2 if sx < 0 else math.pi / 2):
            H.gable_wall(b, wy1 - wy0, zr, rng, 'grid', attic=True, mat='stone')
    # central cross gable over the portal
    H.gable_roof(b, 0, wy0 + 2.5, wh, 3.0, 4.0, math.radians(55), 'y', eave=0.4, verge=0.4, mat='slate', rng=rng, finial=True)
    with b.at((-4.0, wy0, wh)):
        g = H.gable_wall(b, 8.0, 4.0 * math.tan(math.radians(55)), rng, 'grid', attic=True, mat='stone')
    # dormers on the wing roof
    for sx in (-7.5, 7.5):
        H.dormer(b, sx, wy0, wh, math.radians(50), zr, (wy1 - wy0) / 2, rng)
    # corner stair turrets
    for sx in (-wx - 0.6, wx + 0.6):
        with b.at((sx, wy0 - 0.4, 0)):
            ring_wall(b, 'stone', 2.4, 2.4, 0.0, 15.0, n=18, rows=10, jitter=STONE_J)
            corbel_ring(b, 2.4, 15.5, 14)
            ring_wall(b, 'stone', 2.75, 2.75, 14.9, 15.5, n=18, rows=1)
            b.lathe('stone', [(2.4, 14.9), (2.75, 14.9)], 18, smooth=False)
            slit_ring(b, 2.4, [4.5, 9.0, 12.5], 3, phase=-math.pi / 2)
            cone_roof(b, 2.6, 15.5, 7.5, 'slate', n=16)
    # ---- keep: x[-6.5,6.5], y[4,17]
    kx, ky0, ky1, kh = 6.5, 4.0, 17.0, 29.0
    kwins = []
    for z0 in (13.0, 19.5, 24.5):
        for sx in (-3.0, 3.0) if z0 < 24 else (-3.6, 0.0, 3.6):
            kwins.append({'x0': kx + sx - 0.55, 'x1': kx + sx + 0.55, 'z0': z0, 'z1': z0 + 2.0, 'arch': True, 'top': z0 + 2.55, 'depth': 0.4, 'ground': True})
    for face in range(4):
        rz = [0.0, math.pi / 2, math.pi, -math.pi / 2][face]
        ox, oy = [(-kx, ky0), (kx, ky0), (kx, ky1), (-kx, ky1)][face]
        wlen = kx * 2 if face % 2 == 0 else ky1 - ky0
        with b.at((ox, oy, 0), rz):
            ww = [dict(o, x0=o['x0'] * wlen / (2 * kx), x1=o['x1'] * wlen / (2 * kx)) for o in kwins] if face % 2 else kwins
            for o in ww:
                o['x1'] = o['x0'] + 1.1
            H.wall_surface(b, 'stone', wlen, kh, ww if face != 0 else [o for o in ww if o['z0'] > 12], step=1.5, jitter=STONE_J)
            for o in ww:
                H.window_fill(b, o, rng, {})
            # pilaster strips + band courses
            for zz in (12.0, 18.5, 24.0):
                b.cuboid('stone', -0.1, wlen + 0.1, -0.22, 0.0, zz - 0.25, zz, jitter=0.03)
            b.cuboid('stone', -0.2, wlen + 0.2, -0.3, 0.0, kh - 0.6, kh - 0.2, jitter=0.03)
            x = 0.3
            while x < wlen - 0.3:
                b.cuboid('stone', x - 0.15, x + 0.15, -0.5, 0.0, kh - 1.2, kh - 0.6, jitter=0.1, skip=('+y',))
                x += 0.9
    # keep parapet + merlons
    for (x0, x1, y0, y1) in ((-kx - 0.4, kx + 0.4, ky0 - 0.4, ky0 + 0.2), (-kx - 0.4, kx + 0.4, ky1 - 0.2, ky1 + 0.4),
                             (-kx - 0.4, -kx + 0.2, ky0, ky1), (kx - 0.2, kx + 0.4, ky0, ky1)):
        b.cuboid('stone', x0, x1, y0, y1, kh - 0.2, kh + 0.9, jitter=0.05)
        along_x = (x1 - x0) > (y1 - y0)
        t = x0 if along_x else y0
        end = x1 if along_x else y1
        while t < end - 0.4:
            t1 = min(t + 0.9, end)
            if along_x:
                b.cuboid('stone', t + 0.03, t1 - 0.03, y0, y1, kh + 0.9, kh + 1.9, jitter=0.1)
            else:
                b.cuboid('stone', x0, x1, t + 0.03, t1 - 0.03, kh + 0.9, kh + 1.9, jitter=0.1)
            t += 1.6
    # bartizans at the corners
    for cx, cy in ((-kx, ky0), (kx, ky0), (kx, ky1), (-kx, ky1)):
        with b.at((cx, cy, kh - 3.0)):
            b.lathe('stone', [(0.0, -1.6), (0.6, -1.4), (1.2, -0.6), (1.45, 0.0)], 12, smooth=True)
            ring_wall(b, 'stone', 1.45, 1.45, 0.0, 4.2, n=12, rows=3)
            slit_ring(b, 1.45, [1.2], 2, w=0.18, h=0.9, phase=math.atan2(cy - 10.5, cx))
            cone_roof(b, 1.5, 4.2, 4.6, 'slate', n=12)
    # keep roof: steep pyramid with a hexagonal lantern + spire + crystal
    zc = kh + 0.6
    pts = [V(-kx + 0.4, ky0 + 0.4, zc), V(kx - 0.4, ky0 + 0.4, zc), V(kx - 0.4, ky1 - 0.4, zc), V(-kx + 0.4, ky1 - 0.4, zc)]
    apex_h = 7.5
    ctr = V(0, (ky0 + ky1) / 2, zc + apex_h)
    hexr = 1.9
    for i in range(4):
        a, c = pts[i], pts[(i + 1) % 4]
        # truncated at the lantern base
        t = 0.72
        a2, c2 = a.lerp(ctr, t), c.lerp(ctr, t)
        n = newell([a, c, c2])
        # tile rows on the pyramid faces
        rows = 16
        for r in range(rows):
            u0, u1 = r / rows * t, min(t, (r + 1) / rows * t + 0.01)
            p0, p1 = a.lerp(ctr, u0), c.lerp(ctr, u0)
            q0, q1 = a.lerp(ctr, u1), c.lerp(ctr, u1)
            lift = n * 0.06
            L = (c - a).length
            H.face_facing(b, 'slate', [p0 + lift, p1 + lift, q1, q0], n, [(0, 0.05 + r * 0.1), (L / 2.2, 0.05 + r * 0.1), (L / 2.2 * (1 - u1), 0.15 + r * 0.1), (0, 0.15 + r * 0.1)])
            H.face_facing(b, 'slate', [p0, p1, p1 + lift, p0 + lift], -(ctr - (a + c) / 2).normalized())
    ztop = zc + apex_h * 0.72
    with b.at((0, (ky0 + ky1) / 2, ztop)):
        b.lathe('stone', [(2.4, 0.0), (2.4, 0.4), (hexr, 0.4)], 6, smooth=False, phase=math.pi / 6)
        # six pillars with arches (open belfry)
        for i in range(6):
            a = math.pi / 6 + i * math.pi / 3
            with b.at((hexr * math.cos(a), hexr * math.sin(a), 0.4), a):
                b.cuboid('stone', -0.22, 0.22, -0.22, 0.22, 0.0, 3.0, jitter=0.05)
        b.lathe('stone', [(hexr + 0.25, 3.0), (hexr + 0.35, 3.3), (hexr + 0.2, 3.6)], 6, smooth=False, phase=math.pi / 6, cap_top=True)
        b.lathe('gold', [(0.5, 0.4), (0.5, 2.6)], 6, smooth=False, phase=math.pi / 6, cap_top=True)
        # hexagonal spire
        b.lathe('slate', [(hexr + 0.3, 3.6), (hexr * 0.55, 6.2), (0.0, 9.2)], 6, smooth=False, phase=math.pi / 6, uvscale=1 / 2.2)
        # Aether crystal finial
        b.lathe('aether', [(0.0, 9.0), (0.42, 9.8), (0.42, 11.0), (0.0, 12.2)], 6, smooth=False)
        b.lathe('gold', [(0.25, 8.9), (0.5, 9.15), (0.0, 9.35)], 6, smooth=False)
    # keep entrance door from the terrace (back of the wing) is hidden; ivy on one keep face
    with b.at((kx, ky1, 0), math.pi):
        H.ivy_curtain(b, 1.0, 6.0, 12.0, rng, length=8.0)
    return b.finish(name, ground=0.48, ao_dist=2.2, rays=10)


# ============================================================== fountain
def fountain(name, seed=6):
    b = Builder(seed)
    R = 4.7
    # step ring + basin (hexagonal)
    b.lathe('stone', [(R + 0.9, 0.0), (R + 0.9, 0.22), (R + 0.3, 0.22)], 6, smooth=False, phase=math.pi / 6, jitter=0.05)
    b.lathe('stone', [(R + 0.3, 0.22), (R + 0.3, 0.75), (R + 0.45, 0.85), (R + 0.45, 0.98), (R - 0.15, 0.98), (R - 0.15, 0.55)], 6, smooth=False, phase=math.pi / 6, jitter=0.05)
    b.lathe('water', [(0.0, 0.72), (R - 0.15, 0.72)], 6, smooth=False, phase=math.pi / 6)
    # carved panels on the basin faces (gold hexagon inlays)
    for i in range(6):
        a = i * math.pi / 3
        rr = (R + 0.3) * math.cos(math.pi / 6)
        with b.at((rr * math.cos(a), rr * math.sin(a), 0.5), a + math.pi / 2):
            b.cuboid('stone', -1.4, 1.4, -0.04, 0.0, -0.2, 0.2, jitter=0.03)
            hexp = [V(0.16 * math.cos(math.pi / 3 * k + math.pi / 6), -0.06, 0.16 * math.sin(math.pi / 3 * k + math.pi / 6)) for k in range(6)]
            H.face_facing(b, 'gold', hexp, V(0, -1, 0))
    # pedestal, bowls
    b.lathe('stone', [(1.1, 0.5), (1.1, 0.8), (0.8, 1.0), (0.6, 1.2), (0.55, 1.9), (0.75, 2.05)], 12, smooth=True)
    b.lathe('stone', [(0.75, 2.05), (1.9, 2.25), (2.25, 2.45), (2.25, 2.6), (2.0, 2.6), (1.9, 2.45)], 18, smooth=True, cap_top=False)
    b.lathe('water', [(0.0, 2.48), (1.95, 2.48)], 18, smooth=False)
    b.lathe('gold', [(2.26, 2.48), (2.3, 2.52), (2.26, 2.56)], 18, smooth=True)
    b.lathe('stone', [(0.42, 2.45), (0.38, 3.4), (0.5, 3.5)], 10, smooth=True)
    b.lathe('stone', [(0.5, 3.5), (1.05, 3.62), (1.2, 3.78), (1.2, 3.86), (1.0, 3.86)], 14, smooth=True)
    b.lathe('water', [(0.0, 3.8), (1.02, 3.8)], 14, smooth=False)
    b.lathe('stone', [(0.45, 3.8), (0.5, 4.05), (0.35, 4.15), (0.0, 4.15)], 6, smooth=False, phase=math.pi / 6)
    b.lathe('gold', [(0.52, 4.0), (0.56, 4.05), (0.52, 4.1)], 6, smooth=False, phase=math.pi / 6)
    # spouts on the column feeding the lower basin
    for i in range(6):
        a = i * math.pi / 3 + math.pi / 6
        with b.at((0.6 * math.cos(a), 0.6 * math.sin(a), 1.55), a):
            b.cuboid('gold', 0.0, 0.32, -0.06, 0.06, -0.05, 0.05)
    # water curtains (thin translucent rings)
    b.lathe('water', [(2.28, 2.5), (2.4, 1.6), (2.55, 0.74)], 18, smooth=True)
    b.lathe('water', [(1.22, 3.78), (1.3, 3.2), (1.35, 2.5)], 14, smooth=True)
    return b.finish(name, ground=0.0, ao_dist=1.2, rays=10, ao_skip=('glow', 'water', 'aether', 'gold'))


def crystal(name):
    b = Builder(7)
    # hexagonal bipyramid prism, origin at its centre
    b.lathe('aether', [(0.0, -1.35), (0.55, -0.6), (0.55, 0.65), (0.0, 1.55)], 6, smooth=False)
    for i in range(3):
        a = i * 2 * math.pi / 3
        with b.at((1.0 * math.cos(a), 1.0 * math.sin(a), -0.2 + 0.3 * i)):
            b.lathe('aether', [(0.0, -0.32), (0.13, -0.1), (0.13, 0.12), (0.0, 0.36)], 6, smooth=False)
    return b.finish(name, ao=False)


# ============================================================== windmill
def windmill(name, seed=8):
    b = Builder(seed)
    rng = random.Random(seed)
    h = 11.0
    ring_wall(b, 'stone', 3.6, 3.6, -3.0, 0.2, n=16, rows=1, jitter=STONE_J)
    ring_wall(b, 'plaster', 3.3, 2.5, 0.2, h, n=16, rows=8)
    b.lathe('stone', [(3.35, 0.2), (3.35, 0.7), (3.25, 0.7)], 16, smooth=True)
    # timber bands
    for z in (4.0, 7.6):
        r = lerp(3.3, 2.5, (z - 0.2) / (h - 0.2))
        b.lathe('timber', [(r + 0.02, z), (r + 0.08, z), (r + 0.08, z + 0.22), (r + 0.02, z + 0.22)], 16, smooth=False)
    # door + windows
    with b.at((0, -3.25, 0.2)):
        b.cuboid('planks', -0.55, 0.55, -0.1, 0.05, 0.0, 2.0)
        b.cuboid('timber', -0.7, 0.7, -0.15, 0.05, 2.0, 2.2, uv='beam')
    for z, a in ((5.6, 0.0), (8.6, 2.2), (3.0, 3.5)):
        r = lerp(3.3, 2.5, (z - 0.2) / (h - 0.2))
        with b.at((r * math.sin(a), -r * math.cos(a), z), a):
            b.cuboid('timber', -0.4, 0.4, -0.12, 0.05, -0.05, 1.0, uv='beam')
            kit.glass_pane(b, -0.28, 0.28, 0.07, 0.9, -0.125)
            b.cuboid('paint', -0.75, -0.42, -0.14, -0.1, 0.0, 0.95)
            b.cuboid('paint', 0.42, 0.75, -0.14, -0.1, 0.0, 0.95)
    # gallery
    zg = 6.4
    rg = lerp(3.3, 2.5, (zg - 0.2) / (h - 0.2))
    b.lathe('planks', [(rg, zg), (rg + 1.1, zg), (rg + 1.1, zg - 0.12), (rg, zg - 0.12)], 20, smooth=False)
    for i in range(20):
        a = 2 * math.pi * i / 20
        with b.at(((rg + 1.0) * math.cos(a), (rg + 1.0) * math.sin(a), zg), a):
            b.cuboid('timber', -0.04, 0.04, -0.04, 0.04, 0.0, 1.0, uv='beam')
        with b.at(((rg + 0.2) * math.cos(a), (rg + 0.2) * math.sin(a), zg - 0.1), a):
            b.beam('timber', V(0, 0, 0), V(0.85, 0, 0) if False else V(0.0, 0.0, 0.0) + V(0, 0, 0), w=0.0) if False else None
    b.lathe('timber', [(rg + 1.06, zg + 1.0), (rg + 1.14, zg + 1.0), (rg + 1.14, zg + 1.08), (rg + 1.06, zg + 1.08)], 20, smooth=False)
    for i in range(10):
        a = 2 * math.pi * (i + 0.5) / 10
        p0 = V(rg * math.cos(a), rg * math.sin(a), zg - 1.0)
        p1 = V((rg + 1.0) * math.cos(a), (rg + 1.0) * math.sin(a), zg - 0.1)
        b.beam('timber', p0, p1, w=0.12, d=0.12)
    # rotating cap (static here): onion-ish roof with a ridge toward the sails
    b.lathe('timber', [(2.65, h), (2.75, h + 0.3), (2.5, h + 0.35)], 16, smooth=False)
    b.lathe('roof', [(2.75, h + 0.3), (2.85, h + 1.4), (2.3, h + 2.6), (1.2, h + 3.6), (0.0, h + 4.2)], 16, smooth=True, uvscale=1 / 2.2)
    b.lathe('gold', [(0.12, h + 4.1), (0.2, h + 4.4), (0.0, h + 5.0)], 8, smooth=True)
    # windshaft housing toward -Y
    b.cuboid('timber', -0.5, 0.5, -3.4, -1.8, h + 1.1, h + 2.0, uv='beam')
    # small fan-tail at the back
    b.beam('timber', V(0, 2.4, h + 1.0), V(0, 4.6, h - 1.5), w=0.15, d=0.15)
    b.beam('timber', V(0, 4.6, h - 1.5), V(0, 4.6, 0.2), w=0.14, d=0.14)
    obj = b.finish(name, ground=-0.02, ao_dist=1.6, rays=10)
    return obj


def sails(name, seed=9):
    """Four lattice sails with cloth, origin at the hub; rotate around local Y (Blender) = runtime Z."""
    b = Builder(seed)
    L, W = 11.0, 2.3
    b.lathe('timber', [(0.0, -0.5), (0.5, -0.4), (0.55, 0.3), (0.0, 0.4)], 10, smooth=True) if False else None
    with b.at((0, 0, 0)):
        # hub along -Y
        b.push(kit.Matrix.Rotation(math.pi / 2, 4, 'X'))
        b.lathe('timber', [(0.0, -0.6), (0.45, -0.5), (0.5, 0.3), (0.3, 0.6), (0.0, 0.65)], 10, smooth=True)
        b.lathe('gold', [(0.18, 0.62), (0.22, 0.7), (0.0, 0.85)], 8, smooth=True)
        b.pop()
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        ca, sa = math.cos(a), math.sin(a)
        d = V(ca, 0, sa)
        perp = V(-sa, 0, ca)
        # stock
        b.beam('timber', V(0, -0.35, 0), d * L + V(0, -0.35, 0), w=0.22, d=0.22, up=(0, 1, 0))
        # lattice: rails + bars
        o0, o1 = 1.6, L - 0.2
        for off in (0.25, W):
            b.beam('timber', d * o0 + perp * off + V(0, -0.45, 0), d * o1 + perp * off + V(0, -0.45, 0), w=0.08, d=0.08, up=(0, 1, 0))
        n = 9
        for i in range(n + 1):
            t = lerp(o0, o1, i / n)
            b.beam('timber', d * t + V(0, -0.45, 0), d * t + perp * W + V(0, -0.45, 0), w=0.07, d=0.07, up=(0, 1, 0))
        # cloth panel (slightly billowed: two strips)
        cl = (0.97, 0.93, 0.84)
        for i in range(n):
            t0, t1 = lerp(o0, o1, i / n), lerp(o0, o1, (i + 1) / n)
            billow = V(0, -0.15, 0)
            pa, pb = d * t0 + perp * 0.25 + V(0, -0.5, 0), d * t1 + perp * 0.25 + V(0, -0.5, 0)
            pc, pd_ = d * t1 + perp * W + V(0, -0.5, 0), d * t0 + perp * W + V(0, -0.5, 0)
            mid0, mid1 = (pa + pd_) / 2 + billow, (pb + pc) / 2 + billow
            c = cl if i % 3 else (0.85, 0.42, 0.3)
            for P in ([pa, pb, mid1, mid0], [mid0, mid1, pc, pd_]):
                b.face('cloth', P, [(0, 0), (1, 0), (1, 1), (0, 1)], c)
    return b.finish(name, ao=False)


# ============================================================== terrace balustrade / retaining wall
def balustrade(name, seed=10, L=6.0):
    b = Builder(seed)
    hl = L / 2
    b.cuboid('stone', -hl, hl, -0.45, 0.45, -9.0, 0.0, jitter=STONE_J, sub=(4, 6), skip=('-x', '+x', '-z'))
    b.cuboid('stone', -hl, hl, -0.55, 0.0, -9.0, -0.3, jitter=STONE_J, sub=(4, 6), skip=('-x', '+x', '-z', '+y'))
    b.cuboid('stone', -hl, hl, -0.35, 0.35, 0.0, 0.18, jitter=0.04, skip=('-x', '+x'))
    b.cuboid('stone', -hl, hl, -0.3, 0.3, 0.92, 1.08, jitter=0.04, skip=('-x', '+x'))
    for x in (-hl + 0.3,):
        b.cuboid('stone', x - 0.3, x + 0.3, -0.38, 0.38, 0.0, 1.25, jitter=0.05)
        b.cuboid('stone', x - 0.36, x + 0.36, -0.44, 0.44, 1.25, 1.36, jitter=0.03)
    n = int((L - 0.8) / 0.32)
    for i in range(n):
        x = -hl + 0.75 + i * (L - 1.1) / n
        with b.at((x, 0, 0.18)):
            b.lathe('stone', [(0.1, 0.0), (0.1, 0.06), (0.07, 0.12), (0.12, 0.35), (0.07, 0.6), (0.09, 0.68), (0.09, 0.74)], 6, smooth=True)
    return b.finish(name, ground=None, ao_dist=1.0, rays=8)


BUILDERS = {
    'wall_seg': lambda: wall_segment('wall_seg', False, 11),
    'wall_seg_ivy': lambda: wall_segment('wall_seg_ivy', True, 12),
    'tower': lambda: tower('tower', True, 21),
    'tower_flat': lambda: tower('tower_flat', False, 22, h=11.0),
    'gate': lambda: gatehouse('gate'),
    'bridge': lambda: bridge('bridge'),
    'hall': lambda: hall('hall'),
    'fountain': lambda: fountain('fountain'),
    'crystal': lambda: crystal('crystal'),
    'windmill': lambda: windmill('windmill'),
    'sails': lambda: sails('sails'),
    'balustrade': lambda: balustrade('balustrade'),
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = argv[argv.index('--only') + 1].split(',') if '--only' in argv else list(BUILDERS)
    preview = argv[argv.index('--preview') + 1] if '--preview' in argv else None
    kit.reset_scene()
    x = 0
    for n in only:
        o = BUILDERS[n]()
        print('PIECE', n, len(o.data.polygons), 'polys')
        if preview:
            o.location.x = x
            x += o.dimensions.x + 4
    if preview:
        import preview as pv
        pv.render(preview)
    else:
        kit.export_glb('landmarks.glb')


if __name__ == '__main__':
    main()
