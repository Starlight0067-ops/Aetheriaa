extends Node3D
## Elyndra region root. Assembles the authored region (environment, terrain,
## architecture, vegetation, points of interest, NPCs, enemies, boss) and
## runs region-level logic (boss trigger, NPC relocation, autosave).

const L = preload("res://scripts/world/elyndra_layout.gd")

var player: Player
var boss: BossWarden
var core: Node3D
var lyra: NPC
var _sun: DirectionalLight3D
var _env: Environment
var _autosave := 300.0
var _tick := 0.0


func _ready() -> void:
	SaveManager.in_game = true
	Game.clear_ui()
	Game.world_positions.clear()
	_build_environment()
	var terrain := Node3D.new()
	terrain.name = "Terrain"
	add_child(terrain)
	TerrainBuilder.build_terrain(terrain)
	TerrainBuilder.build_water(terrain)
	TerrainBuilder.build_waterfall(terrain)
	var veg := Node3D.new()
	veg.name = "Vegetation"
	add_child(veg)
	TerrainBuilder.build_vegetation(veg, Settings.preset().grass)
	var arch := Node3D.new()
	arch.name = "Architecture"
	add_child(arch)
	StructureBuilder.build_town(arch)
	StructureBuilder.build_ruins(arch)
	StructureBuilder.build_arena(arch)
	core = StructureBuilder.build_core(arch)
	for c in [Vector2(-62, 36), Vector2(52, 40), Vector2(-52, -48)]:
		StructureBuilder.build_camp(arch, c)
	_place_points_of_interest()
	_place_npcs()
	_place_enemies()
	_spawn_player()
	add_child(HUD.new())
	add_child(DialogueUI.new())
	add_child(GameMenu.new())
	Settings.changed.connect(_apply_graphics)
	Sfx.play_music("music_elyndra")
	Sfx.play_ambient("amb_wind")
	Game.ui_focus_changed.emit(false)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if not Quests.is_active("mq_awakening") and not Quests.is_done("mq_awakening"):
		_intro()


func _p(x: float, z: float, lift: float = 0.0) -> Vector3:
	return Vector3(x, L.height(x, z) + lift, z)


func _add(node: Node3D, pos: Vector3, rot_y: float = 0.0) -> Node3D:
	node.position = pos
	node.rotation.y = rot_y
	add_child(node)
	return node


# ---------------------------------------------------------------- environment
func _build_environment() -> void:
	var we := WorldEnvironment.new()
	_env = Environment.new()
	_env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color("#4F8FE0")
	sm.sky_horizon_color = Color("#CFE8FF")
	sm.ground_horizon_color = Color("#CFE8FF")
	sm.ground_bottom_color = Color("#6E8F6A")
	sm.sun_angle_max = 20.0
	sky.sky_material = sm
	_env.sky = sky
	_env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	_env.ambient_light_energy = 0.55
	_env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_env.tonemap_exposure = 0.95
	_env.fog_light_color = Color("#CFE3F5")
	_env.fog_density = 0.0045
	_env.fog_sky_affect = 0.25
	_env.glow_intensity = 0.7
	_env.glow_bloom = 0.05
	_env.glow_hdr_threshold = 1.0
	_env.adjustment_enabled = true
	_env.adjustment_saturation = 1.12
	we.environment = _env
	add_child(we)
	_sun = DirectionalLight3D.new()
	_sun.name = "Sun"
	_sun.rotation = Vector3(deg_to_rad(-48), deg_to_rad(-35), 0)
	_sun.light_color = Color("#FFF0D6")
	_sun.light_energy = 1.25
	_sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	_sun.shadow_blur = 1.5
	add_child(_sun)
	_apply_graphics()


func _apply_graphics() -> void:
	var p := Settings.preset()
	_sun.shadow_enabled = p.shadows
	_sun.directional_shadow_max_distance = p.shadow_dist
	_env.fog_enabled = p.fog
	_env.glow_enabled = p.glow


# ---------------------------------------------------------------- content placement
func _place_points_of_interest() -> void:
	# landmarks
	for lm in [
		["whisperwood", "The Whisperwood", Vector2(-55, 70), 22.0, "landmark"],
		["vael_harrow", "Vael Harrow", Vector2(8, 0), 28.0, "town"],
		["old_span", "The Old Span", Vector2(L.river_x(0), 0), 6.0, "landmark"],
		["silverfall", "Silverfall & Lake Mirelle", Vector2(-40, -70), 30.0, "landmark"],
		["choir_steps", "The Choir Steps", L.RUINS, 14.0, "ruins"],
		["elyndra_core", "The Elyndra Core", L.CORE, 16.0, "ruins"],
		["harrow_overlook", "Harrow Overlook", L.OVERLOOK, 8.0, "landmark"],
		["hollow_sanctum", "The Hollow Sanctum", L.ARENA, 14.0, "boss"],
	]:
		_add(Landmark.create(lm[0], lm[1], lm[3], lm[4]), _p(lm[2].x, lm[2].y))

	# resonance stones (checkpoints)
	for cp in [["cp_forest", "Whisperwood Stone", -52, 74], ["cp_plaza", "Plaza Stone", 17, 5],
			["cp_lake", "Lakeside Stone", -30, -48], ["cp_ruins", "Choir Stone", 64, -11]]:
		_add(Checkpoint.create(cp[0], cp[1]), _p(cp[2], cp[3]))

	# signs
	for s in [["sign_harrow", -30, 4, "post", PI / 2.0], ["sign_forest", -52, 64, "post", 0.3], ["sign_east", 36, 3, "post", -PI / 2.0],
			["sign_lake", -24, -8, "post", PI], ["sign_ruins", 70, -12, "choir", 0.0], ["sign_brazier", 66, -27, "choir", PI],
			["sign_overlook", -80, -18, "post", 0.0]]:
		_add(SignPost.create(s[0], s[3]), _p(s[1], s[2]), s[4])

	# chests
	var chests := [
		["chest_forest_start", -62, 82, {"healing_tonic": 1, "copper_coin": 10}, ""],
		["chest_forest_camp", -58, 32, {"healing_tonic": 2, "copper_coin": 25}, ""],
		["chest_lake_west", -62, -60, {"riverstone": 2, "copper_coin": 20}, ""],
		["chest_lake_east", -22, -62, {"honey_bread": 2, "copper_coin": 30}, ""],
		["chest_bridge", -3.5, 7, {"riverstone": 1, "copper_coin": 15}, ""],
		["chest_tavern", 31, -11, {"honey_bread": 1, "copper_coin": 15}, ""],
		["chest_hidden_chamber", 66, -32, {"healing_tonic": 2, "copper_coin": 60}, "ruins_braziers_solved"],
		["chest_ruins_top", 79, -15, {"healing_tonic": 1, "copper_coin": 30}, ""],
		["chest_overlook", -80, -24, {"honey_bread": 2, "copper_coin": 40}, ""],
		["chest_sanctum", 80, 38, {"healing_tonic": 3, "copper_coin": 150}, "warden_defeated"],
		["chest_east_hill", 50, 46, {"healing_tonic": 1, "copper_coin": 20}, ""],
	]
	for c in chests:
		var lift := 0.55 if c[0] == "chest_ruins_top" else 0.0
		_add(Chest.create(c[0], c[3], 15 if c[4] == "" else 40, c[4]), _p(c[1], c[2], lift), randf() * 0.0)

	# gatherables
	var i := 0
	for p in [Vector2(5, 34), Vector2(12, 40), Vector2(20, 30), Vector2(-8, 38), Vector2(28, 36), Vector2(15, 50), Vector2(-2, 46), Vector2(34, 46)]:
		_add(Gatherable.create("sunpetal_%d" % i, "sunpetal"), _p(p.x, p.y)); i += 1
	i = 0
	for z in [20.0, 35.0, 50.0, -30.0, -42.0, 65.0]:
		var x := L.river_x(z) + 7.5
		_add(Gatherable.create("riverstone_%d" % i, "riverstone"), _p(x, z)); i += 1
	i = 0
	for p in [Vector2(-66, 58), Vector2(-52, 48), Vector2(-70, 70), Vector2(-44, 66), Vector2(-58, 42), Vector2(-74, 46)]:
		_add(Gatherable.create("glowcap_%d" % i, "glowcap"), _p(p.x, p.y)); i += 1

	# echo shards (hand placed at points of interest)
	var shards := [
		_p(-50, 76, 1.2), Vector3(L.river_x(0), 4.4, 0), _p(10, 0, 4.4), _p(-30, 30, 1.2), _p(-35, -50, 1.2),
		_p(-22, -58, 1.2), _p(-82, -22, 1.4), _p(-90, 40, 1.2), _p(30, -35, 1.2), _p(48, -8, 1.2),
		_p(80, -28, 1.2), _p(66, -30.5, 1.2), _p(45, 44, 1.2), _p(20, 70, 1.2), _p(-5, 70, 1.2),
		_p(60, 10, 1.2), _p(84, -40, 1.2), _p(-75, 85, 1.2),
	]
	for si in shards.size():
		_add(EchoShard.create("shard_%02d" % si), shards[si])

	# Choir devices
	_add(PuzzleObjects.resonance_lock(), Vector3(L.RUINS.x, 10.5, L.RUINS.y))
	for b in [["brazier_a", 64, -24], ["brazier_b", 60, -30], ["brazier_c", 71, -33]]:
		_add(PuzzleObjects.brazier(b[0], "ruins_braziers"), _p(b[1], b[2]))
	_add(PuzzleObjects.gate("ruins_braziers_solved", Vector3(5.0, 4.0, 0.6)), _p(66, -29.4))
	var gate_z := L.ARENA.y - 15.5 * cos(deg_to_rad(18.0))
	_add(PuzzleObjects.gate("sanctum_open", Vector3(9.4, 5.0, 0.8)), Vector3(L.ARENA.x, 10.0, gate_z))


func _place_npcs() -> void:
	lyra = NPC.create("lyra", {"skin": "#F3D2B8", "hair": "#3C6E5A", "hair_style": "ponytail", "eye": "#3FA87A",
		"outfit": "#E8D7B0", "outfit2": "#5FE8B0", "pants": "#4A5A6A", "boots": "#6B4630", "garment": "dress", "height": 0.95})
	_add(lyra, _lyra_spot())
	_add(NPC.create("maren", {"skin": "#E8C2A0", "hair": "#B8B8C0", "hair_style": "bun", "eye": "#4A5A7A",
		"outfit": "#5A3A5A", "outfit2": "#C9A15B", "pants": "#2E2A3A", "garment": "robe", "height": 1.02}), _p(12, -8.5), 0.0)
	_add(NPC.create("ostin", {"skin": "#D9B08C", "hair": "#4A3A2A", "hair_style": "bald", "eye": "#3A3A3A",
		"outfit": "#9AA7D9", "outfit2": "#F2EBDD", "garment": "robe", "height": 1.05}), _p(-19, -20), PI / 2.0)
	_add(NPC.create("toma", {"skin": "#C99572", "hair": "#2A1E18", "hair_style": "messy", "eye": "#6A4A2A",
		"outfit": "#E39A5A", "outfit2": "#7A5236", "pants": "#3A4A5A", "garment": "coat", "height": 0.78},
		[_p(15, 0), _p(10, 5), _p(5, 0), _p(10, -5)]), _p(15, 0))
	_add(NPC.create("hesk", {"skin": "#D9A07A", "hair": "#8A3A1E", "hair_style": "short", "eye": "#3A2A1A",
		"outfit": "#6A5A4A", "outfit2": "#3A2A1E", "pants": "#2A2A2A", "garment": "apron", "height": 1.1}), _p(2.5, 9.0), PI)
	_add(NPC.create("wenna", {"skin": "#F0C8A8", "hair": "#C97A3A", "hair_style": "long", "eye": "#5A7A3A",
		"outfit": "#B5654A", "outfit2": "#F2EBDD", "pants": "#4A3426", "garment": "apron", "height": 0.97},
		[_p(20, -7), _p(20, -2), _p(18, -5)]), _p(20, -6), -PI / 2.0)


func _lyra_spot() -> Vector3:
	if Game.has_flag("sanctum_open"):
		return _p(66, -10)
	if Quests.is_done("mq_awakening") or Quests.current_step_id("mq_awakening") not in ["", "s1"]:
		return _p(3, 3)
	return _p(-36, 42)


func _place_enemies() -> void:
	var spawns := [
		["bramble_wisp", 40, -6], ["bramble_wisp", 44, -11], ["bramble_wisp", 49, -4], ["bramble_wisp", 53, -12],
		["bramble_wisp", -60, 31], ["bramble_wisp", -65, 39], ["rootling_brute", -62, 34],
		["rootling_brute", 58, -32], ["rootling_brute", 62, -38], ["bramble_wisp", 68, -40],
		["bramble_wisp", -55, -45], ["bramble_wisp", -49, -52],
		["rootling_brute", 50, 40], ["bramble_wisp", 47, 36], ["bramble_wisp", 55, 44],
	]
	for s in spawns:
		_add(Enemy.create(s[0]), _p(s[1], s[2], 0.3))
	boss = BossWarden.create_boss(Vector3(L.ARENA.x, 10.3, L.ARENA.y + 2.0))
	_add(boss, Vector3(L.ARENA.x, 10.3, L.ARENA.y + 2.0), PI)


func _spawn_player() -> void:
	player = Player.new()
	player.name = "Player"
	var pos: Vector3
	if Game.pending_position != null:
		pos = Game.pending_position
		Game.pending_position = null
	else:
		pos = Game.respawn_point
	pos.y = max(pos.y, L.height(pos.x, pos.z) + 0.3)
	player.position = pos
	player.rotation.y = PI * 0.15
	add_child(player)


func _intro() -> void:
	await get_tree().create_timer(1.2).timeout
	Quests.start("mq_awakening")
	var ui := get_tree().get_first_node_in_group("dialogue_ui")
	if ui:
		ui.show_text("", "Birdsong. Damp moss. A pendant you don't remember, humming against your chest. Somewhere north, a light flickers on the ridge, and a voice is calling down the forest road.")


# ---------------------------------------------------------------- region logic
func _process(delta: float) -> void:
	if core:
		for i in 3:
			var r := core.get_node_or_null("Ring%d" % i) as Node3D
			if r:
				r.rotation.y += delta * (0.2 + i * 0.12) * (2.5 if Game.has_flag("act1_complete") else 1.0)
	_tick -= delta
	if _tick <= 0.0:
		_tick = 1.0
		_region_tick()
	_autosave -= delta
	if _autosave <= 0.0:
		_autosave = 300.0
		SaveManager.autosave()


func _region_tick() -> void:
	if player == null:
		return
	# boss trigger
	if is_instance_valid(boss) and not boss.active and Game.has_flag("sanctum_open") and not Game.has_flag("warden_defeated"):
		var d := Vector2(player.global_position.x - L.ARENA.x, player.global_position.z - L.ARENA.y).length()
		if d < 11.0:
			boss.awaken()
	# Lyra follows the story when the player isn't looking at her
	if is_instance_valid(lyra) and not lyra._talking:
		var want := _lyra_spot()
		if lyra.global_position.distance_to(want) > 3.0 and player.global_position.distance_to(lyra.global_position) > 25.0:
			lyra.global_position = want
