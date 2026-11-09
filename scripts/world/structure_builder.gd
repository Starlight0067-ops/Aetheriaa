class_name StructureBuilder
extends RefCounted
## Authored architecture for Vael Harrow, the Choir ruins and the Elyndra Core.
## Each building is one merged mesh plus simple box collision.

const L = preload("res://scripts/world/elyndra_layout.gd")

const WALLS := ["#EFE3C8", "#E8D5B0", "#F2EBDD", "#D9C7A8", "#E6D2C2", "#CFD8C8"]
const ROOFS := ["#C2603F", "#4E5D78", "#A44E3A", "#5E7A5A", "#B87A3E", "#6A4E78"]
const TIMBER := Color("#6B4630")
const STONE := Color("#C9BFA8")
const CHOIR := Color("#9AA7B5")
const CHOIR_DARK := Color("#76839A")


static func _ground(x: float, z: float) -> float:
	return L.height(x, z)


static func _collider(parent: Node3D, pos: Vector3, size: Vector3, rot_y: float = 0.0) -> void:
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	body.position = pos
	body.rotation.y = rot_y
	body.add_child(cs)
	parent.add_child(body)


static func _collider_x(parent: Node3D, pos: Vector3, size: Vector3, rot_x: float) -> void:
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	cs.position = pos
	cs.rotation.x = rot_x
	body.add_child(cs)
	parent.add_child(body)


## Generic house. opts: w, d, floors, roof ("gable","hip","flat_tower"), wall, roof_col,
## chimney, awning (color), timber, balcony, sign (color)
static func building(parent: Node3D, name: String, pos2: Vector2, rot_y: float, o: Dictionary) -> Node3D:
	var root := Node3D.new()
	root.name = name
	var base_y := _ground(pos2.x, pos2.y) - 0.3
	root.position = Vector3(pos2.x, base_y, pos2.y)
	root.rotation.y = rot_y
	parent.add_child(root)
	var w: float = o.get("w", 6.0)
	var d: float = o.get("d", 5.0)
	var floors: int = o.get("floors", 1)
	var fh := 3.0
	var wall := Color(o.get("wall", WALLS[0]))
	var roof := Color(o.get("roof_col", ROOFS[0]))
	var k := MeshKit.new()
	var body_h := floors * fh + 0.4
	k.alpha = 0.4
	k.box(Vector3(0, 0.35, 0), Vector3(w + 0.4, 0.7, d + 0.4), STONE.darkened(0.1))   # plinth
	k.alpha = 0.6
	k.box(Vector3(0, body_h * 0.5 + 0.3, 0), Vector3(w, body_h, d), wall)
	if floors > 1:   # jettied upper floor
		k.box(Vector3(0, fh + 0.5 + (body_h - fh) * 0.5, 0), Vector3(w + 0.5, body_h - fh, d + 0.5), wall)
		k.box(Vector3(0, fh + 0.45, 0), Vector3(w + 0.7, 0.2, d + 0.7), TIMBER)
	k.alpha = 0.2
	if o.get("timber", true):
		for sx in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				k.box(Vector3(sx * w * 0.5, body_h * 0.5 + 0.3, sz * d * 0.5), Vector3(0.25, body_h, 0.25), TIMBER)
		k.box(Vector3(0, body_h + 0.2, d * 0.5), Vector3(w + 0.2, 0.22, 0.22), TIMBER)
		k.box(Vector3(0, body_h + 0.2, -d * 0.5), Vector3(w + 0.2, 0.22, 0.22), TIMBER)
	# door (front = +Z)
	k.box(Vector3(0, 1.4, d * 0.5 + 0.06), Vector3(1.3, 2.2, 0.12), Color("#5A3A26"))
	k.box(Vector3(0, 2.6, d * 0.5 + 0.1), Vector3(1.6, 0.2, 0.2), TIMBER)
	k.alpha = 1.0
	# windows
	var win := Color("#2E4A6A")
	var frame := Color("#F4EEDC")
	for f in floors:
		var wy := 1.8 + f * fh
		var count := int(w / 2.6)
		for i in count:
			var wx := -w * 0.5 + (i + 0.5) * (w / count)
			if f == 0 and abs(wx) < 1.2: continue
			k.box(Vector3(wx, wy, d * 0.5 + 0.05), Vector3(0.9, 1.1, 0.1), win)
			k.box(Vector3(wx, wy - 0.62, d * 0.5 + 0.12), Vector3(1.1, 0.14, 0.2), frame)
			k.box(Vector3(wx, wy, -d * 0.5 - 0.05), Vector3(0.9, 1.1, 0.1), win)
		for i in int(d / 3.0):
			var wz := -d * 0.5 + (i + 0.5) * (d / int(d / 3.0))
			k.box(Vector3(w * 0.5 + 0.05, wy, wz), Vector3(0.1, 1.1, 0.9), win)
			k.box(Vector3(-w * 0.5 - 0.05, wy, wz), Vector3(0.1, 1.1, 0.9), win)
	# roof
	k.alpha = 0.8
	var top := body_h + 0.3
	match o.get("roof", "gable"):
		"gable", "steep":
			var rh := 2.8 if o.get("roof", "gable") == "gable" else 4.4
			if d >= w:
				k.prism(Vector3(0, top + rh * 0.5, 0), Vector3(w + 1.2, rh, d + 1.0), roof)
			else:
				k.prism(Vector3(0, top + rh * 0.5, 0), Vector3(d + 1.2, rh, w + 1.0), roof, PI / 2.0)
		"hip":
			k.cyl(Vector3(0, top + 1.3, 0), 0.3, max(w, d) * 0.78, 2.6, roof, 4, Basis(Vector3.UP, PI / 4.0))
	k.alpha = 0.4
	if o.get("chimney", false):
		k.box(Vector3(w * 0.3, top + 2.2, -d * 0.2), Vector3(0.8, 2.6, 0.8), STONE.darkened(0.2))
	k.alpha = 1.0
	if o.has("awning"):
		var ac := Color(o.awning)
		k.box(Vector3(0, 2.9, d * 0.5 + 0.9), Vector3(w * 0.8, 0.12, 1.8), ac, 0.0)
		for sx in [-1.0, 1.0]:
			k.box(Vector3(sx * w * 0.38, 1.45, d * 0.5 + 1.7), Vector3(0.12, 2.9, 0.12), TIMBER)
	if o.has("sign"):
		k.box(Vector3(w * 0.5 + 0.6, 3.0, d * 0.5 - 0.3), Vector3(1.0, 0.08, 0.08), TIMBER)
		k.box(Vector3(w * 0.5 + 0.9, 2.55, d * 0.5 - 0.3), Vector3(0.9, 0.7, 0.08), Color(o.sign))
	k.alpha = 0.2
	if o.get("balcony", false) and floors > 1:
		k.box(Vector3(0, fh + 0.6, d * 0.5 + 0.9), Vector3(w * 0.6, 0.15, 1.4), TIMBER)
		k.box(Vector3(0, fh + 1.1, d * 0.5 + 1.55), Vector3(w * 0.6, 0.8, 0.08), TIMBER)
	k.instance(root, "BuildingMesh")
	_collider(root, Vector3(0, body_h * 0.5 + 0.3, 0), Vector3(w + 0.4, body_h + 0.6, d + 0.4))
	return root


static func build_town(parent: Node3D) -> void:
	var town := Node3D.new()
	town.name = "VaelHarrow"
	parent.add_child(town)
	# Town hall with clock tower, north side of plaza, facing south (+Z)
	var hall := building(town, "TownHall", Vector2(10, -17), 0.0, {"w": 12.0, "d": 8.0, "floors": 2, "roof": "gable", "wall": "#F2EBDD", "roof_col": "#4E5D78", "balcony": true})
	var tk := MeshKit.new()
	tk.alpha = 0.6
	tk.box(Vector3(0, 9.0, -1.0), Vector3(3.2, 6.0, 3.2), Color("#E8D5B0"))
	tk.alpha = 0.8
	tk.cyl(Vector3(0, 13.6, -1.0), 0.0, 2.6, 3.4, Color("#3F4D66"), 4, Basis(Vector3.UP, PI / 4.0))
	tk.alpha = 1.0
	tk.cyl(Vector3(0, 10.0, 0.62), 0.9, 0.9, 0.1, Color("#F7F1DE"), 16, Basis(Vector3.RIGHT, PI / 2.0))
	tk.box(Vector3(0, 10.2, 0.7), Vector3(0.08, 0.7, 0.05), Color("#333333"))
	tk.box(Vector3(0.25, 10.0, 0.7), Vector3(0.5, 0.08, 0.05), Color("#333333"))
	tk.instance(hall, "ClockTower")

	building(town, "Tavern_GildedKettle", Vector2(25, -6), -PI / 2.0, {"w": 10.0, "d": 7.0, "floors": 2, "wall": "#E8D5B0", "roof_col": "#A44E3A", "chimney": true, "sign": "#E2B95B"})
	building(town, "GeneralStore", Vector2(25, 8), -PI / 2.0, {"w": 7.0, "d": 6.0, "floors": 1, "wall": "#CFD8C8", "roof_col": "#5E7A5A", "awning": "#D9534F", "sign": "#5FA8D3"})
	var smith := building(town, "Smithy", Vector2(0, 15), PI, {"w": 7.0, "d": 6.0, "floors": 1, "wall": "#D9C7A8", "roof_col": "#6A4E78", "chimney": true, "roof": "hip"})
	var fk := MeshKit.new()   # open forge + anvil in front
	fk.box(Vector3(0, 0.6, 5.0), Vector3(2.0, 1.2, 1.4), STONE.darkened(0.3))
	fk.box(Vector3(0, 1.25, 5.0), Vector3(1.4, 0.1, 0.9), Color("#FF7A3D"), 0.0, true)
	fk.box(Vector3(2.4, 0.5, 4.6), Vector3(0.6, 1.0, 0.4), Color("#4A4A55"))
	fk.box(Vector3(2.4, 1.05, 4.6), Vector3(1.0, 0.2, 0.45), Color("#5A5A66"))
	fk.glow_color = Color("#FF8A4D")
	fk.instance(smith, "Forge")

	# Chapel of the Quiet Bell (west bank, north)
	var chapel := building(town, "Chapel", Vector2(-27, -20), PI / 2.0, {"w": 6.0, "d": 10.0, "floors": 1, "roof": "steep", "wall": "#F2EBDD", "roof_col": "#4E5D78", "timber": false})
	var ck := MeshKit.new()
	ck.alpha = 0.6
	ck.box(Vector3(0, 6.0, -6.0), Vector3(2.4, 8.0, 2.4), Color("#F2EBDD"))
	ck.alpha = 0.8
	ck.cyl(Vector3(0, 11.5, -6.0), 0.0, 1.9, 3.0, Color("#4E5D78"), 4, Basis(Vector3.UP, PI / 4.0))
	ck.cyl(Vector3(0, 8.6, -6.0), 0.35, 0.6, 0.9, Color("#C9A15B"), 8)
	ck.instance(chapel, "BellTower")

	# Houses: varied size, roof, colors & orientation
	var houses := [
		[Vector2(-3, -13), PI * 0.5, 5.5, 5.0, 2, "gable", 0, 0, true],
		[Vector2(31, -19), -PI * 0.25, 6.0, 5.0, 1, "hip", 1, 1, false],
		[Vector2(36, 5), -PI * 0.5, 5.0, 6.0, 2, "steep", 2, 2, true],
		[Vector2(16, 19), PI, 6.5, 5.0, 1, "gable", 3, 3, false],
		[Vector2(29, 21), PI * 0.8, 5.0, 5.0, 2, "hip", 4, 4, true],
		[Vector2(-26, -5), PI * 0.5, 6.0, 5.0, 1, "gable", 5, 5, false],
		[Vector2(-24, 9), PI * 0.5, 5.0, 5.5, 2, "steep", 1, 0, true],
		[Vector2(-22, 21), PI * 0.6, 7.0, 5.0, 1, "hip", 2, 2, false],
		[Vector2(-34, 2), PI * 0.5, 4.5, 4.5, 1, "gable", 3, 1, true],
		[Vector2(40, -10), -PI * 0.5, 5.0, 4.5, 1, "gable", 0, 4, false],
		[Vector2(4, 24), PI, 5.0, 4.5, 1, "steep", 4, 5, true],
	]
	var i := 0
	for h in houses:
		building(town, "House_%02d" % i, h[0], h[1], {"w": h[2], "d": h[3], "floors": h[4], "roof": h[5],
			"wall": WALLS[h[6]], "roof_col": ROOFS[h[7]], "chimney": h[8], "balcony": h[4] > 1})
		i += 1

	_plaza(town)
	_bridge(town)
	_street_props(town)


static func _plaza(parent: Node3D) -> void:
	var y := _ground(L.PLAZA.x, L.PLAZA.y)
	var k := MeshKit.new()
	k.alpha = 0.4
	# dry Choir fountain
	k.cyl(Vector3(0, 0.35, 0), 3.2, 3.4, 0.7, STONE, 12)
	k.cyl(Vector3(0, 0.72, 0), 2.7, 2.7, 0.1, Color("#9E9480"), 12)
	k.cyl(Vector3(0, 1.8, 0), 0.35, 0.5, 2.4, CHOIR, 6)
	k.cyl(Vector3(0, 3.3, 0), 0.0, 0.45, 0.9, CHOIR, 6)
	k.sphere(Vector3(0, 3.0, 0), Vector3(0.5, 0.5, 0.5), Color("#5FE3E0"), 6, true)
	k.alpha = 0.2
	# benches & planters
	for a in [0.4, 1.9, 3.5, 5.0]:
		var p := Vector3(cos(a) * 7.0, 0, sin(a) * 7.0)
		k.box(p + Vector3(0, 0.45, 0), Vector3(1.8, 0.12, 0.5), TIMBER, -a)
		k.box(p + Vector3(0, 0.22, 0), Vector3(1.6, 0.44, 0.3), TIMBER.darkened(0.2), -a)
	for a in [1.15, 2.7, 4.25, 5.8]:
		var p := Vector3(cos(a) * 8.0, 0, sin(a) * 8.0)
		k.cyl(p + Vector3(0, 0.4, 0), 0.7, 0.6, 0.8, STONE.darkened(0.1), 8)
		k.sphere(p + Vector3(0, 1.0, 0), Vector3(1.2, 0.8, 1.2), Color("#5DAE4E"), 7)
		k.sphere(p + Vector3(0.2, 1.3, 0.1), Vector3(0.3, 0.3, 0.3), Color("#FF8FB1"), 5)
	k.alpha = 0.2
	# market stalls
	for s in [[Vector3(-5, 0, 6.5), "#D9534F"], [Vector3(4, 0, 7.5), "#5FA8D3"], [Vector3(-6, 0, -6), "#E2B95B"]]:
		var sp: Vector3 = s[0]
		k.box(sp + Vector3(0, 0.5, 0), Vector3(2.4, 1.0, 1.2), TIMBER)
		k.box(sp + Vector3(0, 2.3, 0), Vector3(2.8, 0.1, 1.8), Color(s[1]))
		for dx in [-1.2, 1.2]:
			k.box(sp + Vector3(dx, 1.2, 0.7), Vector3(0.1, 2.3, 0.1), TIMBER)
		k.sphere(sp + Vector3(-0.5, 1.15, 0), Vector3(0.4, 0.3, 0.4), Color("#FFB36B"), 5)
		k.sphere(sp + Vector3(0.4, 1.15, 0.1), Vector3(0.4, 0.3, 0.4), Color("#8BC34A"), 5)
	var mi := k.instance(parent, "Plaza")
	mi.position = Vector3(L.PLAZA.x, y, L.PLAZA.y)
	_collider(parent, Vector3(L.PLAZA.x, y + 0.6, L.PLAZA.y), Vector3(6.4, 1.2, 6.4))


static func _bridge(parent: Node3D) -> void:
	var rx := L.river_x(0.0)
	var y := 2.9
	var k := MeshKit.new()
	k.alpha = 0.4
	k.box(Vector3(0, y, 0), Vector3(18.0, 0.5, 4.0), STONE)
	for side in [-1.0, 1.0]:
		k.box(Vector3(0, y + 0.55, side * 1.9), Vector3(18.0, 0.6, 0.3), STONE.darkened(0.08))
		for i in 5:
			k.box(Vector3(-8.0 + i * 4.0, y + 1.0, side * 1.9), Vector3(0.45, 0.4, 0.45), STONE.darkened(0.15))
	for px in [-3.0, 3.0]:
		k.box(Vector3(px, (y - 1.5) * 0.5 - 0.5, 0), Vector3(1.4, y + 1.0, 4.2), STONE.darkened(0.12))
	# Choir rune on keystone
	k.box(Vector3(0, y - 0.15, 2.02), Vector3(0.6, 0.3, 0.05), Color("#5FE3E0"), 0.0, true)
	var mi := k.instance(parent, "OldSpan")
	mi.position = Vector3(rx, 0, 0)
	_collider(parent, Vector3(rx, y, 0), Vector3(18.0, 0.5, 4.0))
	for side in [-1.0, 1.0]:
		_collider(parent, Vector3(rx, y + 0.85, side * 1.9), Vector3(18.0, 1.2, 0.3))
	# ramps where the deck meets the banks
	for sx in [-1.0, 1.0]:
		var ramp := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new(); sh.size = Vector3(4.0, 0.4, 4.0)
		cs.shape = sh
		ramp.add_child(cs)
		ramp.position = Vector3(rx + sx * 10.5, y - 0.15, 0)
		ramp.rotation.z = -sx * 0.08
		parent.add_child(ramp)


static func _street_props(parent: Node3D) -> void:
	var k := MeshKit.new()
	k.glow_color = Color("#FFD98A")
	var lamps := [Vector2(-1, 3), Vector2(19, 3), Vector2(19, -4), Vector2(-1, -4), Vector2(30, 0), Vector2(-20, 3), Vector2(-24, -3), Vector2(44, -6)]
	for p in lamps:
		var y := _ground(p.x, p.y)
		k.cyl(Vector3(p.x, y + 1.6, p.y), 0.07, 0.1, 3.2, Color("#3A3A44"), 6)
		k.box(Vector3(p.x, y + 3.3, p.y), Vector3(0.45, 0.5, 0.45), Color("#3A3A44"))
		k.box(Vector3(p.x, y + 3.3, p.y), Vector3(0.32, 0.38, 0.32), Color("#FFD98A"), 0.0, true)
	var crates := [Vector2(29, -11), Vector2(30, -12), Vector2(20, 12), Vector2(-28, 12), Vector2(3, 19), Vector2(33, 10)]
	for p in crates:
		var y := _ground(p.x, p.y)
		k.box(Vector3(p.x, y + 0.45, p.y), Vector3(0.9, 0.9, 0.9), Color("#9C6B43"), p.x)
	var barrels := [Vector2(28, -3), Vector2(28.6, -2.2), Vector2(-3, 18), Vector2(21, 11)]
	for p in barrels:
		var y := _ground(p.x, p.y)
		k.cyl(Vector3(p.x, y + 0.5, p.y), 0.38, 0.38, 1.0, Color("#8A5A3A"), 8)
		k.cyl(Vector3(p.x, y + 0.5, p.y), 0.4, 0.4, 0.1, Color("#4A4A55"), 8)
	# fences along town outskirts
	for seg in [[Vector2(-38, 14), Vector2(-38, 26)], [Vector2(40, 12), Vector2(46, 22)], [Vector2(-38, -12), Vector2(-36, -28)]]:
		var a: Vector2 = seg[0]
		var b: Vector2 = seg[1]
		var n := int(a.distance_to(b) / 2.0)
		for i in n + 1:
			var p := a.lerp(b, float(i) / max(1, n))
			var y := _ground(p.x, p.y)
			k.box(Vector3(p.x, y + 0.5, p.y), Vector3(0.15, 1.0, 0.15), TIMBER)
		var mid := (a + b) * 0.5
		var ang := atan2(b.x - a.x, b.y - a.y)
		k.box(Vector3(mid.x, _ground(mid.x, mid.y) + 0.75, mid.y), Vector3(0.08, 0.12, a.distance_to(b)), TIMBER, ang)
	k.instance(parent, "StreetProps")


# ---------------------------------------------------------------- Choir ruins
static func build_ruins(parent: Node3D) -> Node3D:
	var root := Node3D.new()
	root.name = "ChoirSteps"
	parent.add_child(root)
	var c := L.RUINS
	var y := 10.0
	var k := MeshKit.new()
	k.glow_color = Color("#5FE3E0")
	# hexagonal dais
	k.cyl(Vector3(c.x, y + 0.2, c.y), 9.0, 9.5, 0.6, CHOIR, 6)
	k.cyl(Vector3(c.x, y + 0.55, c.y), 0.1, 0.1, 0.1, CHOIR, 6)
	for i in 6:
		var a := i * TAU / 6.0
		var r := 8.0
		var p := Vector3(c.x + cos(a) * r, y, c.y + sin(a) * r)
		var broken := i % 2 == 1
		var ph := 2.5 if broken else 6.5
		k.cyl(p + Vector3(0, ph * 0.5, 0), 0.5, 0.6, ph, CHOIR, 6)
		k.box(p + Vector3(0, ph * 0.5, 0), Vector3(0.12, ph * 0.8, 1.05), Color("#5FE3E0"), -a, true)
		if not broken:
			k.box(p + Vector3(0, ph + 0.25, 0), Vector3(1.6, 0.5, 1.6), CHOIR_DARK, -a)
		else:
			k.box(p + Vector3(1.4, 0.3, 0.6), Vector3(1.2, 0.6, 0.8), CHOIR, a)
	# broken arch toward the Core
	for side in [-1.0, 1.0]:
		k.box(Vector3(c.x + 3 + side * 2.5, y + 3.5, c.y - 10), Vector3(1.0, 7.0, 1.0), CHOIR)
	k.box(Vector3(c.x + 1.8, y + 7.3, c.y - 10), Vector3(4.0, 0.8, 1.1), CHOIR_DARK)
	# engraved steps down to the east road
	for i in 6:
		k.box(Vector3(c.x - 9.5 - i * 1.2, y - 0.4 - i * 0.55, c.y + 1.0), Vector3(1.4, 0.5, 5.0), CHOIR_DARK)
	# hidden chamber (brazier puzzle) west-south
	var hc := Vector3(66, L.height(66, -32), -32)
	k.box(hc + Vector3(0, 2.0, -2.5), Vector3(6.0, 4.0, 0.6), CHOIR)
	k.box(hc + Vector3(-2.8, 2.0, 0), Vector3(0.6, 4.0, 5.0), CHOIR)
	k.box(hc + Vector3(2.8, 2.0, 0), Vector3(0.6, 4.0, 5.0), CHOIR)
	k.box(hc + Vector3(0, 4.2, 0), Vector3(6.4, 0.5, 5.6), CHOIR_DARK)
	k.instance(root, "RuinsMesh")
	_collider(root, Vector3(c.x, y + 0.2, c.y), Vector3(15.0, 0.6, 15.0))
	for i in 6:
		var a := i * TAU / 6.0
		var p := Vector3(c.x + cos(a) * 8.0, y + 2.0, c.y + sin(a) * 8.0)
		_collider(root, p, Vector3(1.1, 4.0, 1.1))
	_collider(root, hc + Vector3(0, 2.0, -2.5), Vector3(6.0, 4.0, 0.6))
	_collider(root, hc + Vector3(-2.8, 2.0, 0), Vector3(0.6, 4.0, 5.0))
	_collider(root, hc + Vector3(2.8, 2.0, 0), Vector3(0.6, 4.0, 5.0))
	return root


static func build_arena(parent: Node3D) -> void:
	var c := L.ARENA
	var y := 10.0
	var k := MeshKit.new()
	k.glow_color = Color("#5FE3E0")
	k.cyl(Vector3(c.x, y + 0.1, c.y), 14.0, 14.5, 0.4, CHOIR_DARK, 12)
	k.cyl(Vector3(c.x, y + 0.32, c.y), 4.0, 4.0, 0.05, Color("#5FE3E0"), 6, Basis(), true)
	var pillars: Array = []
	for i in 10:
		var a := i * TAU / 10.0
		var p := Vector3(c.x + cos(a) * 15.5, y, c.y + sin(a) * 15.5)
		pillars.append(p)
		var ph := 7.0 + (i % 3) * 1.5
		k.cyl(p + Vector3(0, ph * 0.5, 0), 0.7, 0.9, ph, CHOIR, 6)
		k.sphere(p + Vector3(0, ph + 0.6, 0), Vector3(0.9, 1.2, 0.9), Color("#7FF5FF"), 6, true)
		_collider(parent, p + Vector3(0, ph * 0.5, 0), Vector3(1.6, ph, 1.6))
	# low Choir walls between pillars; the gap between pillars 7 and 8 (north) is the entrance
	for i in 10:
		if i == 7:
			continue
		var a: Vector3 = pillars[i]
		var b: Vector3 = pillars[(i + 1) % 10]
		var mid := (a + b) * 0.5
		var ang := atan2(b.x - a.x, b.z - a.z)
		var length := a.distance_to(b)
		k.box(mid + Vector3(0, 1.75, 0), Vector3(0.8, 3.5, length), CHOIR_DARK, ang)
		k.box(mid + Vector3(0, 2.6, 0), Vector3(0.84, 0.15, length), Color("#5FE3E0"), ang, true)
		_collider(parent, mid + Vector3(0, 2.5, 0), Vector3(0.8, 5.0, length), ang)
	k.instance(parent, "SanctumArena")
	_collider(parent, Vector3(c.x, y - 0.1, c.y), Vector3(28.0, 0.4, 28.0))


## Roofed Choir temple on the climb to the Hollow Warden's arena. The outer
## gate (sanctum_open) leads into the nave; two elemental choirs feed the inner
## seal (sanctum_inner_open) that opens the way to the arena.
static func build_sanctum_interior(parent: Node3D) -> Node3D:
	var c := L.SANCTUM
	var fy := L.SANCTUM_FLOOR
	var z0 := L.SANCTUM_Z0
	var z1 := L.SANCTUM_Z1
	var depth := z1 - z0
	var cz := (z0 + z1) * 0.5
	var root := Node3D.new()
	root.name = "HollowSanctum"
	parent.add_child(root)
	var k := MeshKit.new()
	k.glow_color = Color("#5FE3E0")
	var wall := Color("#8C97A6")
	var wall_dark := Color("#6E7A8C")
	var floor_col := Color("#7E8794")
	var trim := Color("#C9BFA8")
	var cyan := Color("#5FE3E0")

	# foundation, floor slab and aisle inlays
	k.box(Vector3(c.x, fy - 2.2, cz), Vector3(19.8, 5.0, depth - 1.0), wall_dark)
	k.box(Vector3(c.x, fy - 0.45, cz), Vector3(21.2, 0.9, depth), floor_col)
	k.box(Vector3(c.x, fy + 0.015, cz), Vector3(5.4, 0.03, depth - 1.0), wall_dark)
	for i in 9:
		var zz := z0 + 2.0 + i * 2.8
		k.box(Vector3(c.x - 2.9, fy + 0.035, zz), Vector3(0.12, 0.03, 1.8), cyan, 0.0, true)
		k.box(Vector3(c.x + 2.9, fy + 0.035, zz), Vector3(0.12, 0.03, 1.8), cyan, 0.0, true)
	_collider(parent, Vector3(c.x, fy - 0.45, cz), Vector3(21.2, 0.9, depth))
	# threshold platforms under both gates, flush with the ramps
	for tz in [z0, z1]:
		k.box(Vector3(c.x, fy - 1.5, tz), Vector3(7.2, 3.0, 1.0), floor_col)
		_collider(parent, Vector3(c.x, fy - 1.5, tz), Vector3(7.2, 3.0, 1.0))

	# side walls, plinth and cornice
	for sx in [-1.0, 1.0]:
		k.box(Vector3(c.x + sx * 10.0, fy + 4.5, cz), Vector3(0.9, 9.0, depth), wall)
		k.box(Vector3(c.x + sx * 10.0, fy + 0.55, cz), Vector3(1.1, 1.1, depth), trim)
		k.box(Vector3(c.x + sx * 10.0, fy + 8.72, cz), Vector3(1.15, 0.56, depth), trim)
		_collider(parent, Vector3(c.x + sx * 10.0, fy + 4.5, cz), Vector3(0.9, 9.0, depth))

	# south and north walls with their gates
	for sz in [z0, z1]:
		for sx in [-1.0, 1.0]:
			k.box(Vector3(c.x + sx * 6.75, fy + 4.5, sz), Vector3(6.5, 9.0, 0.9), wall)
			_collider(parent, Vector3(c.x + sx * 6.75, fy + 4.5, sz), Vector3(6.5, 9.0, 0.9))
		k.box(Vector3(c.x, fy + 6.75, sz), Vector3(7.0, 4.5, 0.9), wall)
		k.box(Vector3(c.x - 3.85, fy + 2.5, sz), Vector3(0.7, 5.0, 1.2), trim)
		k.box(Vector3(c.x + 3.85, fy + 2.5, sz), Vector3(0.7, 5.0, 1.2), trim)
		k.box(Vector3(c.x, fy + 5.15, sz), Vector3(8.4, 0.7, 1.2), trim)
		k.box(Vector3(c.x, fy + 4.74, sz), Vector3(7.0, 0.12, 1.24), cyan, 0.0, true)
		k.sphere(Vector3(c.x, fy + 7.35, sz), Vector3(1.6, 1.6, 0.24), trim, 12)
		k.sphere(Vector3(c.x, fy + 7.35, sz), Vector3(1.15, 1.15, 0.3), cyan, 12, true)

	# transverse arches dividing the Ember hall, the Gale hall and the inner sanctum
	for pz in [2.0, 9.0]:
		for sx in [-1.0, 1.0]:
			k.box(Vector3(c.x + sx * 6.75, fy + 4.5, pz), Vector3(6.5, 9.0, 0.7), wall_dark)
			_collider(parent, Vector3(c.x + sx * 6.75, fy + 4.5, pz), Vector3(6.5, 9.0, 0.7))
		k.box(Vector3(c.x, fy + 6.75, pz), Vector3(7.0, 4.5, 0.7), wall_dark)
		k.box(Vector3(c.x, fy + 4.74, pz), Vector3(7.0, 0.12, 0.9), cyan, 0.0, true)
		k.box(Vector3(c.x, fy + 8.3, pz), Vector3(7.2, 0.7, 0.9), trim)

	# engaged pilasters and wall glow slits
	for pz in [-7.5, -1.5, 5.5, 12.5]:
		for sx in [-1.0, 1.0]:
			k.box(Vector3(c.x + sx * 9.25, fy + 4.5, pz), Vector3(0.8, 9.0, 0.8), trim)
	for gz in [-4.6, 3.0, 11.0]:
		for sx in [-1.0, 1.0]:
			k.box(Vector3(c.x + sx * 9.46, fy + 4.2, gz), Vector3(0.08, 5.6, 0.16), cyan, 0.0, true)

	# exterior buttresses
	for bz in [-6.0, 2.0, 10.0]:
		for sx in [-1.0, 1.0]:
			k.box(Vector3(c.x + sx * 10.85, fy + 3.3, bz), Vector3(0.9, 6.6, 1.2), wall)
			k.box(Vector3(c.x + sx * 10.85, fy + 6.8, bz), Vector3(1.05, 0.4, 1.35), trim)
			_collider(parent, Vector3(c.x + sx * 10.85, fy + 3.3, bz), Vector3(0.9, 6.6, 1.2))

	# rear porch walls close the gap between the temple and the arena ring
	for sx in [-1.0, 1.0]:
		k.box(Vector3(c.x + sx * 10.0, fy + 2.6, z1 + 2.1), Vector3(0.9, 5.2, 4.4), wall)
		k.box(Vector3(c.x + sx * 10.0, fy + 5.25, z1 + 2.1), Vector3(1.1, 0.35, 4.5), trim)
		_collider(parent, Vector3(c.x + sx * 10.0, fy + 2.6, z1 + 2.1), Vector3(0.9, 5.2, 4.4))

	# ramps: up from the approach, down into the arena
	var ang := atan2(2.0, 4.0)
	var ramp_len := sqrt(20.0)
	var ramp_cy := fy - 1.18
	var ramp := BoxMesh.new()
	ramp.size = Vector3(6.0, 0.4, ramp_len)
	k.add(ramp, Transform3D(Basis(Vector3.RIGHT, -ang), Vector3(c.x, ramp_cy, z0 - 2.5)), floor_col)
	_collider_x(parent, Vector3(c.x, ramp_cy, z0 - 2.5), Vector3(6.0, 0.4, ramp_len), -ang)
	k.add(ramp, Transform3D(Basis(Vector3.RIGHT, ang), Vector3(c.x, ramp_cy, z1 + 2.5)), floor_col)
	_collider_x(parent, Vector3(c.x, ramp_cy, z1 + 2.5), Vector3(6.0, 0.4, ramp_len), ang)
	for rz in [z0 - 2.5, z1 + 2.5]:
		var rx := -ang if rz < cz else ang
		for sx in [-1.0, 1.0]:
			var curb := BoxMesh.new()
			curb.size = Vector3(0.45, 0.55, ramp_len)
			k.add(curb, Transform3D(Basis(Vector3.RIGHT, rx), Vector3(c.x + sx * 3.25, ramp_cy + 0.28, rz)), trim)
			_collider_x(parent, Vector3(c.x + sx * 3.25, ramp_cy + 0.28, rz), Vector3(0.45, 0.55, ramp_len), rx)
		var strip := BoxMesh.new()
		strip.size = Vector3(0.14, 0.42, ramp_len)
		k.add(strip, Transform3D(Basis(Vector3.RIGHT, rx), Vector3(c.x, ramp_cy + 0.2, rz)), cyan, true)

	# pitched roof, ridge cap, gable ends and interior beams
	var half := 10.75
	var rise := 5.2
	var roof_ang := atan2(rise, half)
	var roof_len := sqrt(half * half + rise * rise)
	var plane := BoxMesh.new()
	plane.size = Vector3(roof_len, 0.35, depth + 2.4)
	for sx in [-1.0, 1.0]:
		var b := Basis(Vector3.BACK, -sx * roof_ang)
		k.add(plane, Transform3D(b, Vector3(c.x + sx * half * 0.5, fy + 9.0 + rise * 0.5, cz)), wall_dark)
	k.box(Vector3(c.x, fy + 9.0 + rise + 0.1, cz), Vector3(0.7, 0.4, depth + 2.4), trim)
	for sz in [z0 - 0.3, z1 + 0.3]:
		var pm := PrismMesh.new()
		pm.size = Vector3(21.4, rise, 0.6)
		k.add(pm, Transform3D(Basis(), Vector3(c.x, fy + 9.0 + rise * 0.5, sz)), wall)
	for i in 7:
		k.box(Vector3(c.x, fy + 8.35, z0 + 1.5 + i * 4.0), Vector3(19.2, 0.45, 0.55), Color("#6B4630"))

	# hanging Choir lanterns under the beams
	for lz in [-6.0, 2.0, 10.0, 14.0]:
		for sx in [-1.0, 1.0]:
			k.cyl(Vector3(c.x + sx * 6.0, fy + 7.9, lz), 0.05, 0.05, 1.4, trim, 4)
			k.sphere(Vector3(c.x + sx * 6.0, fy + 7.1, lz), Vector3(0.5, 0.6, 0.5), Color("#BDF7FF"), 6, true)

	# glowing Choir emblems on the floor, one per hall
	for i in 8:
		var a := i * TAU / 8.0
		k.box(Vector3(c.x + cos(a) * 4.4, fy + 0.05, -1.8 + sin(a) * 4.4), Vector3(0.5, 0.05, 0.14), Color("#FF8A3D"), -a, true)
	for i in 8:
		var a2 := i * TAU / 8.0
		k.box(Vector3(c.x + cos(a2) * 3.6, fy + 0.05, 6.6 + sin(a2) * 3.6), Vector3(0.45, 0.05, 0.12), Color("#7FF5FF"), -a2, true)
	for i in 12:
		var a3 := i * TAU / 12.0
		k.box(Vector3(c.x + cos(a3) * 4.6, fy + 0.05, 13.4 + sin(a3) * 4.6), Vector3(0.5, 0.05, 0.12), cyan, -a3, true)

	# facade emblem
	k.cyl(Vector3(c.x, fy + 11.6, z0 - 0.62), 0.0, 0.9, 2.2, cyan, 4, Basis(), true)
	k.cyl(Vector3(c.x, fy + 10.6, z0 - 0.62), 0.9, 0.0, 1.4, cyan, 4, Basis(), true)
	k.instance(root, "SanctumInterior")
	return root


static func build_core(parent: Node3D) -> Node3D:
	var c := L.CORE
	var y := 12.0
	var root := Node3D.new()
	root.name = "ElyndraCore"
	root.position = Vector3(c.x, y, c.y)
	parent.add_child(root)
	var k := MeshKit.new()
	k.glow_color = Color("#7FF5FF")
	k.cyl(Vector3(0, 1.0, 0), 6.0, 7.0, 2.0, CHOIR_DARK, 6)
	k.cyl(Vector3(0, 22.0, 0), 1.2, 3.0, 40.0, CHOIR, 6)
	for i in 6:
		var a := i * TAU / 6.0
		k.box(Vector3(cos(a) * 2.2, 18.0, sin(a) * 2.2), Vector3(0.3, 30.0, 0.3), Color("#7FF5FF"), -a, true)
		k.cyl(Vector3(cos(a) * 5.0, 6.0, sin(a) * 5.0), 0.3, 0.9, 12.0, CHOIR, 6,
			Basis(Vector3(-sin(a), 0, cos(a)), 0.25))
	k.cyl(Vector3(0, 47.0, 0), 0.0, 2.5, 10.0, Color("#BDF7FF"), 6, Basis(), true)
	k.cyl(Vector3(0, 40.0, 0), 2.5, 0.0, 4.0, Color("#BDF7FF"), 6, Basis(Vector3.RIGHT, PI), true)
	k.instance(root, "Spire")
	# floating rings (animated by the world script)
	for i in 3:
		var ring := MeshInstance3D.new()
		ring.name = "Ring%d" % i
		var tm := TorusMesh.new()
		tm.inner_radius = 5.0 + i * 1.5
		tm.outer_radius = 5.4 + i * 1.5
		tm.rings = 24
		tm.ring_segments = 4
		ring.mesh = tm
		ring.material_override = MeshKit.glow_mat(Color("#7FF5FF"))
		ring.position.y = 30.0 + i * 5.0
		ring.rotation = Vector3(0.3 * (i + 1), 0, 0.2 * i)
		root.add_child(ring)
	_collider(parent, root.position + Vector3(0, 10, 0), Vector3(6, 20, 6))
	return root


static func build_camp(parent: Node3D, center: Vector2) -> void:
	var k := MeshKit.new()
	k.glow_color = Color("#FF9A4D")
	var y := _ground(center.x, center.y)
	k.cyl(Vector3(center.x, y + 0.15, center.y), 0.9, 1.0, 0.3, Color("#6E6A64"), 8)
	k.cyl(Vector3(center.x, y + 0.6, center.y), 0.0, 0.5, 0.9, Color("#FF9A4D"), 5, Basis(), true)
	for a in [0.6, 2.6, 4.4]:
		var p := Vector2(center.x + cos(a) * 4.0, center.y + sin(a) * 4.0)
		var py := _ground(p.x, p.y)
		k.cyl(Vector3(p.x, py + 1.0, p.y), 0.0, 1.5, 2.0, Color("#7D6B52"), 4, Basis(Vector3.UP, a))
		k.box(Vector3(center.x + cos(a + 0.8) * 2.0, y + 0.25, center.y + sin(a + 0.8) * 2.0), Vector3(1.4, 0.4, 0.4), TIMBER, a)
	k.instance(parent, "Camp")
