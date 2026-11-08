extends Node
## Versioned JSON save system with a rolling backup.

const DIR := "user://saves"
const SLOT := "user://saves/slot_1.json"
const BACKUP := "user://saves/slot_1.bak"
const WORLD_SCENE := "res://scenes/regions/elyndra.tscn"

var in_game := false


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(DIR)


func has_save() -> bool:
	return FileAccess.file_exists(SLOT)


func save_game(silent: bool = false) -> bool:
	if not in_game:
		return false
	var player := get_tree().get_first_node_in_group("player") as Node3D
	var pos: Vector3 = player.global_position if player else Game.respawn_point
	var data := {
		"version": Game.SAVE_VERSION,
		"timestamp": Time.get_datetime_string_from_system(),
		"game": Game.to_dict(),
		"inventory": Inventory.to_dict(),
		"quests": Quests.to_dict(),
		"player_position": [pos.x, pos.y, pos.z],
	}
	if FileAccess.file_exists(SLOT):
		DirAccess.copy_absolute(SLOT, BACKUP)
	var f := FileAccess.open(SLOT, FileAccess.WRITE)
	if f == null:
		push_error("Save failed: %s" % error_string(FileAccess.get_open_error()))
		Game.notify("Save failed!", "error")
		return false
	f.store_string(JSON.stringify(data, "\t"))
	f.close()
	if not silent:
		Game.notify("Game saved", "save")
	return true


func autosave() -> void:
	if in_game:
		save_game(true)
		Game.notify("Autosaved", "save")


func read_save() -> Dictionary:
	for path in [SLOT, BACKUP]:
		if not FileAccess.file_exists(path):
			continue
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if typeof(parsed) == TYPE_DICTIONARY and parsed.has("game"):
			return _migrate(parsed)
		push_warning("Save file corrupt, trying backup: " + path)
	return {}


func _migrate(d: Dictionary) -> Dictionary:
	# Future versions add migration steps here keyed on d.version.
	if int(d.get("version", 0)) > Game.SAVE_VERSION:
		push_warning("Save is from a newer game version; loading best-effort.")
	return d


func load_game() -> bool:
	var d := read_save()
	if d.is_empty():
		return false
	Game.reset_new_game()
	Game.from_dict(d.game)
	Inventory.from_dict(d.get("inventory", {}))
	Quests.from_dict(d.get("quests", {}))
	var p: Array = d.get("player_position", [])
	if p.size() == 3:
		Game.pending_position = Vector3(p[0], p[1], p[2])
	return true


func new_game() -> void:
	Game.reset_new_game()


func save_info() -> String:
	var d := read_save()
	if d.is_empty():
		return ""
	var g: Dictionary = d.game
	var mins := int(float(g.get("play_time", 0)) / 60.0)
	return "Lv %d  ·  %d min played  ·  %s" % [int(g.get("level", 1)), mins, d.get("timestamp", "")]
