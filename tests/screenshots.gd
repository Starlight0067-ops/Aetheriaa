extends Node
## Renders the game from several authored viewpoints and saves PNGs to
## documentation/screenshots/. Run with a GPU (not headless):
##   godot --path . res://tests/screenshots.tscn

const OUT := "res://documentation/screenshots/"

var shots := [
	["01_whisperwood_start", Vector3(-56, 0, 80), PI * 0.15, -0.2],
	["02_vael_harrow_plaza", Vector3(10, 0, 14), 0.0, -0.22],
	["03_old_span_bridge", Vector3(-24, 0, 14), -PI * 0.25, -0.15],
	["04_choir_steps", Vector3(56, 0, -8), -PI * 0.35, -0.12],
	["05_lake_silverfall", Vector3(-38, 0, -48), 0.0, -0.05],
	["06_sanctum_arena", Vector3(80, 0, 12), PI, -0.25],
]


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	Game.reset_new_game()
	Game.set_flag("intro_seen")
	Quests.start("mq_awakening")      # skips the intro narration
	var world: Node3D = load("res://scenes/regions/elyndra.tscn").instantiate()
	get_tree().root.add_child.call_deferred(world)
	await get_tree().create_timer(2.5).timeout
	Game.clear_ui()
	var player := get_tree().get_first_node_in_group("player") as Player
	for s in shots:
		var pos: Vector3 = s[1]
		pos.y = ElyndraLayout.height(pos.x, pos.z) + 0.3
		player.global_position = pos
		player.velocity = Vector3.ZERO
		player.rotation.y = s[2]
		player.rig.yaw = s[2]
		player.rig.pitch = s[3]
		player.rig.global_position = pos + Vector3(0, 1.55, 0)
		await get_tree().create_timer(1.2).timeout
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		img.save_png(ProjectSettings.globalize_path(OUT + s[0] + ".png"))
		print("saved ", s[0], "  fps=", Engine.get_frames_per_second())
	get_tree().quit()
