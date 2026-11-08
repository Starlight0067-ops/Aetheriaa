extends Node
## Measures FPS at a fixed view while switching off render features one by one.
## godot --path . res://tests/perf_probe.tscn

var player: Player
var world: Node3D


func _fps(label: String) -> void:
	await get_tree().create_timer(1.0).timeout
	var t0 := Time.get_ticks_msec()
	var f0 := Engine.get_frames_drawn()
	await get_tree().create_timer(2.0).timeout
	var fps := float(Engine.get_frames_drawn() - f0) / ((Time.get_ticks_msec() - t0) / 1000.0)
	print("PERF %-28s %5.1f fps" % [label, fps])


func _ready() -> void:
	Game.reset_new_game()
	Quests.start("mq_awakening")
	world = load("res://scenes/regions/elyndra.tscn").instantiate()
	get_tree().root.add_child.call_deferred(world)
	await get_tree().create_timer(3.0).timeout
	Game.clear_ui()
	player = get_tree().get_first_node_in_group("player")
	var pos := Vector3(-6, 0, 12)
	pos.y = ElyndraLayout.height(pos.x, pos.z) + 0.3
	player.global_position = pos
	player.rig.yaw = 0.3
	player.rig.pitch = -0.15
	await _fps("baseline (town view)")
	for n in world.find_children("grass_*", "MultiMeshInstance3D", true, false) + world.find_children("flower_*", "MultiMeshInstance3D", true, false):
		n.visible = false
	await _fps("- grass & flowers")
	for n in world.find_children("*", "MultiMeshInstance3D", true, false):
		n.visible = false
	await _fps("- trees/rocks")
	for g in ["npc", "enemy"]:
		for n in get_tree().get_nodes_in_group(g):
			n.visible = false
	await _fps("- npcs & enemies")
	player.model.visible = false
	await _fps("- player model")
	var t := world.get_node("Terrain/TerrainMesh") as MeshInstance3D
	t.material_override = MeshKit.mat("terrain")
	await _fps("terrain -> standard mat")
	world.get_node("Terrain/Water").visible = false
	await _fps("- water")
	var we := world.find_children("*", "WorldEnvironment", true, false)[0] as WorldEnvironment
	we.environment.background_mode = Environment.BG_COLOR
	we.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	await _fps("sky -> flat color")
	world.get_node("Sun").shadow_enabled = false
	await _fps("- shadows")
	world.get_node("Architecture").visible = false
	await _fps("- architecture")
	get_tree().quit()
