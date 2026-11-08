class_name PuzzleObjects
extends RefCounted
## Factory for the ancient Choir devices: Resonance Lock, braziers, flag gates.


static func resonance_lock() -> ResonanceLock:
	return ResonanceLock.new()


static func brazier(b_id: String, group: String) -> Brazier:
	var b := Brazier.new()
	b.id = b_id
	b.puzzle_group = group
	return b


static func gate(flag: String, size: Vector3) -> FlagGate:
	var g := FlagGate.new()
	g.flag = flag
	g.size = size
	return g
