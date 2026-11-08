class_name ElementSystem
extends RefCounted
## Data-driven elemental resolution. Any attack can carry an element; the
## target keeps one "aura". A different element hitting an aura looks up a
## reaction in data/elements/elements.json. Nothing here is character-specific.

const AURA_DURATION := 7.0


## Returns {"damage": float, "reaction": Dictionary}.
## Target must expose: aura (String), aura_time (float), apply_status(Dictionary).
static func resolve(target: Node, element: String, base_damage: float) -> Dictionary:
	var result := {"damage": base_damage, "reaction": {}}
	if element == "" or not ("aura" in target):
		return result
	var current: String = target.aura
	if current != "" and current != element:
		var r := DB.find_reaction(current, element)
		if not r.is_empty():
			target.aura = ""
			target.aura_time = 0.0
			result.damage = base_damage * float(r.get("multiplier", 1.0))
			result.reaction = r
			target.apply_status(r)
			_reaction_side_effects(target, r, element, base_damage)
			return result
	target.aura = element
	target.aura_time = AURA_DURATION
	return result


static func _reaction_side_effects(target: Node3D, r: Dictionary, element: String, base: float) -> void:
	var color := Color(r.get("color", "#ffffff"))
	var world := target.get_parent()
	Effects.ring(world, target.global_position + Vector3(0, 0.3, 0), color, float(r.get("aoe_radius", 2.5)))
	Effects.damage_number(world, target.global_position + Vector3(0, 2.4, 0), 0, color, r.name.to_upper())
	Sfx.play("reaction")
	if r.has("aoe_radius"):
		var radius := float(r.aoe_radius)
		for e in target.get_tree().get_nodes_in_group("enemy"):
			if e == target or not is_instance_valid(e):
				continue
			if e.global_position.distance_to(target.global_position) <= radius:
				var spread := element if r.get("spread", false) else ""
				e.take_hit(base * float(r.get("aoe_damage", 0.5)), spread, null)


## Notify element receivers (braziers etc.) inside a radius.
static func touch_world(tree: SceneTree, pos: Vector3, radius: float, element: String) -> void:
	for n in tree.get_nodes_in_group("element_receiver"):
		if n.global_position.distance_to(pos) <= radius + 0.8:
			n.on_element(element)
