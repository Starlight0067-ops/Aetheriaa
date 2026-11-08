"""AETHERIA - Blender asset pipeline for Elyndra props.

Run headless (no GUI needed, keeps RAM use low on the dev laptop):
    blender -b --factory-startup -P blender/scripts/build_elyndra_props.py

Builds original stylized low-poly props, saves the source .blend to
blender/projects/ and exports one GLB per prop to assets/models/.
All geometry is generated here, so the assets are wholly project-owned.
"""
import math
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXPORT_DIR = os.path.join(ROOT, "assets", "models")
BLEND_PATH = os.path.join(ROOT, "blender", "projects", "elyndra_props.blend")
os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)

# ---------------------------------------------------------------- helpers
_materials = {}


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    # Blender stores linear colour
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def mat(name, color, emission=0.0, rough=0.8, metal=0.0):
    key = (name, color, emission)
    if key in _materials:
        return _materials[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgb(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission > 0:
        bsdf.inputs["Emission Color"].default_value = hex_rgb(color)
        bsdf.inputs["Emission Strength"].default_value = emission
    _materials[key] = m
    return m


def finish(obj, material, parent=None, smooth=False):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if parent is not None:
        obj.parent = parent
    for p in obj.data.polygons:
        p.use_smooth = smooth
    return obj


def cube(name, loc, size, material, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, material, parent)


def cyl(name, loc, r1, r2, depth, material, verts=8, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return finish(o, material, parent)


def sphere(name, loc, scale, material, segments=10, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(4, segments // 2), radius=0.5, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, material, parent, smooth=True)


def empty(name):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    e = bpy.context.active_object
    e.name = name
    return e


def export(root, filename):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for c in root.children_recursive:
        c.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(EXPORT_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)
    tris = sum(len(c.data.polygons) for c in root.children_recursive if c.type == "MESH")
    print(f"[AETHERIA] exported {filename}  faces={tris}")


# ---------------------------------------------------------------- reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

STONE = mat("Stone_Town", "#C9BFA8")
STONE_D = mat("Stone_Dark", "#8E8A84")
CHOIR = mat("Stone_Choir", "#9AA7B5")
CHOIR_GLOW = mat("Aether_Glow", "#7FF5FF", emission=3.0)
LANTERN = mat("Lantern_Glow", "#FFD98A", emission=4.0)
WOOD = mat("Wood_Timber", "#7A5236")
WOOD_L = mat("Wood_Light", "#A87A4E")
CLOTH_R = mat("Cloth_Red", "#C2603F")
CLOTH_W = mat("Cloth_Sail", "#F2EBDD")
ROOF = mat("Roof_Slate", "#4E5D78")
WATER = mat("Water_Still", "#3E78B8", rough=0.1)
IRON = mat("Metal_Iron", "#4A4A55", rough=0.5, metal=0.6)
GOLD = mat("Metal_Brass", "#C9A15B", rough=0.4, metal=0.8)

# ---------------------------------------------------------------- 1. Lantern Maiden statue
root = empty("LanternMaidenStatue")
cyl("Plinth", (0, 0, 0.4), 1.3, 1.4, 0.8, CHOIR, 6, root)
cyl("PlinthTrim", (0, 0, 0.82), 1.15, 1.15, 0.08, CHOIR_GLOW, 6, root)
cyl("Robe", (0, 0, 1.9), 0.25, 0.75, 2.2, CHOIR, 10, root)
sphere("Chest", (0, 0, 3.05), (0.6, 0.45, 0.5), CHOIR, 10, root)
sphere("Head", (0, 0, 3.55), (0.42, 0.42, 0.48), CHOIR, 12, root)
sphere("Hood", (0, 0.05, 3.62), (0.5, 0.5, 0.52), STONE_D, 12, root)
cyl("Veil", (0, 0.18, 2.9), 0.2, 0.55, 1.4, STONE_D, 10, root)
cyl("ArmRaised", (0.35, -0.1, 3.6), 0.09, 0.11, 1.2, CHOIR, 6, root, rot=(math.radians(-15), math.radians(25), 0))
cyl("ArmLow", (-0.38, -0.05, 2.75), 0.09, 0.11, 0.9, CHOIR, 6, root, rot=(0, math.radians(-12), 0))
cyl("LanternCage", (0.6, -0.25, 4.35), 0.18, 0.18, 0.35, GOLD, 6, root)
sphere("LanternFlame", (0.6, -0.25, 4.35), (0.22, 0.22, 0.28), LANTERN, 8, root)
cyl("LanternCap", (0.6, -0.25, 4.6), 0.0, 0.22, 0.18, GOLD, 6, root)
for i in range(6):
    a = i * math.tau / 6
    cube(f"Rune{i}", (math.cos(a) * 1.36, math.sin(a) * 1.36, 0.45), (0.06, 0.4, 0.35), CHOIR_GLOW, root,
         rot=(0, 0, a))
export(root, "lantern_maiden_statue.glb")

# ---------------------------------------------------------------- 2. Stone well
root = empty("StoneWell")
for i in range(10):
    a = i * math.tau / 10
    cube(f"WellStone{i}", (math.cos(a) * 0.95, math.sin(a) * 0.95, 0.45), (0.55, 0.32, 0.9),
         STONE if i % 2 else STONE_D, root, rot=(0, 0, a))
cyl("WellWater", (0, 0, 0.55), 0.8, 0.8, 0.05, WATER, 16, root)
for s in (-1, 1):
    cube(f"Post{s}", (s * 1.0, 0, 1.4), (0.14, 0.14, 1.9), WOOD, root)
cube("Beam", (0, 0, 2.3), (2.3, 0.16, 0.16), WOOD, root)
cyl("RoofL", (0, 0, 2.75), 0.1, 1.5, 0.8, ROOF, 4, root, rot=(0, 0, math.radians(45)))
cyl("Bucket", (0, 0, 1.3), 0.18, 0.14, 0.3, WOOD_L, 8, root)
cube("Rope", (0, 0, 1.85), (0.03, 0.03, 0.9), WOOD_L, root)
export(root, "stone_well.glb")

# ---------------------------------------------------------------- 3. Market cart
root = empty("MarketCart")
cube("Bed", (0, 0, 0.9), (2.4, 1.3, 0.12), WOOD_L, root)
for sx, sy, sz, w, d, h in ((0, 0.62, 1.15, 2.4, 0.08, 0.45), (0, -0.62, 1.15, 2.4, 0.08, 0.45), (1.16, 0, 1.15, 0.08, 1.3, 0.45)):
    cube("Side", (sx, sy, sz), (w, d, h), WOOD, root)
for s in (-1, 1):
    cyl(f"Wheel{s}", (-0.4, s * 0.75, 0.55), 0.55, 0.55, 0.12, WOOD, 12, root, rot=(math.radians(90), 0, 0))
    cyl(f"Hub{s}", (-0.4, s * 0.83, 0.55), 0.12, 0.12, 0.08, IRON, 8, root, rot=(math.radians(90), 0, 0))
cube("HandleL", (-1.7, 0.4, 0.95), (1.2, 0.08, 0.08), WOOD, root)
cube("HandleR", (-1.7, -0.4, 0.95), (1.2, 0.08, 0.08), WOOD, root)
for i, c in enumerate(("#FFB36B", "#8BC34A", "#FF6A5A", "#FFD34D")):
    sphere(f"Produce{i}", (0.6 - i * 0.4, (i % 2) * 0.3 - 0.15, 1.15), (0.45, 0.45, 0.35), mat(f"Produce{i}", c), 8, root)
cube("Awning", (0.2, 0, 2.0), (2.6, 1.6, 0.06), CLOTH_R, root)
for sx in (-0.9, 1.1):
    for sy in (-0.6, 0.6):
        cube("Pole", (sx, sy, 1.45), (0.06, 0.06, 1.1), WOOD, root)
export(root, "market_cart.glb")

# ---------------------------------------------------------------- 4. Windmill (sails as separate node for animation)
root = empty("Windmill")
cyl("Tower", (0, 0, 3.0), 1.4, 2.0, 6.0, STONE, 8, root)
cyl("Cap", (0, 0, 6.8), 0.2, 1.7, 1.6, ROOF, 8, root)
cube("Door", (0, -1.9, 0.9), (0.9, 0.2, 1.6), WOOD, root)
cube("Window", (0, -1.55, 3.8), (0.6, 0.2, 0.7), mat("Window", "#2E4A6A"), root)
hub = empty("Sails")
hub.parent = root
hub.location = (0, -1.9, 6.2)
cyl("Axle", (0, 0, 0), 0.18, 0.18, 0.6, IRON, 8, hub, rot=(math.radians(90), 0, 0))
for i in range(4):
    a = i * math.tau / 4
    arm = cube(f"SailArm{i}", (math.cos(a) * 2.3, -0.1, math.sin(a) * 2.3), (4.4, 0.1, 0.14), WOOD, hub, rot=(0, -a, 0))
    cube(f"Sail{i}", (math.cos(a) * 2.6 - math.sin(a) * 0.45, -0.15, math.sin(a) * 2.6 + math.cos(a) * 0.45),
         (3.4, 0.04, 0.8), CLOTH_W, hub, rot=(0, -a, 0))
export(root, "windmill.glb")

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print("[AETHERIA] saved", BLEND_PATH)
