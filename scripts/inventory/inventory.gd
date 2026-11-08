extends Node
## Stackable inventory backed by the item database.

signal changed

var items: Dictionary = {}  # id -> count


func reset() -> void:
	items = {"travelers_blade": 1}
	changed.emit()


func add(id: String, amount: int = 1, silent: bool = false) -> void:
	if not DB.items.has(id):
		push_warning("Inventory: unknown item " + id)
		return
	var cap: int = int(DB.items[id].get("stack", 99))
	items[id] = min(cap, count(id) + amount)
	if not silent:
		Game.notify("+%d  %s" % [amount, DB.item_name(id)], "item")
	changed.emit()
	Quests.on_inventory_changed()


func remove(id: String, amount: int = 1) -> bool:
	if count(id) < amount:
		return false
	items[id] = count(id) - amount
	if items[id] <= 0:
		items.erase(id)
	changed.emit()
	return true


func count(id: String) -> int:
	return int(items.get(id, 0))


func use(id: String) -> bool:
	var def: Dictionary = DB.items.get(id, {})
	match def.get("category", ""):
		"consumable":
			if Game.hp >= Game.max_hp():
				Game.notify("Already at full health.")
				return false
			if remove(id):
				Game.heal(float(def.get("effect", {}).get("heal", 0)))
				Sfx.play("heal")
				Game.notify("Used " + def.name)
				return true
		"equipment":
			Game.equip(id)
			return true
	return false


func by_category(category: String) -> Array:
	var out: Array = []
	for id in items:
		if category == "all" or DB.items.get(id, {}).get("category", "") == category:
			out.append(id)
	out.sort()
	return out


func to_dict() -> Dictionary:
	return items.duplicate()


func from_dict(d: Dictionary) -> void:
	items = {}
	for k in d:
		items[k] = int(d[k])
	changed.emit()
