extends SceneTree
## Builds BoneMap resources that map Godot's SkeletonProfileHumanoid to our two rigs:
## VRoid (J_Bip_*) characters and the Unreal-style animation FBX skeleton. Verifies every mapped bone exists.
## godot --headless --path . --script res://tools/make_bonemaps.gd

const SIDES := {"Left": ["L", "l"], "Right": ["R", "r"]}


func vroid_map() -> Dictionary:
	var m := {"Root": "Root", "Hips": "J_Bip_C_Hips", "Spine": "J_Bip_C_Spine", "Chest": "J_Bip_C_Chest",
		"UpperChest": "J_Bip_C_UpperChest", "Neck": "J_Bip_C_Neck", "Head": "J_Bip_C_Head",
		"LeftEye": "J_Adj_L_FaceEye", "RightEye": "J_Adj_R_FaceEye"}
	for side in SIDES:
		var s: String = SIDES[side][0]
		m[side + "Shoulder"] = "J_Bip_%s_Shoulder" % s
		m[side + "UpperArm"] = "J_Bip_%s_UpperArm" % s
		m[side + "LowerArm"] = "J_Bip_%s_LowerArm" % s
		m[side + "Hand"] = "J_Bip_%s_Hand" % s
		m[side + "ThumbMetacarpal"] = "J_Bip_%s_Thumb1" % s
		m[side + "ThumbProximal"] = "J_Bip_%s_Thumb2" % s
		m[side + "ThumbDistal"] = "J_Bip_%s_Thumb3" % s
		for f in [["Index", "Index"], ["Middle", "Middle"], ["Ring", "Ring"], ["Little", "Little"]]:
			m[side + f[0] + "Proximal"] = "J_Bip_%s_%s1" % [s, f[1]]
			m[side + f[0] + "Intermediate"] = "J_Bip_%s_%s2" % [s, f[1]]
			m[side + f[0] + "Distal"] = "J_Bip_%s_%s3" % [s, f[1]]
		m[side + "UpperLeg"] = "J_Bip_%s_UpperLeg" % s
		m[side + "LowerLeg"] = "J_Bip_%s_LowerLeg" % s
		m[side + "Foot"] = "J_Bip_%s_Foot" % s
		m[side + "Toes"] = "J_Bip_%s_ToeBase" % s
	return m


func unreal_map() -> Dictionary:
	var m := {"Root": "root", "Hips": "pelvis", "Spine": "spine_01", "Chest": "spine_02", "UpperChest": "spine_03",
		"Neck": "neck_01", "Head": "Head"}
	for side in SIDES:
		var s: String = SIDES[side][1]
		m[side + "Shoulder"] = "clavicle_" + s
		m[side + "UpperArm"] = "upperarm_" + s
		m[side + "LowerArm"] = "lowerarm_" + s
		m[side + "Hand"] = "hand_" + s
		m[side + "ThumbMetacarpal"] = "thumb_01_" + s
		m[side + "ThumbProximal"] = "thumb_02_" + s
		m[side + "ThumbDistal"] = "thumb_03_" + s
		for f in [["Index", "index"], ["Middle", "middle"], ["Ring", "ring"], ["Little", "pinky"]]:
			m[side + f[0] + "Proximal"] = "%s_01_%s" % [f[1], s]
			m[side + f[0] + "Intermediate"] = "%s_02_%s" % [f[1], s]
			m[side + f[0] + "Distal"] = "%s_03_%s" % [f[1], s]
		m[side + "UpperLeg"] = "thigh_" + s
		m[side + "LowerLeg"] = "calf_" + s
		m[side + "Foot"] = "foot_" + s
		m[side + "Toes"] = "ball_" + s
	return m


func build(map: Dictionary, out: String) -> void:
	var bm := BoneMap.new()
	bm.profile = SkeletonProfileHumanoid.new()
	for k in map:
		bm.set_skeleton_bone_name(StringName(k), StringName(map[k]))
	var err := ResourceSaver.save(bm, out)
	print("saved ", out, " err=", err, " bones=", map.size())


func check(scene_path: String, map: Dictionary) -> void:
	var scene: Node = (load(scene_path) as PackedScene).instantiate()
	var sk: Skeleton3D = scene.find_children("*", "Skeleton3D", true, false)[0]
	var missing := []
	for k in map:
		if sk.find_bone(map[k]) < 0:
			missing.append(map[k])
	print(scene_path, " missing=", missing)
	scene.free()


func _init() -> void:
	build(vroid_map(), "res://assets/characters/bonemap_vroid.tres")
	build(unreal_map(), "res://assets/animations/bonemap_unreal.tres")
	for id in ["kael", "lyra", "maren", "wenna", "toma", "ostin", "hesk", "veyra"]:
		check("res://assets/characters/vrm/%s.glb" % id, vroid_map())
	check("res://assets/animations/idle.fbx", unreal_map())
	quit()
