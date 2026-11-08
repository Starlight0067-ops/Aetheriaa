class_name GameMenu
extends CanvasLayer
## Pause menu with tabs: Inventory, Journal, Map, Character, Collection,
## Settings, plus Save / Main Menu / Quit. Opens on Esc, I, J, M, C.

var _root: Control
var _content: PanelContainer
var _tab := ""
var _open := false
var _selected_item := ""


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.theme = UITheme.get_theme()
	add_child(_root)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.03, 0.07, 0.72)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(shade)
	var hb := HBoxContainer.new()
	hb.set_anchors_preset(Control.PRESET_FULL_RECT)
	hb.offset_left = 40
	hb.offset_top = 40
	hb.offset_right = -40
	hb.offset_bottom = -40
	hb.add_theme_constant_override("separation", 20)
	_root.add_child(hb)
	var nav := VBoxContainer.new()
	nav.add_theme_constant_override("separation", 8)
	nav.custom_minimum_size = Vector2(230, 0)
	hb.add_child(nav)
	nav.add_child(UITheme.title("AETHERIA", 34, UITheme.AETHER))
	nav.add_child(UITheme.label("Elyndra · The Green Frontier", 14, UITheme.MUTED))
	for t in [["Resume", "resume"], ["Inventory", "inventory"], ["Journal", "journal"], ["Map", "map"],
			["Character", "character"], ["Collection", "collection"], ["Settings", "settings"]]:
		var id: String = t[1]
		nav.add_child(UITheme.button(t[0], func(): _on_nav(id), 220))
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	nav.add_child(spacer)
	nav.add_child(UITheme.button("Save Game", func(): SaveManager.save_game(), 220))
	nav.add_child(UITheme.button("Main Menu", _to_main_menu, 220))
	nav.add_child(UITheme.button("Quit Game", func():
		SaveManager.save_game(true)
		get_tree().quit(), 220))
	_content = PanelContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(_content)
	_root.visible = false


func _unhandled_input(event: InputEvent) -> void:
	var dlg := get_tree().get_first_node_in_group("dialogue_ui")
	if dlg and dlg.is_active():
		return
	for pair in [["pause", "inventory"], ["inventory", "inventory"], ["journal", "journal"], ["map", "map"], ["character", "character"]]:
		if event.is_action_pressed(pair[0]):
			get_viewport().set_input_as_handled()
			if _open and (pair[0] == "pause" or _tab == pair[1]):
				close()
			else:
				open(pair[1])
			return


func open(tab: String) -> void:
	_open = true
	_root.visible = true
	get_tree().paused = true
	Game.open_ui("menu")
	Sfx.play("ui_confirm")
	_show_tab(tab)


func close() -> void:
	_open = false
	_root.visible = false
	get_tree().paused = false
	Game.close_ui("menu")
	Sfx.play("ui_back")


func _on_nav(id: String) -> void:
	if id == "resume":
		close()
	else:
		_show_tab(id)


func _to_main_menu() -> void:
	SaveManager.save_game(true)
	get_tree().paused = false
	Game.clear_ui()
	SaveManager.in_game = false
	Sfx.stop_music()
	get_tree().change_scene_to_file("res://scenes/main/main_menu.tscn")


func _show_tab(tab: String) -> void:
	_tab = tab
	for c in _content.get_children():
		c.queue_free()
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	match tab:
		"inventory": _build_inventory(body)
		"journal": _build_journal(body)
		"character": _build_character(body)
		"collection": _build_collection(body)
		"settings":
			body.add_child(UITheme.title("Settings", 32))
			body.add_child(SettingsPanel.build())
		"map":
			body.add_child(UITheme.title("Map of Elyndra", 32))
			var m := MapView.new()
			m.custom_minimum_size = Vector2(620, 620)
			m.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			body.add_child(m)
			body.add_child(UITheme.label("◆ discovered places   ● Resonance Stones   ! quest objective", 14, UITheme.MUTED))
	if tab == "map":
		_content.add_child(body)
	else:
		scroll.add_child(body)
		_content.add_child(scroll)


func _build_inventory(body: VBoxContainer) -> void:
	body.add_child(UITheme.title("Inventory", 32))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 20)
	body.add_child(hb)
	var list := VBoxContainer.new()
	list.custom_minimum_size = Vector2(380, 0)
	hb.add_child(list)
	var detail := VBoxContainer.new()
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(detail)
	for cat in ["consumable", "equipment", "material", "quest", "collectible", "currency"]:
		var ids := Inventory.by_category(cat)
		if ids.is_empty():
			continue
		list.add_child(UITheme.label(cat.capitalize() + "s", 15, UITheme.BRASS))
		for id in ids:
			var b := UITheme.button("%s   ×%d" % [DB.item_name(id), Inventory.count(id)], func():
				_selected_item = id
				_show_tab("inventory"), 360)
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.add_theme_color_override("font_color", Color(DB.items[id].get("color", "#ffffff")).lerp(Color.WHITE, 0.4))
			list.add_child(b)
	if Inventory.items.is_empty():
		list.add_child(UITheme.label("Your pack is empty.", 16, UITheme.MUTED))
	if _selected_item != "" and Inventory.count(_selected_item) > 0:
		var d: Dictionary = DB.items[_selected_item]
		detail.add_child(UITheme.title(d.name, 26, Color(d.get("color", "#ffffff"))))
		detail.add_child(UITheme.label(d.category.capitalize(), 14, UITheme.MUTED))
		detail.add_child(UITheme.label(d.description, 17))
		if d.has("stats"):
			var parts: Array = []
			for k in d.stats:
				parts.append("%s +%s" % [k.to_upper().replace("_", " "), str(d.stats[k])])
			detail.add_child(UITheme.label(", ".join(parts), 16, UITheme.AETHER))
		match d.category:
			"consumable":
				detail.add_child(UITheme.button("Use", func():
					Inventory.use(_selected_item)
					_show_tab("inventory"), 160))
			"equipment":
				var equipped: bool = Game.equipment.get(d.get("slot", ""), "") == _selected_item
				var eb := UITheme.button("Equipped" if equipped else "Equip", func():
					Inventory.use(_selected_item)
					_show_tab("inventory"), 160)
				eb.disabled = equipped
				detail.add_child(eb)
	else:
		detail.add_child(UITheme.label("Select an item to see its details.", 16, UITheme.MUTED))


func _build_journal(body: VBoxContainer) -> void:
	body.add_child(UITheme.title("Journal", 32))
	if Quests.active.is_empty() and Quests.completed.is_empty():
		body.add_child(UITheme.label("No entries yet.", 16, UITheme.MUTED))
	for id in Quests.active:
		var q: Dictionary = DB.quests[id]
		var hb := HBoxContainer.new()
		hb.add_child(UITheme.title(q.title, 24, UITheme.BRASS if q.type == "main" else UITheme.AETHER))
		var track := UITheme.button("Tracked" if Quests.tracked_quest() == id else "Track", func():
			Quests.tracked = id
			_show_tab("journal"), 120)
		track.disabled = Quests.tracked_quest() == id
		hb.add_child(track)
		body.add_child(hb)
		body.add_child(UITheme.label(q.description, 16, UITheme.MUTED))
		var cur: int = Quests.active[id].step
		for i in q.steps.size():
			if i > cur:
				break
			var mark := "✓ " if i < cur else "◆ "
			body.add_child(UITheme.label(mark + q.steps[i].text, 16, UITheme.TEXT if i == cur else UITheme.MUTED))
		body.add_child(HSeparator.new())
	if not Quests.completed.is_empty():
		body.add_child(UITheme.title("Completed", 22, UITheme.MUTED))
		for id in Quests.completed:
			body.add_child(UITheme.label("✓ " + DB.quests[id].title, 16, UITheme.MUTED))


func _build_character(body: VBoxContainer) -> void:
	body.add_child(UITheme.title(Game.player_name, 32))
	body.add_child(UITheme.label("A wanderer who woke in the Whisperwood with no past, a cracked pendant, and the impossible gift of hearing more than one Resonance.", 16, UITheme.MUTED))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 40)
	body.add_child(grid)
	for row in [["Level", str(Game.level)], ["Experience", "%d / %d" % [Game.xp, Game.xp_to_next()]],
			["Health", "%d / %d" % [int(Game.hp), int(Game.max_hp())]], ["Attack", str(int(Game.atk()))],
			["Defense", str(int(Game.def()))], ["Weapon", DB.item_name(Game.equipment.weapon) if Game.equipment.weapon != "" else "None"],
			["Charm", DB.item_name(Game.equipment.charm) if Game.equipment.charm != "" else "None"],
			["Time played", "%d min" % int(Game.play_time / 60.0)]]:
		grid.add_child(UITheme.label(row[0], 17, UITheme.MUTED))
		grid.add_child(UITheme.label(row[1], 17))
	body.add_child(UITheme.title("Resonances", 24))
	for el in DB.ELEMENT_ORDER:
		var e: Dictionary = DB.elements[el]
		var unlocked: bool = el in Game.unlocked_elements
		var text := "%s (%s): %s" % [e.name, e.domain, e.skill.name if unlocked else "Unheard"]
		var l := UITheme.label(text, 17, DB.element_color(el) if unlocked else Color(0.5, 0.5, 0.55))
		body.add_child(l)
		if unlocked:
			var b := UITheme.button("Attuned" if Game.current_element == el else "Attune", func():
				Game.set_element(el)
				_show_tab("character"), 140)
			b.disabled = Game.current_element == el
			body.add_child(b)


func _build_collection(body: VBoxContainer) -> void:
	body.add_child(UITheme.title("Collection", 32))
	var total_shards := get_tree().get_nodes_in_group("echo_shard").size() + Inventory.count("echo_shard")
	body.add_child(UITheme.label("Echo Shards: %d / %d" % [Inventory.count("echo_shard"), total_shards], 20, Color("#BDF7FF")))
	body.add_child(UITheme.label("Each shard hums one note of the Seventh Verse.", 15, UITheme.MUTED))
	var opened := 0
	var chests := 0
	for c in get_tree().get_nodes_in_group("interactable"):
		if c is Chest:
			chests += 1
			if Game.opened.has(c.id):
				opened += 1
	body.add_child(UITheme.label("Chests opened: %d / %d" % [opened, chests], 20, Color("#FFD98A")))
	body.add_child(UITheme.title("Places discovered", 22))
	for lm in get_tree().get_nodes_in_group("landmark"):
		var found: bool = Game.discovered.has(lm.id)
		body.add_child(UITheme.label(("◆ " + lm.display_name) if found else "◇ ???", 17, UITheme.TEXT if found else UITheme.MUTED))
