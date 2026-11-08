extends Node
## Data-driven quest state machine. Objectives advance through notify_event().

signal quest_started(id: String)
signal quest_updated(id: String)
signal quest_completed(id: String)

var active: Dictionary = {}     # id -> {"step": int, "progress": int}
var completed: Array = []
var tracked := ""


func reset() -> void:
	active = {}
	completed = []
	tracked = ""


func is_active(id: String) -> bool: return active.has(id)
func is_done(id: String) -> bool: return id in completed


func current_step(id: String) -> Dictionary:
	if not active.has(id):
		return {}
	var steps: Array = DB.quests[id].steps
	var i: int = active[id].step
	return steps[i] if i < steps.size() else {}


func current_step_id(id: String) -> String:
	return current_step(id).get("id", "")


func start(id: String) -> void:
	if not DB.quests.has(id) or is_active(id) or is_done(id):
		return
	active[id] = {"step": 0, "progress": 0}
	if tracked == "" or DB.quests[id].type == "main":
		tracked = id
	Game.banner.emit(DB.quests[id].title.to_upper(), "New %s quest" % ("main" if DB.quests[id].type == "main" else "side"))
	Sfx.play("quest")
	quest_started.emit(id)
	_check_passive(id)


## Generic objective hook: kind = talk/reach/kill/interact, target = id.
func notify_event(kind: String, target: String, amount: int = 1) -> void:
	for id in active.keys():
		var step := current_step(id)
		if step.get("type", "") == kind and step.get("target", "") == target:
			active[id].progress += amount
			if active[id].progress >= int(step.get("count", 1)):
				advance(id)
			else:
				Game.notify("%s (%d/%d)" % [step.text, active[id].progress, int(step.count)], "quest")
				quest_updated.emit(id)


func on_inventory_changed() -> void:
	for id in active.keys():
		_check_passive(id)


## Steps that may already be satisfied when they become current.
func _check_passive(id: String) -> void:
	if not active.has(id):
		return
	var step := current_step(id)
	match step.get("type", ""):
		"collect":
			if Inventory.count(step.target) >= int(step.get("count", 1)):
				advance(id)
		"reach":
			if Game.discovered.has(step.target) and _player_near(step.target):
				advance(id)


func _player_near(target: String) -> bool:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null or not Game.world_positions.has(target):
		return false
	return player.global_position.distance_to(Game.world_positions[target]) < 30.0


func advance(id: String) -> void:
	var step := current_step(id)
	if step.has("on_complete_flag"):
		Game.set_flag(step.on_complete_flag)
	active[id].step += 1
	active[id].progress = 0
	if active[id].step >= DB.quests[id].steps.size():
		_complete(id)
	else:
		Game.notify("Objective: " + current_step(id).text, "quest")
		Sfx.play("ui_confirm")
		quest_updated.emit(id)
		_check_passive(id)


func _complete(id: String) -> void:
	var q: Dictionary = DB.quests[id]
	active.erase(id)
	completed.append(id)
	Game.banner.emit("QUEST COMPLETE", q.title)
	Sfx.play("quest")
	var r: Dictionary = q.get("rewards", {})
	var take: Dictionary = r.get("take_items", {})
	for item in take:
		Inventory.remove(item, int(take[item]))
	var give: Dictionary = r.get("items", {})
	for item in give:
		Inventory.add(item, int(give[item]))
	if r.has("xp"):
		Game.add_xp(int(r.xp))
		Game.notify("+%d XP" % int(r.xp), "xp")
	if r.has("unlock_element"):
		Game.unlock_element(r.unlock_element)
	if r.has("flag"):
		Game.set_flag(r.flag)
	if tracked == id:
		tracked = active.keys()[0] if not active.is_empty() else ""
	quest_completed.emit(id)
	if q.has("next"):
		start(q.next)
	SaveManager.autosave()


func tracked_quest() -> String:
	if tracked != "" and active.has(tracked):
		return tracked
	return active.keys()[0] if not active.is_empty() else ""


func to_dict() -> Dictionary:
	return {"active": active, "completed": completed, "tracked": tracked}


func from_dict(d: Dictionary) -> void:
	active = {}
	var a: Dictionary = d.get("active", {})
	for k in a:
		if DB.quests.has(k):
			active[k] = {"step": int(a[k].step), "progress": int(a[k].progress)}
	completed = d.get("completed", [])
	tracked = d.get("tracked", "")
