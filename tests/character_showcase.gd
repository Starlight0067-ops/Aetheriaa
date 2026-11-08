extends Node3D
## Renders all Blender-made characters in a lineup plus face close-ups to
## documentation/screenshots/. Run with GPU:  godot --path . res://tests/character_showcase.tscn

const IDS := ["kael", "lyra", "maren", "ostin", "toma", "hesk", "wenna"]
const OUT := "res://documentation/screenshots/"


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var psm := ProceduralSkyMaterial.new()
	psm.sky_top_color = Color("#3F7FD8")
	psm.sky_horizon_color = Color("#CFE6FF")
	sky.sky_material = psm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.15
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-40), deg_to_rad(-35), 0)
	sun.light_color = Color("#FFE9CC")
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	add_child(sun)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	ground.mesh = pm
	ground.material_override = MeshKit.flat(Color("#7CC46A"))
	add_child(ground)
	var models: Array = []
	for i in IDS.size():
		var cm := CharacterModel.load_character(IDS[i])
		if cm == null:
			print("missing ", IDS[i])
			continue
		cm.position = Vector3((i - 3) * 0.95, 0, 0)
		cm.rotation.y = PI      # face the camera (+Z)
		add_child(cm)
		models.append(cm)
	var cam := Camera3D.new()
	cam.fov = 38
	add_child(cam)
	cam.current = true
	cam.position = Vector3(0, 1.0, 8.6)
	cam.look_at(Vector3(0, 0.85, 0))
	await get_tree().create_timer(1.5).timeout
	await _save("10_character_lineup")
	for i in models.size():
		var m: Node3D = models[i]
		var h := 1.5 if IDS[i] != "toma" else 1.2
		cam.fov = 30
		cam.position = m.position + Vector3(0.0, h + 0.03, 1.15)
		cam.look_at(m.position + Vector3(0, h, 0))
		await get_tree().create_timer(0.3).timeout
		await _save("11_face_%s" % IDS[i])
	get_tree().quit()


func _save(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path(OUT + name + ".png"))
	print("saved ", name)
