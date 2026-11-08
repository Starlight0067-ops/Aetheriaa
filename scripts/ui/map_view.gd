class_name MapView
extends Control
## Draws the Elyndra map from the authored height function. Used both as the
## HUD minimap (follows the player) and the full-screen map.
## Undiscovered landmarks are never revealed, except the current quest target.

const L = preload("res://scripts/world/elyndra_layout.gd")
const ICONS := {
	"landmark": Color("#E2B95B"), "town": Color("#F4EEDC"), "checkpoint": Color("#7FF5FF"),
	"ruins": Color("#9AA7B5"), "quest": Color("#FFD34D"), "boss": Color("#FF6A5A"),
}

static var _texture: ImageTexture

var minimap := false
var zoom := 1.0
var player: Node3D


static func map_texture() -> ImageTexture:
	if _texture:
		return _texture
	var size := 160
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	for py in size:
		for px in size:
			var x := -L.HALF + (px + 0.5) * (L.HALF * 2.0 / size)
			var z := -L.HALF + (py + 0.5) * (L.HALF * 2.0 / size)
			var h := L.height(x, z)
			var c: Color
			if h < L.WATER_Y + 0.15:
				c = Color("#5B9BD0").lerp(Color("#3E78B8"), clamp(-h * 0.4, 0.0, 1.0))
			else:
				c = L.ground_color(x, z, h, 0.0)
				c = c.lerp(Color("#E8DCC0"), 0.25)
				var shade: float = clamp((L.height(x + 1.5, z + 1.5) - h) * 0.2, -0.25, 0.25)
				c = c.darkened(shade) if shade > 0 else c.lightened(-shade)
			if Vector2(x, z).distance_to(L.TOWN_CENTER) < 30.0 and L.road_distance(x, z) > 3.0 and h > 2.0:
				c = c.lerp(Color("#D8B98C"), 0.3)
			img.set_pixel(px, py, c)
	_texture = ImageTexture.create_from_image(img)
	return _texture


func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(_d: float) -> void:
	if is_visible_in_tree():
		queue_redraw()


func _world_to_map(p: Vector3, center: Vector2, scale_px: float) -> Vector2:
	return size * 0.5 + (Vector2(p.x, p.z) - center) * scale_px


func _draw() -> void:
	if player == null:
		player = get_tree().get_first_node_in_group("player") as Node3D
	var center := Vector2.ZERO
	var scale_px: float = min(size.x, size.y) / (L.HALF * 2.0)
	if minimap and player:
		center = Vector2(player.global_position.x, player.global_position.z)
		scale_px = min(size.x, size.y) / 90.0
	elif not minimap:
		scale_px *= zoom
	var tex := map_texture()
	var top_left := _world_to_map(Vector3(-L.HALF, 0, -L.HALF), center, scale_px)
	draw_texture_rect(tex, Rect2(top_left, Vector2.ONE * L.HALF * 2.0 * scale_px), false)
	# roads
	for key in L.ROADS:
		var pts: Array = L.ROADS[key]
		for i in pts.size() - 1:
			var a := _world_to_map(Vector3(pts[i].x, 0, pts[i].y), center, scale_px)
			var b := _world_to_map(Vector3(pts[i + 1].x, 0, pts[i + 1].y), center, scale_px)
			draw_line(a, b, Color("#B89A6A"), max(1.5, scale_px * 2.0))
	# discovered landmarks & checkpoints
	var font := UITheme.body_font()
	for lm in get_tree().get_nodes_in_group("landmark"):
		if not Game.discovered.has(lm.id):
			continue
		var p := _world_to_map(lm.global_position, center, scale_px)
		var col: Color = ICONS.get(lm.map_icon, ICONS.landmark)
		_diamond(p, 6.0 if not minimap else 4.0, col)
		if not minimap:
			draw_string(font, p + Vector2(9, 5), lm.display_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color.WHITE)
	for cp in get_tree().get_nodes_in_group("checkpoint"):
		if Game.discovered.has(cp.id) or not minimap:
			if not Game.discovered.has(cp.id): continue
			var p := _world_to_map(cp.global_position, center, scale_px)
			draw_circle(p, 4.0, ICONS.checkpoint)
	# quest marker
	var q := Quests.tracked_quest()
	if q != "":
		var target: String = Quests.current_step(q).get("target", "")
		if Game.world_positions.has(target):
			var p := _world_to_map(Game.world_positions[target], center, scale_px)
			if minimap:
				var half := size * 0.5 - Vector2(8, 8)
				var off := p - size * 0.5
				if abs(off.x) > half.x or abs(off.y) > half.y:
					off = off * min(half.x / max(abs(off.x), 0.01), half.y / max(abs(off.y), 0.01))
					p = size * 0.5 + off
			var pulse := 1.0 + sin(Time.get_ticks_msec() * 0.006) * 0.2
			draw_circle(p, 7.0 * pulse, Color(1, 0.83, 0.3, 0.35))
			draw_string(font, p + Vector2(-4, 6), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, ICONS.quest)
	# player arrow
	if player:
		var pp := _world_to_map(player.global_position, center, scale_px)
		var cam := player.get("rig") as CameraRig
		var yaw: float = cam.yaw if cam else player.rotation.y
		var fwd := Vector2(-sin(yaw), -cos(yaw))
		var right := Vector2(-fwd.y, fwd.x)
		var pts := PackedVector2Array([pp + fwd * 9.0, pp - fwd * 5.0 + right * 6.0, pp - fwd * 2.0, pp - fwd * 5.0 - right * 6.0])
		draw_colored_polygon(pts, Color.WHITE)
		draw_polyline(pts + PackedVector2Array([pts[0]]), Color("#1B2A4A"), 1.5)
	if minimap:
		draw_rect(Rect2(Vector2.ZERO, size), UITheme.BRASS, false, 2.0)


func _diamond(p: Vector2, r: float, c: Color) -> void:
	var pts := PackedVector2Array([p + Vector2(0, -r), p + Vector2(r, 0), p + Vector2(0, r), p + Vector2(-r, 0)])
	draw_colored_polygon(pts, c)
	draw_polyline(pts + PackedVector2Array([pts[0]]), Color(0, 0, 0, 0.6), 1.0)
