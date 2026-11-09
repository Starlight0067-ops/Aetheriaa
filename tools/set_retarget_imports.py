"""Configures Godot import settings for humanoid retargeting.
VRoid characters (assets/characters/vrm/*.glb) and Unreal-style animation FBX (assets/animations/*.fbx) get a
BoneMap to SkeletonProfileHumanoid, bone renaming to a shared "GeneralSkeleton", rest fixing and silhouette fix,
so every animation plays on every character. VRMs also get the toon/merge post-import script.
Run: python tools/set_retarget_imports.py   (then reimport with godot --headless --import)
"""
import glob
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def subresources(node_path, bonemap):
    return ('_subresources={\n"nodes": {\n"PATH:%s": {\n'
            '"retarget/bone_map": Resource("%s"),\n'
            '"retarget/bone_renamer/rename_bones": true,\n'
            '"retarget/bone_renamer/unique_node/make_unique": true,\n'
            '"retarget/bone_renamer/unique_node/skeleton_name": "GeneralSkeleton",\n'
            '"retarget/rest_fixer/apply_node_transforms": true,\n'
            '"retarget/rest_fixer/normalize_position_tracks": true,\n'
            '"retarget/rest_fixer/overwrite_axis": true,\n'
            '"retarget/rest_fixer/fix_silhouette/enable": true\n'
            '}\n}\n}') % (node_path, bonemap)


def patch(path, node_path, bonemap, extra):
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"_subresources=\{.*?\n\}\n\}\n\}|_subresources=\{\}", lambda m: subresources(node_path, bonemap), s, flags=re.S)
    for k, v in extra.items():
        s = re.sub(r"^%s=.*$" % re.escape(k), "%s=%s" % (k, v), s, flags=re.M)
    open(path, "w", encoding="utf-8").write(s)
    print("patched", os.path.relpath(path, ROOT))


for p in glob.glob(os.path.join(ROOT, "assets", "characters", "vrm", "*.glb.import")):
    patch(p, "Skeleton3D", "res://assets/characters/bonemap_vroid.tres",
          {"import_script/path": '"res://tools/vrm_post_import.gd"', "meshes/generate_lods": "false",
           "meshes/create_shadow_meshes": "false"})
for p in glob.glob(os.path.join(ROOT, "assets", "animations", "*.fbx.import")):
    patch(p, "Scene/Armature/Skeleton3D", "res://assets/animations/bonemap_unreal.tres", {})
