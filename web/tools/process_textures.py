"""Turns AI-painted source images (assets_src/ai/*.png) into game textures (public/assets/textures/).

* Opaque textures: measure the wrap seam; if visible, blend with a half-offset copy so they tile.
* Foliage/decal cards: chroma-key the flat background, un-mix the key colour from the edges,
  and bleed colour into transparent pixels so mipmaps don't get dark/coloured halos.
Run: python tools/process_textures.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "assets_src", "ai")
DST = os.path.join(ROOT, "public", "assets", "textures")
os.makedirs(DST, exist_ok=True)

STRUCTURED = {"stone_wall", "wood_planks", "roof_tiles", "cobblestone", "timber"}
OPAQUE = ["roof_tiles", "plaster", "timber", "cobblestone", "stone_wall", "grass", "dirt_path", "rock_cliff", "bark", "wood_planks"]
CARDS = {"leaves_broadleaf": (255, 0, 255), "leaves_pine": (255, 0, 255), "ivy": (255, 0, 255),
         "flowers": (255, 0, 255), "leaves_blossom": (0, 255, 0)}


def seam_ratio(a):
    inner = np.abs(np.diff(a, axis=1)).mean() + np.abs(np.diff(a, axis=0)).mean()
    wrap = np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0, :] - a[-1, :]).mean()
    return wrap / max(inner, 1e-6)


def make_seamless(a):
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    s = lambda t: np.clip(np.minimum(t, 1 - t) / 0.22, 0, 1) ** 2
    m = (s(x) * s(y))[..., None]          # 1 in the middle (original), 0 at borders (rolled = seamless edges)
    return a * m + rolled * (1 - m)


for name in OPAQUE:
    p = os.path.join(SRC, name + ".png")
    if not os.path.exists(p):
        print("missing", name)
        continue
    a = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
    r = seam_ratio(a)
    fixed = r > 1.6 and name not in STRUCTURED   # patterned textures use MirroredRepeatWrapping instead
    if fixed:
        a = make_seamless(a)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(DST, name + ".jpg"), quality=90, optimize=True)
    print(f"{name}.jpg seam_ratio={r:.2f} {'(blended)' if fixed else ''}")

for name, key in CARDS.items():
    p = os.path.join(SRC, name + ".png")
    if not os.path.exists(p):
        print("missing", name)
        continue
    c = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
    k = np.array(key, dtype=np.float32)
    d = np.linalg.norm(c - k, axis=2) / 441.7
    a = np.clip((d - 0.10) / (0.24 - 0.10), 0, 1)
    a = a * a * (3 - 2 * a)
    am = np.maximum(a, 0.05)[..., None]
    rgb = np.clip((c - (1 - a)[..., None] * k) / am, 0, 255)
    # colour bleed into transparent areas (premultiplied blur)
    out = rgb.copy()
    for radius in (2, 6, 16, 40):
        pm = Image.fromarray((rgb * a[..., None]).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
        al = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
        pm = np.asarray(pm, dtype=np.float32)
        al = np.asarray(al, dtype=np.float32)[..., None] / 255.0
        fill = pm / np.maximum(al, 1e-3)
        mask = (a < 0.02)[..., None] & (al > 0.01)
        out = np.where(mask & (out.sum(axis=2, keepdims=True) == rgb.sum(axis=2, keepdims=True)), fill, out)
    rgba = np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(os.path.join(DST, name + ".png"), optimize=True)
    print(f"{name}.png keyed ({(a > 0.5).mean() * 100:.0f}% opaque)")
