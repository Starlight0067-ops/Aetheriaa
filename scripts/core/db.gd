extends Node
## Central read-only game database. Loads every data-driven definition from /data.

var items: Dictionary = {}
var quests: Dictionary = {}
var elements: Dictionary = {}
var reactions: Array = []
var enemies: Dictionary = {}
var npcs: Dictionary = {}
var dialogues: Dictionary = {}
var signs: Dictionary = {}

const ELEMENT_ORDER := ["pyra", "aqua", "terra", "volt", "zephyr", "crya"]


func _ready() -> void:
	items = _load_json("res://data/items/items.json")
	quests = _load_json("res://data/quests/quests.json")
	enemies = _load_json("res://data/enemies/enemies.json")
	var e := _load_json("res://data/elements/elements.json")
	elements = e.get("elements", {})
	reactions = e.get("reactions", [])
	var d := _load_json("res://data/dialogue/elyndra_dialogue.json")
	npcs = d.get("npcs", {})
	dialogues = d.get("dialogues", {})
	signs = d.get("signs", {})


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("DB: missing data file " + path)
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("DB: invalid JSON in " + path)
		return {}
	return parsed


func item_name(id: String) -> String:
	return items.get(id, {}).get("name", id)


func element_color(id: String) -> Color:
	if not elements.has(id):
		return Color.WHITE
	return Color(elements[id].get("color", "#ffffff"))


func find_reaction(a: String, b: String) -> Dictionary:
	for r in reactions:
		if (r.a == a and r.b == b) or (r.a == b and r.b == a):
			return r
	return {}
