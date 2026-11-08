class_name TerrainBuilder
extends RefCounted
## Builds the Elyndra terrain mesh, heightmap collision, water and vegetation.

const L = preload("res://scripts/world/elyndra_layout.gd")

static var height_tex: ImageTexture


static func build_terrain(parent: Node3D) -> void:
	var n := int(L.HALF * 2.0 / L.STEP) + 1
	var heights := PackedFloat32Array()
	heights.resize(n * n)
	for zi in n:
		for xi in n:
			heights[zi * n + xi] = L.height(-L.HALF + xi * L.STEP, -L.HALF + zi * L.STEP)

	var himg := Image.create_from_data(n, n, false, Image.FORMAT_RF, heights.to_byte_array())
	himg.convert(Image.FORMAT_RH)   # R16F: linear filtering is guaranteed on every Vulkan GPU (R32F is not)
	height_tex = ImageTexture.create_from_image(himg)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for zi in n:
		for xi in n:
			var x := -L.HALF + xi * L.STEP
			var z := -L.HALF + zi * L.STEP
			var h := heights[zi * n + xi]
			var hx := heights[zi * n + min(xi + 1, n - 1)] - heights[zi * n + max(xi - 1, 0)]
			var hz := heights[min(zi + 1, n - 1) * n + xi] - heights[max(zi - 1, 0) * n + xi]
			var normal := Vector3(-hx, 2.0 * L.STEP, -hz).normalized()
			var slope := 1.0 - normal.y
			st.set_color(L.ground_color(x, z, h, slope * 4.0))
			st.set_normal(normal)
			st.add_vertex(Vector3(x, h, z))
	for zi in n - 1:
		for xi in n - 1:
			var i := zi * n + xi
			st.add_index(i); st.add_index(i + 1); st.add_index(i + n)
			st.add_index(i + 1); st.add_index(i + n + 1); st.add_index(i + n)
	var mesh := st.commit()
	mesh.surface_set_material(0, StyleMats.terrain())
	var mi := MeshInstance3D.new()
	mi.name = "TerrainMesh"
	mi.mesh = mesh
	parent.add_child(mi)

	# Heightmap collision. Heights are halved and the shape uniformly scaled x2
	# so the 1-unit heightmap grid matches the 2 m mesh grid.
	var body := StaticBody3D.new()
	body.name = "TerrainBody"
	body.collision_layer = 1
	var shape := HeightMapShape3D.new()
	shape.map_width = n
	shape.map_depth = n
	var half := PackedFloat32Array()
	half.resize(heights.size())
	for i in heights.size():
		half[i] = heights[i] / L.STEP
	shape.map_data = half
	var cs := CollisionShape3D.new()
	cs.shape = shape
	cs.scale = Vector3.ONE * L.STEP
	body.add_child(cs)
	parent.add_child(body)


static func build_water(parent: Node3D) -> void:
	var m := StyleMats.water(height_tex, L.HALF, L.WATER_Y)
	var plane := PlaneMesh.new()
	plane.size = Vector2(130, 230)
	plane.subdivide_width = 26
	plane.subdivide_depth = 46
	var mi := MeshInstance3D.new()
	mi.name = "Water"
	mi.mesh = plane
	mi.material_override = m
	mi.position = Vector3(-30, L.WATER_Y, 5)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)


static func build_waterfall(parent: Node3D) -> void:
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled;
void fragment() {
	float s = fract(UV.y * 3.0 - TIME * 1.6 + sin(UV.x * 30.0) * 0.08);
	float streak = smoothstep(0.0, 0.5, s) * (1.0 - smoothstep(0.5, 1.0, s));
	ALBEDO = mix(vec3(0.62, 0.86, 1.0), vec3(1.0), streak * 0.8);
	ALPHA = 0.55 + streak * 0.35;
}
"""
	var m := ShaderMaterial.new()
	m.shader = shader
	var top := L.height(L.LAKE.x, -101.0)
	var quad := QuadMesh.new()
	quad.size = Vector2(7.0, top - L.WATER_Y + 1.0)
	var mi := MeshInstance3D.new()
	mi.name = "Silverfall"
	mi.mesh = quad
	mi.material_override = m
	mi.position = Vector3(L.LAKE.x, (top + L.WATER_Y) * 0.5, -94.5)
	mi.rotation.x = -0.18
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	# mist
	var mist := CPUParticles3D.new()
	mist.name = "Mist"
	mist.amount = 24
	mist.lifetime = 2.2
	mist.position = Vector3(L.LAKE.x, L.WATER_Y + 0.5, -93.0)
	mist.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	mist.emission_box_extents = Vector3(3.5, 0.3, 1.0)
	mist.direction = Vector3(0, 1, 1)
	mist.spread = 35.0
	mist.initial_velocity_min = 0.8
	mist.initial_velocity_max = 1.8
	mist.gravity = Vector3(0, -0.2, 0)
	mist.scale_amount_min = 1.2
	mist.scale_amount_max = 2.4
	var sm := SphereMesh.new(); sm.radius = 0.4; sm.height = 0.8; sm.radial_segments = 6; sm.rings = 3
	sm.material = MeshKit.flat(Color(1, 1, 1, 0.25), true, true)
	mist.mesh = sm
	parent.add_child(mist)
	# stream on the plateau feeding the fall
	var k := MeshKit.new()
	for i in 6:
		var z := -96.0 - i * 3.0
		k.box(Vector3(L.LAKE.x + sin(i) * 0.6, L.height(L.LAKE.x, z) + 0.05, z), Vector3(4.0, 0.1, 3.2), Color("#7CC4EA"))
	k.instance(parent, "Stream")


# ---------------------------------------------------------------- vegetation
static func _tree_meshes() -> Dictionary:
	var trunk := Color("#7A5236")
	var oak := MeshKit.new()
	oak.cyl(Vector3(0, 1.4, 0), 0.2, 0.34, 2.8, trunk, 7)
	oak.cyl(Vector3(0.35, 2.5, 0), 0.06, 0.12, 1.2, trunk, 5, Basis(Vector3.BACK, -0.7))
	for b in [[0, 3.5, 0, 3.6, 2.6, "#3F8E44"], [1.1, 3.1, 0.5, 2.4, 2.0, "#4C9E4C"], [-1.0, 3.3, -0.6, 2.5, 2.1, "#37803F"],
			[0.3, 4.5, -0.3, 2.6, 2.0, "#5DB55A"], [-0.6, 4.1, 0.8, 2.0, 1.7, "#55AA52"], [0.8, 4.0, -0.9, 1.9, 1.6, "#4A9A4A"]]:
		oak.sphere(Vector3(b[0], b[1], b[2]), Vector3(b[3], b[4], b[3]), Color(b[5]), 9)
	var pine := MeshKit.new()
	pine.cyl(Vector3(0, 1.0, 0), 0.14, 0.26, 2.0, trunk, 6)
	for t in [[2.2, 2.0, 2.4, "#2C6440"], [3.4, 1.65, 2.2, "#327049"], [4.5, 1.3, 2.0, "#397C50"], [5.5, 0.95, 1.7, "#418858"], [6.4, 0.55, 1.3, "#4A935F"]]:
		pine.cyl(Vector3(0, t[0], 0), 0.0, t[1], t[2], Color(t[3]), 8)
	var lantern := MeshKit.new()   # "Lanternleaf": pale trunk, teal crown, glowing seed-lanterns
	lantern.glow_color = Color("#FFE7A0")
	lantern.cyl(Vector3(0, 2.0, 0), 0.11, 0.2, 4.0, Color("#E6E1D3"), 6)
	lantern.sphere(Vector3(0, 4.7, 0), Vector3(2.2, 3.2, 2.2), Color("#5FBF8E"), 9)
	lantern.sphere(Vector3(0.4, 6.0, 0.2), Vector3(1.5, 1.8, 1.5), Color("#7CD6A0"), 8)
	lantern.sphere(Vector3(-0.5, 5.4, -0.4), Vector3(1.3, 1.5, 1.3), Color("#6ACB96"), 7)
	for i in 5:
		var a := i * TAU / 5.0
		lantern.sphere(Vector3(cos(a) * 1.0, 3.6 + (i % 2) * 0.5, sin(a) * 1.0), Vector3(0.22, 0.3, 0.22), Color("#FFE7A0"), 6, true)
	var bush := MeshKit.new()
	bush.sphere(Vector3(0, 0.5, 0), Vector3(1.6, 1.1, 1.6), Color("#468F45"), 8)
	bush.sphere(Vector3(0.5, 0.55, 0.3), Vector3(1.1, 0.9, 1.1), Color("#57A651"), 7)
	bush.sphere(Vector3(-0.4, 0.75, -0.2), Vector3(0.9, 0.8, 0.9), Color("#62B35A"), 7)
	var petals := ["#FF8FB1", "#FFFFFF", "#FFD34D", "#FF8FB1"]
	for i in 4:
		var a := i * 1.7
		bush.sphere(Vector3(cos(a) * 0.6, 0.9 + (i % 2) * 0.2, sin(a) * 0.6), Vector3(0.14, 0.14, 0.14), Color(petals[i]), 5)
	var rock := MeshKit.new()
	rock.sphere(Vector3(0, 0.3, 0), Vector3(1.6, 1.1, 1.3), Color("#9A958C"), 6)
	rock.sphere(Vector3(0.4, 0.55, 0.1), Vector3(0.9, 0.8, 0.9), Color("#A8A399"), 5)
	rock.sphere(Vector3(-0.3, 0.75, -0.1), Vector3(0.7, 0.25, 0.6), Color("#6FA35A"), 5)
	# grass tuft: 6 single-triangle blades, dark root -> bright tip
	var gst := SurfaceTool.new()
	gst.begin(Mesh.PRIMITIVE_TRIANGLES)
	var grng := RandomNumberGenerator.new()
	grng.seed = 11
	for i in 6:
		var a := grng.randf() * TAU
		var r := grng.randf_range(0.0, 0.12)
		var base := Vector3(cos(a) * r, 0, sin(a) * r)
		var side := Vector3(-sin(a), 0, cos(a)) * 0.035
		var h := grng.randf_range(0.32, 0.55)
		var lean := Vector3(cos(a), 0, sin(a)) * grng.randf_range(0.04, 0.14)
		for v in [[base - side, Color("#3E7F3A")], [base + side, Color("#3E7F3A")], [base + lean + Vector3(0, h, 0), Color("#B5E07A")]]:
			gst.set_color(v[1])
			gst.set_normal(Vector3.UP)
			gst.add_vertex(v[0])
	var grass := gst.commit()
	var flower := MeshKit.new()
	flower.cyl(Vector3(0, 0.15, 0), 0.015, 0.015, 0.3, Color("#4E9A45"), 3)
	flower.sphere(Vector3(0, 0.32, 0), Vector3(0.16, 0.07, 0.16), Color.WHITE, 6)
	flower.sphere(Vector3(0, 0.35, 0), Vector3(0.06, 0.05, 0.06), Color("#FFE27A"), 4)
	var out := {"oak": oak.build(), "pine": pine.build(), "lantern": lantern.build(), "bush": bush.build(),
		"rock": rock.build(), "grass": grass, "flower": flower.build()}
	for k in ["oak", "pine", "lantern"]:
		out[k].surface_set_material(0, StyleMats.foliage("tree"))
	out.bush.surface_set_material(0, StyleMats.foliage("bush"))
	return out


## Designed vegetation: each zone is authored with a density, species mix and
## radius; a seeded jitter breaks up regularity but placement stays intentional.
static func build_vegetation(parent: Node3D, grass_density: float) -> Array:
	var meshes := _tree_meshes()
	var rng := RandomNumberGenerator.new()
	rng.seed = 612
	var zones := [
		# center, radius, count, species weights
		{"c": Vector2(-60, 52), "r": 42.0, "n": 170, "mix": {"oak": 3, "pine": 3, "lantern": 2, "bush": 2}},   # Whisperwood
		{"c": Vector2(-88, 10), "r": 30.0, "n": 70, "mix": {"pine": 5, "oak": 1, "bush": 1}},
		{"c": Vector2(-60, -50), "r": 26.0, "n": 50, "mix": {"oak": 2, "lantern": 3, "bush": 2}},             # lake woods
		{"c": Vector2(-10, -85), "r": 26.0, "n": 50, "mix": {"pine": 4, "oak": 1}},
		{"c": Vector2(40, -55), "r": 30.0, "n": 60, "mix": {"pine": 3, "oak": 2, "bush": 1}},
		{"c": Vector2(60, 60), "r": 34.0, "n": 70, "mix": {"oak": 3, "bush": 2, "lantern": 1}},
		{"c": Vector2(10, 80), "r": 30.0, "n": 50, "mix": {"oak": 2, "pine": 2, "bush": 2}},
		{"c": Vector2(-30, 90), "r": 22.0, "n": 40, "mix": {"pine": 2, "oak": 2, "lantern": 1}},
		{"c": Vector2(95, -10), "r": 22.0, "n": 30, "mix": {"pine": 4}},
	]
	var clearings := [Vector2(-48, 30), Vector2(-60, 35), Vector2(-62, 80), Vector2(-52, 70)]
	var placed := {"oak": [], "pine": [], "lantern": [], "bush": [], "rock": []}
	var colliders: Array = []
	for zone in zones:
		var total := 0
		for k in zone.mix: total += zone.mix[k]
		var tries := 0
		var count := 0
		while count < zone.n and tries < zone.n * 6:
			tries += 1
			var ang := rng.randf() * TAU
			var dist: float = sqrt(rng.randf()) * zone.r
			var p: Vector2 = zone.c + Vector2(cos(ang), sin(ang)) * dist
			if abs(p.x) > 112 or abs(p.y) > 112 or L.is_blocked(p.x, p.y) or L.road_distance(p.x, p.y) < 5.0:
				continue
			var skip := L.height(p.x, p.y) > 19.0
			for cl in clearings:
				if p.distance_to(cl) < 7.0: skip = true
			if skip: continue
			var pick := rng.randi() % total
			var species := ""
			for k in zone.mix:
				pick -= zone.mix[k]
				if pick < 0:
					species = k
					break
			placed[species].append(Vector3(p.x, L.height(p.x, p.y), p.y))
			count += 1
	# boulders along slopes and the river
	for i in 90:
		var p := Vector2(rng.randf_range(-110, 110), rng.randf_range(-110, 110))
		if L.is_blocked(p.x, p.y): continue
		placed.rock.append(Vector3(p.x, L.height(p.x, p.y) - 0.2, p.y))

	for species in placed:
		var list: Array = placed[species]
		var tint_jitter := 0.12 if species != "rock" else 0.06
		_chunked_multimesh(parent, meshes[species], list, rng, species, 170.0, tint_jitter,
			Vector2(0.8, 1.35) if species != "bush" else Vector2(0.7, 1.2))
		if species in ["oak", "pine", "lantern", "rock"]:
			for p in list:
				colliders.append([p, 0.45 if species != "rock" else 0.9, species])
	_build_tree_colliders(parent, colliders)

	# grass tufts & flowers (short visibility range, chunked)
	var tufts: Array = []
	var flowers: Array = []
	var tuft_count := int(10000 * grass_density)
	for i in tuft_count:
		var p := Vector2(rng.randf_range(-100, 100), rng.randf_range(-100, 100))
		if i % 2 == 0:
			p = Vector2(rng.randf_range(-70, 60), rng.randf_range(-60, 90))
		if L.road_distance(p.x, p.y) < 2.2 or L.is_water(p.x, p.y): continue
		if Vector2(p.x, p.y).distance_to(L.PLAZA) < 11.0: continue
		var h := L.height(p.x, p.y)
		if h > 20.0: continue
		tufts.append(Vector3(p.x, h, p.y))
	for i in int(900 * grass_density):
		var p := Vector2(rng.randf_range(-25, 45), rng.randf_range(12, 60))
		if rng.randf() < 0.4:
			p = Vector2(rng.randf_range(-70, -25), rng.randf_range(-70, -40))
		if L.road_distance(p.x, p.y) < 2.0 or L.is_water(p.x, p.y): continue
		flowers.append(Vector3(p.x, L.height(p.x, p.y), p.y))
	_chunked_multimesh(parent, meshes.grass, tufts, rng, "grass", 34.0, 0.12, Vector2(0.8, 1.6), false, 20.0)
	_chunked_multimesh(parent, meshes.flower, flowers, rng, "flower", 50.0, 0.0, Vector2(0.8, 1.3), true, 20.0)
	return placed.rock


static func _chunked_multimesh(parent: Node3D, mesh: Mesh, points: Array, rng: RandomNumberGenerator,
		label: String, vis_range: float, jitter: float, scale_range: Vector2, flower_colors: bool = false, chunk: float = 40.0) -> void:
	var chunks: Dictionary = {}
	for p in points:
		var key := Vector2i(floori(p.x / chunk), floori(p.z / chunk))
		if not chunks.has(key): chunks[key] = []
		chunks[key].append(p)
	var palette := [Color("#FFD34D"), Color("#FF8FB1"), Color("#FFFFFF"), Color("#9FC7FF"), Color("#FFB36B")]
	for key in chunks:
		var list: Array = chunks[key]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = mesh
		mm.instance_count = list.size()
		for i in list.size():
			var s := rng.randf_range(scale_range.x, scale_range.y)
			var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.9, 1.1), s))
			mm.set_instance_transform(i, Transform3D(b, list[i]))
			var c := Color.WHITE
			if flower_colors:
				c = palette[rng.randi() % palette.size()]
			else:
				var j := rng.randf_range(-jitter, jitter)
				c = Color(1.0 + j, 1.0 + j * 0.5, 1.0 - j * 0.3)
			mm.set_instance_color(i, c)
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "%s_%d_%d" % [label, key.x, key.y]
		mmi.multimesh = mm
		mmi.material_override = StyleMats.foliage("grass") if label in ["grass", "flower"] else null
		mmi.visibility_range_end = vis_range
		mmi.visibility_range_end_margin = 10.0
		if label in ["grass", "flower"]:
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		parent.add_child(mmi)


static func _build_tree_colliders(parent: Node3D, list: Array) -> void:
	var body := StaticBody3D.new()
	body.name = "VegetationColliders"
	for entry in list:
		var cs := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = entry[1]
		shape.height = 4.0
		cs.shape = shape
		cs.position = entry[0] + Vector3(0, 1.5, 0)
		body.add_child(cs)
	parent.add_child(body)
	# canopies: camera-only collision (layer 4) so the camera never sits inside leaves
	var canopy := StaticBody3D.new()
	canopy.name = "CanopyCameraBlockers"
	canopy.collision_layer = 8
	canopy.collision_mask = 0
	var heights := {"oak": [3.4, 1.9], "pine": [3.4, 1.5], "lantern": [5.0, 1.4]}
	for entry in list:
		if not heights.has(entry[2]):
			continue
		var cs := CollisionShape3D.new()
		var sp := SphereShape3D.new()
		sp.radius = heights[entry[2]][1]
		cs.shape = sp
		cs.position = entry[0] + Vector3(0, heights[entry[2]][0], 0)
		canopy.add_child(cs)
	parent.add_child(canopy)
