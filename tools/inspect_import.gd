extends SceneTree
## Prints the structure of imported character / animation scenes (skeleton paths, bones, materials, clips).
## godot --headless --path . --script res://tools/inspect_import.gd

func _init() -> void:
	for path in ["res://assets/characters/vrm/kael.glb", "res://assets/animations/idle.fbx"]:
		var scene: Node = (load(path) as PackedScene).instantiate()
		print("== ", path)
		_walk(scene, scene, 0)
		scene.free()
	quit()


func _walk(root: Node, n: Node, depth: int) -> void:
	if n is Skeleton3D:
		var sk := n as Skeleton3D
		var names := []
		for i in min(sk.get_bone_count(), 12):
			names.append(sk.get_bone_name(i))
		print("  SKELETON path=", root.get_path_to(n), " bones=", sk.get_bone_count(), " first=", names, " unique=", n.unique_name_in_owner)
	elif n is MeshInstance3D and depth < 6:
		var mi := n as MeshInstance3D
		var mats := []
		for s in min(mi.mesh.get_surface_count(), 6):
			var m := mi.mesh.surface_get_material(s)
			mats.append("%s(%s,%s)" % [m.resource_name if m else "null", m.get_class() if m else "", (m as BaseMaterial3D).shading_mode if m is BaseMaterial3D else -1])
		print("  MESH ", root.get_path_to(n), " surfaces=", mi.mesh.get_surface_count(), " ", mats)
	elif n is AnimationPlayer:
		var ap := n as AnimationPlayer
		for a in ap.get_animation_list():
			var anim := ap.get_animation(a)
			print("  ANIM ", a, " len=", anim.length, " tracks=", anim.get_track_count(), " first_track=", anim.track_get_path(0) if anim.get_track_count() else "")
	for c in n.get_children():
		_walk(root, c, depth + 1)
