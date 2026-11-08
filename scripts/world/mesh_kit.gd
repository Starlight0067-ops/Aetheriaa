class_name MeshKit
extends RefCounted
## Builds merged, vertex-colored meshes from primitive parts.
## One MeshKit = one draw call per surface (base + optional glow), which keeps
## draw calls low on integrated GPUs.

var _base := SurfaceTool.new()
var _glow := SurfaceTool.new()
var _has_base := false
var _has_glow := false
var glow_color := Color(0.5, 0.96, 1.0)
var alpha := 1.0                 # surface pattern id for StyleMats.structure()
var material_kind := "structure"

static var _materials: Dictionary = {}


func _init() -> void:
	_base.begin(Mesh.PRIMITIVE_TRIANGLES)
	_glow.begin(Mesh.PRIMITIVE_TRIANGLES)


## Append a primitive mesh, transformed and tinted.
func add(prim: PrimitiveMesh, xform: Transform3D, color: Color, glow: bool = false) -> MeshKit:
	var arrays := prim.get_mesh_arrays()
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	var st := _glow if glow else _base
	var basis := xform.basis
	var nbasis := basis.inverse().transposed()
	if glow: _has_glow = true
	else: _has_base = true
	var c := color
	c.a = 1.0 if glow else alpha
	if indices.is_empty():
		for i in verts.size():
			st.set_color(c)
			st.set_normal((nbasis * normals[i]).normalized())
			st.add_vertex(xform * verts[i])
	else:
		for i in indices:
			st.set_color(c)
			st.set_normal((nbasis * normals[i]).normalized())
			st.add_vertex(xform * verts[i])
	return self


func box(pos: Vector3, size: Vector3, color: Color, rot_y: float = 0.0, glow: bool = false) -> MeshKit:
	var m := BoxMesh.new()
	m.size = size
	return add(m, Transform3D(Basis(Vector3.UP, rot_y), pos), color, glow)


func cyl(pos: Vector3, r_top: float, r_bottom: float, h: float, color: Color, segments: int = 8, xbasis: Basis = Basis(), glow: bool = false) -> MeshKit:
	var m := CylinderMesh.new()
	m.top_radius = r_top
	m.bottom_radius = r_bottom
	m.height = h
	m.radial_segments = segments
	m.rings = 1
	return add(m, Transform3D(xbasis, pos), color, glow)


func sphere(pos: Vector3, scale: Vector3, color: Color, segments: int = 8, glow: bool = false) -> MeshKit:
	var m := SphereMesh.new()
	m.radius = 0.5
	m.height = 1.0
	m.radial_segments = segments
	m.rings = max(3, segments / 2)
	return add(m, Transform3D(Basis().scaled(scale), pos), color, glow)


func prism(pos: Vector3, size: Vector3, color: Color, rot_y: float = 0.0) -> MeshKit:
	var m := PrismMesh.new()
	m.size = size
	return add(m, Transform3D(Basis(Vector3.UP, rot_y), pos), color)


func build() -> ArrayMesh:
	var mesh := ArrayMesh.new()
	if _has_base:
		_base.commit(mesh)
		mesh.surface_set_material(mesh.get_surface_count() - 1, StyleMats.character() if material_kind == "character" else StyleMats.structure())
	if _has_glow:
		_glow.commit(mesh)
		mesh.surface_set_material(mesh.get_surface_count() - 1, MeshKit.glow_mat(glow_color))
	return mesh


func instance(parent: Node, name: String = "Mesh") -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = name
	mi.mesh = build()
	parent.add_child(mi)
	return mi


static func character_kit() -> MeshKit:
	var k := MeshKit.new()
	k.material_kind = "character"
	return k


# ---------------------------------------------------------------- shared materials
static func mat(kind: String) -> StandardMaterial3D:
	if _materials.has(kind):
		return _materials[kind]
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = true
	m.roughness = 0.85
	match kind:
		"toon":
			m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
			m.specular_mode = BaseMaterial3D.SPECULAR_TOON
			m.roughness = 0.7
		"terrain", "foliage":
			m.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT_WRAP
			m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
			if kind == "foliage":
				m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_materials[kind] = m
	return m


static func glow_mat(c: Color) -> StandardMaterial3D:
	var key := "glow_" + c.to_html()
	if _materials.has(key):
		return _materials[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 2.2
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_materials[key] = m
	return m


static func flat(c: Color, unshaded: bool = false, alpha: bool = false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	if unshaded:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if alpha:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return m
