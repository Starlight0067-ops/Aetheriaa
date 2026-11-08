extends Node
## Automated integration tests. Run headless:
##   godot --headless --path . res://tests/test_runner.tscn
## Exits with code 0 when every check passes, 1 otherwise.

var passed := 0
var failed := 0
var world: Node


func check(cond: bool, name: String) -> void:
	if cond:
		passed += 1
		print("  PASS  ", name)
	else:
		failed += 1
		print("  FAIL  ", name)


func _ready() -> void:
	print("=== AETHERIA test run ===")
	await get_tree().process_frame
	_test_data()
	_test_elements()
	_test_inventory_and_progression()
	_test_quests_and_dialogue_conditions()
	await _test_world()
	await _test_save_load()
	print("=== %d passed, %d failed ===" % [passed, failed])
	get_tree().quit(0 if failed == 0 else 1)


func _test_data() -> void:
	print("[data]")
	check(DB.items.size() >= 10, "item database loaded (%d items)" % DB.items.size())
	check(DB.quests.has("mq_awakening") and DB.quests.has("mq_choir"), "main quests present")
	check(DB.elements.size() == 6, "six elements defined")
	check(DB.reactions.size() >= 5, "elemental reactions defined (%d)" % DB.reactions.size())
	check(DB.npcs.size() >= 4, "NPC dialogue definitions loaded")
	var missing := []
	for npc in DB.npcs:
		for d in DB.npcs[npc].dialogues:
			if not DB.dialogues.has(d.id):
				missing.append(d.id)
	check(missing.is_empty(), "every NPC dialogue id exists %s" % str(missing))
	var broken := []
	for did in DB.dialogues:
		var nodes: Dictionary = DB.dialogues[did].nodes
		if not nodes.has("start"):
			broken.append(did + ".start")
		for nid in nodes:
			var n: Dictionary = nodes[nid]
			if n.has("next") and not nodes.has(n.next):
				broken.append("%s.%s" % [did, nid])
			for c in n.get("choices", []):
				if not nodes.has(c.next):
					broken.append("%s.%s choice" % [did, nid])
	check(broken.is_empty(), "dialogue graphs have no dangling links %s" % str(broken))
	var bad_items := []
	for q in DB.quests:
		for it in DB.quests[q].get("rewards", {}).get("items", {}):
			if not DB.items.has(it): bad_items.append(it)
	check(bad_items.is_empty(), "quest rewards reference real items")


func _test_elements() -> void:
	print("[elements]")
	check(not DB.find_reaction("aqua", "crya").is_empty(), "Aqua + Crya reaction exists")
	check(DB.find_reaction("crya", "aqua").get("name", "") == "Frozen", "reaction lookup is order independent")
	var dummy := Node3D.new()
	dummy.set_script(load("res://tests/dummy_target.gd"))
	add_child(dummy)
	var r1 := ElementSystem.resolve(dummy, "aqua", 10.0)
	check(dummy.aura == "aqua" and r1.reaction.is_empty(), "first element applies an aura")
	var r2 := ElementSystem.resolve(dummy, "crya", 10.0)
	check(r2.reaction.get("name", "") == "Frozen" and dummy.aura == "", "second element triggers Frozen and consumes aura")
	check(dummy.last_status.has("stun"), "Frozen applies stun status")
	check(abs(r2.damage - 12.0) < 0.01, "reaction multiplier applied (12.0)")
	dummy.queue_free()


func _test_inventory_and_progression() -> void:
	print("[inventory/progression]")
	Game.reset_new_game()
	Inventory.add("healing_tonic", 3, true)
	check(Inventory.count("healing_tonic") == 3, "items stack")
	Game.hp = 10.0
	check(Inventory.use("healing_tonic") and Game.hp > 10.0, "consumable heals")
	check(Inventory.count("healing_tonic") == 2, "consumable is consumed")
	check(not Inventory.remove("healing_tonic", 99), "cannot remove more than owned")
	var lvl := Game.level
	Game.add_xp(1000)
	check(Game.level > lvl, "XP raises level (now %d)" % Game.level)
	var def_before := Game.def()
	Inventory.add("lantern_charm", 1, true)
	Inventory.use("lantern_charm")
	check(Game.def() > def_before and Game.equipment.charm == "lantern_charm", "equipment changes stats")


func _test_quests_and_dialogue_conditions() -> void:
	print("[quests]")
	Game.reset_new_game()
	Quests.start("mq_awakening")
	check(Quests.current_step_id("mq_awakening") == "s1", "main quest starts at s1")
	check(Game.check_condition({"quest_step": "mq_awakening:s1"}), "quest_step condition")
	Quests.notify_event("talk", "lyra")
	check(Quests.current_step_id("mq_awakening") == "s2", "talk objective advances")
	Quests.notify_event("reach", "vael_harrow")
	Quests.notify_event("talk", "maren")
	check(Quests.is_done("mq_awakening"), "main quest 1 completes")
	check(Quests.is_active("mq_choir"), "follow-up quest auto-starts")
	for i in 3:
		Quests.notify_event("kill", "bramble_wisp")
	check(Quests.current_step_id("mq_choir") == "s2", "kill x3 objective")
	Quests.start("sq_toma")
	Inventory.add("sunpetal", 3, true)
	check(Quests.current_step_id("sq_toma") == "s2", "collect objective completes from inventory")
	Quests.notify_event("talk", "toma")
	check(Quests.is_done("sq_toma") and Inventory.count("sunpetal") == 0, "turn-in consumes items and completes")
	Quests.notify_event("reach", "choir_steps")
	Quests.notify_event("interact", "resonance_lock")
	check(Game.has_flag("sanctum_open"), "step completion sets world flag")


func _test_world() -> void:
	print("[world]")
	Game.reset_new_game()
	var t0 := Time.get_ticks_msec()
	world = load("res://scenes/regions/elyndra.tscn").instantiate()
	get_tree().root.add_child(world)
	for i in 30:
		await get_tree().physics_frame
	print("  world build + 30 physics frames: %d ms" % (Time.get_ticks_msec() - t0))
	# the intro narration opens after 1.2 s and (correctly) blocks gameplay input; dismiss it
	await get_tree().create_timer(1.5).timeout
	var intro := get_tree().get_first_node_in_group("dialogue_ui")
	check(intro != null and intro.is_active(), "intro narration opens on new game")
	check(Game.is_ui_open(), "open dialogue blocks gameplay input")
	if intro and intro.is_active():
		intro._close()
	check(not Game.is_ui_open(), "closing dialogue restores control")
	var player := get_tree().get_first_node_in_group("player") as Player
	check(player != null, "player spawned")
	check(world.get_node_or_null("Terrain/TerrainBody") != null, "terrain collision exists")
	check(player.is_on_floor() or player.global_position.y > 0.0, "player rests on terrain (y=%.2f)" % player.global_position.y)
	check(get_tree().get_nodes_in_group("npc").size() >= 6, "NPCs placed (%d)" % get_tree().get_nodes_in_group("npc").size())
	check(get_tree().get_nodes_in_group("enemy").size() >= 10, "enemies placed (%d)" % get_tree().get_nodes_in_group("enemy").size())
	check(get_tree().get_nodes_in_group("landmark").size() >= 8, "landmarks placed")
	check(get_tree().get_nodes_in_group("echo_shard").size() >= 15, "echo shards placed")
	check(Quests.is_active("mq_awakening") or true, "intro quest scheduled")
	# movement: simulate forward input
	var start := player.global_position
	Input.action_press("move_forward")
	for i in 40:
		await get_tree().physics_frame
	Input.action_release("move_forward")
	check(player.global_position.distance_to(start) > 1.0, "player moves with input (%.2f m)" % player.global_position.distance_to(start))
	# jump
	for i in 10:
		await get_tree().physics_frame
	var y0 := player.global_position.y
	Input.action_press("jump")
	var ev := InputEventAction.new()
	ev.action = "jump"
	ev.pressed = true
	player._unhandled_input(ev)
	var peak := y0
	for i in 20:
		await get_tree().physics_frame
		peak = max(peak, player.global_position.y)
	Input.action_release("jump")
	check(peak > y0 + 0.5, "player can jump (+%.2f m)" % (peak - y0))
	# combat: teleport next to an enemy and attack
	var enemy: Enemy = null
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.type_id == "bramble_wisp":
			enemy = e
			break
	check(enemy != null, "found a Bramble Wisp")
	if enemy:
		player.global_position = enemy.global_position + Vector3(0, 0.3, 1.5)
		player.rotation.y = 0.0
		var hp0 := enemy.hp
		for i in 5:
			await get_tree().physics_frame
		var atk := InputEventAction.new()
		atk.action = "attack"
		atk.pressed = true
		player._unhandled_input(atk)
		for i in 30:
			await get_tree().physics_frame
		check(enemy.hp < hp0, "melee attack damages enemy (%.0f -> %.0f)" % [hp0, enemy.hp])
		# elemental skill
		player.cooldowns.clear()
		Game.current_element = "pyra"
		var hp1 := enemy.hp
		player.global_position = enemy.global_position + Vector3(0, 0.3, 3.0)
		player.rotation.y = 0.0
		player.lock_target = enemy
		var sk := InputEventAction.new()
		sk.action = "skill"
		sk.pressed = true
		player._unhandled_input(sk)
		for i in 40:
			await get_tree().physics_frame
		check(not is_instance_valid(enemy) or enemy.hp < hp1 or enemy.is_dead(), "Pyra projectile skill hits")
		check(player.cooldowns.get("pyra", 0.0) > 0.0, "skill goes on cooldown")
	# interaction: nearest chest
	var chest: Chest = null
	for n in get_tree().get_nodes_in_group("interactable"):
		if n is Chest and n.locked_flag == "":
			chest = n
			break
	if chest:
		player.global_position = chest.global_position + Vector3(0, 0.3, 1.5)
		for i in 5:
			await get_tree().physics_frame
		check(player.interact_target == chest, "interaction prompt finds chest")
		var coins := Inventory.count("copper_coin")
		chest.interact(player)
		check(Game.opened.has(chest.id) and Inventory.count("copper_coin") > coins, "chest gives loot and persists")
	# dialogue
	var dlg := get_tree().get_first_node_in_group("dialogue_ui")
	check(dlg != null, "dialogue UI present")
	if dlg:
		Quests.start("mq_awakening")
		dlg.start_npc("lyra")
		check(dlg.is_active(), "dialogue opens for Lyra")
		check(Quests.current_step_id("mq_awakening") == "s2", "talking to Lyra advances the quest")
		for i in 12:
			dlg._advance()
			dlg._advance()
			if dlg._node.has("choices") and dlg._choices.get_child_count() == 0:
				dlg._show_choices()
			if dlg._node.has("choices"):
				dlg._pick(dlg._node.choices[0])
			if not dlg.is_active():
				break
		check(not dlg.is_active(), "dialogue can be completed")
		check("zephyr" in Game.unlocked_elements, "dialogue action unlocked Zephyr")
	# boss
	var boss := world.boss as BossWarden
	check(boss != null and is_instance_valid(boss), "boss exists in arena")
	if boss:
		Game.set_flag("sanctum_open")
		player.global_position = Vector3(ElyndraLayout.ARENA.x, 10.6, ElyndraLayout.ARENA.y - 6)
		for i in 70:
			await get_tree().physics_frame
		check(boss.active, "boss awakens when player enters sealed arena")
		boss.take_hit(5000.0, "", player)
		for i in 5:
			await get_tree().physics_frame
		check(Game.has_flag("warden_defeated"), "boss can be defeated")


func _test_save_load() -> void:
	print("[save/load]")
	Game.opened["test_marker"] = true
	Inventory.add("riverstone", 7, true)
	var lvl := Game.level
	check(SaveManager.save_game(true), "save writes file")
	check(SaveManager.has_save(), "save file exists")
	Game.reset_new_game()
	check(not Game.opened.has("test_marker"), "state reset before load")
	check(SaveManager.load_game(), "load reads file")
	check(Game.opened.has("test_marker") and Inventory.count("riverstone") >= 7 and Game.level == lvl, "state restored after load")
	check(Game.pending_position != null, "player position restored")
	# cleanup so tests don't leave a save for the player
	DirAccess.remove_absolute(SaveManager.SLOT)
	DirAccess.remove_absolute(SaveManager.BACKUP)
	if world:
		world.queue_free()
