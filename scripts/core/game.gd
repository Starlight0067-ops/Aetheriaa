extends Node
## Global game state: player stats, world flags, discoveries and UI focus.

signal notified(text: String, kind: String)
signal banner(title: String, subtitle: String)
signal stats_changed
signal element_changed(id: String)
signal elements_unlocked_changed
signal leveled_up(level: int)
signal ui_focus_changed(open: bool)
signal boss_bar(name: String, ratio: float, visible: bool)

const SAVE_VERSION := 1
const START_POSITION := Vector3(-56, 0, 80)

var player_name := "Kael"
var level := 1
var xp := 0
var base_max_hp := 100.0
var base_atk := 12.0
var base_def := 4.0
var hp := 100.0
var stamina := 100.0
var max_stamina := 100.0
var flags: Dictionary = {}
var discovered: Dictionary = {}
var opened: Dictionary = {}          # chests, pickups, gathered nodes
var unlocked_elements: Array = ["pyra"]
var current_element := "pyra"
var equipment: Dictionary = {"weapon": "travelers_blade", "charm": ""}
var play_time := 0.0
var respawn_point: Vector3 = START_POSITION
var pending_position: Variant = null  # Vector3 restored from a save
var world_positions: Dictionary = {}  # runtime registry id -> Vector3 (quest markers, map)

var _ui_open: Array = []


func _process(delta: float) -> void:
	play_time += delta


# ---------- derived stats ----------
func _equip_stat(stat: String) -> float:
	var total := 0.0
	for slot in equipment:
		var id: String = equipment[slot]
		if id != "" and DB.items.has(id):
			total += float(DB.items[id].get("stats", {}).get(stat, 0))
	return total

func max_hp() -> float: return base_max_hp + _equip_stat("max_hp")
func atk() -> float: return base_atk + _equip_stat("atk")
func def() -> float: return base_def + _equip_stat("def")

func xp_to_next() -> int:
	return int(50.0 * pow(float(level), 1.5))


func add_xp(amount: int) -> void:
	xp += amount
	while xp >= xp_to_next():
		xp -= xp_to_next()
		level += 1
		base_max_hp += 12.0
		base_atk += 3.0
		base_def += 1.0
		hp = max_hp()
		leveled_up.emit(level)
		banner.emit("LEVEL %d" % level, "Your resonance deepens.")
		Sfx.play("levelup")
	stats_changed.emit()


func heal(amount: float) -> void:
	hp = min(max_hp(), hp + amount)
	stats_changed.emit()


func damage(amount: float) -> void:
	hp = max(0.0, hp - amount)
	stats_changed.emit()


func equip(item_id: String) -> void:
	var slot: String = DB.items.get(item_id, {}).get("slot", "")
	if slot == "":
		return
	equipment[slot] = item_id
	hp = min(hp, max_hp())
	notify("Equipped " + DB.item_name(item_id), "item")
	stats_changed.emit()


# ---------- elements ----------
func unlock_element(id: String) -> void:
	if id in unlocked_elements or not DB.elements.has(id):
		return
	unlocked_elements.append(id)
	banner.emit("RESONANCE AWAKENED", "You can now hear %s, the %s tone. Press %d to attune." % [
		DB.elements[id].name, DB.elements[id].domain, DB.ELEMENT_ORDER.find(id) + 1])
	Sfx.play("discover")
	elements_unlocked_changed.emit()


func set_element(id: String) -> void:
	if id in unlocked_elements and id != current_element:
		current_element = id
		element_changed.emit(id)


# ---------- flags & discovery ----------
func set_flag(flag: String, value: bool = true) -> void:
	flags[flag] = value

func has_flag(flag: String) -> bool:
	return flags.get(flag, false)


func discover(id: String, display_name: String) -> void:
	if discovered.has(id):
		return
	discovered[id] = true
	banner.emit(display_name.to_upper(), "Location discovered")
	Sfx.play("discover")
	add_xp(20)


func notify(text: String, kind: String = "info") -> void:
	notified.emit(text, kind)


# ---------- generic condition evaluation (dialogue, interactables) ----------
func check_condition(cond: Dictionary) -> bool:
	for key in cond:
		var v = cond[key]
		match key:
			"flag":
				if not has_flag(v): return false
			"not_flag":
				if has_flag(v): return false
			"quest_active":
				if not Quests.is_active(v): return false
			"quest_done":
				if not Quests.is_done(v): return false
			"quest_not_started":
				if Quests.is_active(v) or Quests.is_done(v): return false
			"quest_step":
				var parts: PackedStringArray = String(v).split(":")
				if Quests.current_step_id(parts[0]) != parts[1]: return false
			"has_item":
				var p: PackedStringArray = String(v).split(":")
				if Inventory.count(p[0]) < int(p[1]): return false
	return true


# ---------- UI focus (pauses player input, frees mouse) ----------
func open_ui(id: String) -> void:
	if id not in _ui_open:
		_ui_open.append(id)
	_update_mouse()

func close_ui(id: String) -> void:
	_ui_open.erase(id)
	_update_mouse()

func is_ui_open() -> bool:
	return not _ui_open.is_empty()

func clear_ui() -> void:
	_ui_open.clear()

func _update_mouse() -> void:
	var open := is_ui_open()
	if TouchControls.is_wanted():
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		ui_focus_changed.emit(open)
		return
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if open else Input.MOUSE_MODE_CAPTURED
	ui_focus_changed.emit(open)


# ---------- lifecycle ----------
func reset_new_game() -> void:
	level = 1
	xp = 0
	base_max_hp = 100.0
	base_atk = 12.0
	base_def = 4.0
	hp = max_hp()
	stamina = max_stamina
	flags = {}
	discovered = {}
	opened = {}
	unlocked_elements = ["pyra"]
	current_element = "pyra"
	equipment = {"weapon": "travelers_blade", "charm": ""}
	play_time = 0.0
	respawn_point = START_POSITION
	pending_position = null
	_ui_open.clear()
	Inventory.reset()
	Quests.reset()


func to_dict() -> Dictionary:
	return {
		"player_name": player_name, "level": level, "xp": xp,
		"base_max_hp": base_max_hp, "base_atk": base_atk, "base_def": base_def, "hp": hp,
		"flags": flags, "discovered": discovered, "opened": opened,
		"unlocked_elements": unlocked_elements, "current_element": current_element,
		"equipment": equipment, "play_time": play_time,
		"respawn_point": [respawn_point.x, respawn_point.y, respawn_point.z],
	}


func from_dict(d: Dictionary) -> void:
	player_name = d.get("player_name", "Kael")
	level = int(d.get("level", 1))
	xp = int(d.get("xp", 0))
	base_max_hp = float(d.get("base_max_hp", 100))
	base_atk = float(d.get("base_atk", 12))
	base_def = float(d.get("base_def", 4))
	flags = d.get("flags", {})
	discovered = d.get("discovered", {})
	opened = d.get("opened", {})
	unlocked_elements = d.get("unlocked_elements", ["pyra"])
	current_element = d.get("current_element", "pyra")
	equipment = d.get("equipment", {"weapon": "travelers_blade", "charm": ""})
	play_time = float(d.get("play_time", 0))
	var rp: Array = d.get("respawn_point", [START_POSITION.x, START_POSITION.y, START_POSITION.z])
	respawn_point = Vector3(rp[0], rp[1], rp[2])
	hp = clamp(float(d.get("hp", max_hp())), 1.0, max_hp())
