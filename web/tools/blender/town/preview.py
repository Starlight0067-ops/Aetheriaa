# Quick Workbench preview of whatever is in the scene (vertex colours, flat lighting) for kit QA.
import bpy, math
from mathutils import Vector


def render(path, res=(1600, 900), elev=22, azim=-70, ortho=False, dist_k=2.3, color='MATERIAL'):
    sc = bpy.context.scene
    objs = [o for o in sc.objects if o.type == 'MESH']
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    ctr = (lo + hi) / 2
    rad = (hi - lo).length / 2
    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = 50
    cam = bpy.data.objects.new('cam', cam_d)
    sc.collection.objects.link(cam)
    e, a = math.radians(elev), math.radians(azim)
    dist = rad * dist_k
    cam.location = ctr + Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e))) * dist
    d = (ctr - cam.location)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = color
    sh.show_cavity = True
    sh.show_object_outline = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', path)
