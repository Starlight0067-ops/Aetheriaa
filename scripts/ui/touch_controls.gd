class_name TouchControls
extends CanvasLayer
## On-screen controls for phones: floating joystick (left half), camera drag (right half) and action buttons.
## Buttons are TouchScreenButtons bound to the same input actions as the keyboard, so gameplay code is shared.

const STICK_R := 92.0

var _stick_index := -1
var _stick_origin := Vector2.ZERO
var _stick := Vector2.ZERO
var _sprint := false
var _look_index := -1
var _look_last := Vector2.ZERO
var _base: TextureRect
var _knob: TextureRect
var _buttons: Array[TouchScreenButton] = []
var _interact: TouchScreenButton
var _skill_ring: TextureRect
var _margin_l := 0.0
var _margin_r := 0.0


static func is_wanted() -> bool:
	return OS.has_feature("mobile") or OS.has_feature("web_ios") or OS.has_feature("web_android") \
		or "--touch" in OS.get_cmdline_user_args()


static func _circle(radius: int, fill: Color, ring: Color, ring_w: float = 4.0) -> ImageTexture:
	var s := radius * 2
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	for y in s:
		for x in s:
			var d := Vector2(x + 0.5 - radius, y + 0.5 - radius).length()
			var c := Color(0, 0, 0, 0)
			if d <= radius:
				c = ring if d > radius - ring_w else fill
				c.a *= clamp(radius - d, 0.0, 1.0)   # anti-aliased edge
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)


func _ready() -> void:
	layer = 6
	_compute_safe_margins()
	_base = TextureRect.new()
	_base.texture = _circle(int(STICK_R), Color(0.06, 0.09, 0.16, 0.35), Color(0.9, 0.85, 0.7, 0.55), 3.0)
	_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_base.visible = false
	add_child(_base)
	_knob = TextureRect.new()
	_knob.texture = _circle(38, Color(0.95, 0.92, 0.82, 0.75), Color(0.5, 0.95, 1.0, 0.9), 3.0)
	_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_knob.visible = false
	add_child(_knob)
	_add_button("attack", "ATK", 76, Vector2(-128, -128), Color("#E2B95B"))
	_add_button("skill", "SKILL", 52, Vector2(-268, -92), Color("#7FF5FF"))
	_add_button("dodge", "»", 50, Vector2(-108, -284), Color("#A9B4C8"))
	_add_button("jump", "▲", 50, Vector2(-250, -232), Color("#A9B4C8"))
	_add_button("heal", "+", 36, Vector2(-392, -64), Color("#FF7A8A"))
	_interact = _add_button("interact", "USE", 46, Vector2(-128, -420), Color("#9FE3A8"))
	_add_button("pause", "≡", 32, Vector2(0, 0), Color("#F4EEDC"), true)
	_add_cycle_button()
	get_viewport().size_changed.connect(_layout)
	_layout()


func _compute_safe_margins() -> void:
	var screen := Vector2(DisplayServer.screen_get_size())
	var safe := DisplayServer.get_display_safe_area()
	var vp := get_viewport().get_visible_rect().size
	if screen.x <= 0 or safe.size.x <= 0:
		return
	var sx := vp.x / screen.x
	_margin_l = safe.position.x * sx
	_margin_r = (screen.x - safe.end.x) * sx


func _add_button(action: String, text: String, radius: int, offset: Vector2, tint: Color, top_left := false) -> TouchScreenButton:
	var b := TouchScreenButton.new()
	b.texture_normal = _circle(radius, Color(0.06, 0.09, 0.16, 0.55), Color(tint, 0.85), 4.0)
	b.texture_pressed = _circle(radius, Color(tint, 0.55), Color(1, 1, 1, 0.95), 4.0)
	b.action = action
	b.set_meta("radius", radius)
	b.set_meta("offset", offset)
	b.set_meta("top_left", top_left)
	var shape := CircleShape2D.new()
	shape.radius = radius
	b.shape = shape
	b.shape_centered = true
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", int(radius * (0.55 if text.length() > 1 else 0.9)))
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.95))
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("outline_size", 4)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.size = Vector2(radius * 2, radius * 2)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(l)
	add_child(b)
	_buttons.append(b)
	if action == "skill":
		_skill_ring = TextureRect.new()
		_skill_ring.texture = _circle(radius + 8, Color(0, 0, 0, 0), Color(1, 1, 1, 0.9), 5.0)
		_skill_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_skill_ring.position = Vector2(-8, -8)
		b.add_child(_skill_ring)
	return b


## Cycles to the next unlocked element (keyboard uses 1-6).
func _add_cycle_button() -> void:
	var b := _add_button("", "◆", 32, Vector2(-392, -190), Color("#B46BFF"))
	b.pressed.connect(func():
		var list: Array = Game.unlocked_elements
		if list.size() > 1:
			var i := list.find(Game.current_element)
			Game.set_element(list[(i + 1) % list.size()])
			Sfx.play("ui_click", 1.2))


func _layout() -> void:
	_compute_safe_margins()
	var vp := get_viewport().get_visible_rect().size
	for b in _buttons:
		var r: int = b.get_meta("radius")
		var off: Vector2 = b.get_meta("offset")
		if b.get_meta("top_left"):
			b.position = Vector2(_margin_l + 330, 22)
		else:
			b.position = Vector2(vp.x - _margin_r + off.x - r, vp.y + off.y - r)


func _over_button(p: Vector2) -> bool:
	for b in _buttons:
		if b.visible:
			var r: float = b.get_meta("radius")
			if p.distance_to(b.position + Vector2(r, r)) <= r + 10.0:
				return true
	return false


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		var vp := get_viewport().get_visible_rect().size
		if t.pressed:
			if _over_button(t.position) or Game.is_ui_open():
				return
			if t.position.x < vp.x * 0.45 and _stick_index < 0:
				_stick_index = t.index
				_stick_origin = t.position
				_stick = Vector2.ZERO
				_base.visible = true
				_knob.visible = true
				_base.position = _stick_origin - Vector2(STICK_R, STICK_R)
				_knob.position = _stick_origin - Vector2(38, 38)
			elif t.position.x >= vp.x * 0.45 and _look_index < 0:
				_look_index = t.index
				_look_last = t.position
		else:
			if t.index == _stick_index:
				_stick_index = -1
				_stick = Vector2.ZERO
				_base.visible = false
				_knob.visible = false
				_apply_stick()
			elif t.index == _look_index:
				_look_index = -1
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if d.index == _stick_index:
			var v := d.position - _stick_origin
			_sprint = v.length() > STICK_R * 1.3
			_stick = v.limit_length(STICK_R) / STICK_R
			_knob.position = _stick_origin + _stick * STICK_R - Vector2(38, 38)
			_apply_stick()
		elif d.index == _look_index:
			var player := get_tree().get_first_node_in_group("player")
			if player and player.get("rig") and not Game.is_ui_open():
				player.rig.add_look(d.position - _look_last)
			_look_last = d.position


func _apply_stick() -> void:
	_set_action("move_right", max(0.0, _stick.x))
	_set_action("move_left", max(0.0, -_stick.x))
	_set_action("move_back", max(0.0, _stick.y))
	_set_action("move_forward", max(0.0, -_stick.y))
	if _sprint and _stick.length() > 0.9:
		Input.action_press("sprint")
	else:
		Input.action_release("sprint")


func _set_action(action: String, strength: float) -> void:
	if strength > 0.05:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)


func _process(_d: float) -> void:
	var player := get_tree().get_first_node_in_group("player")
	var ui := Game.is_ui_open()
	# dialogue / menus own the screen: hide gameplay buttons so taps can't fight the UI
	for b in _buttons:
		if b != _interact:
			b.visible = not ui
	_interact.visible = not ui and player != null and player.get("interact_target") != null
	if ui and _stick_index >= 0:
		_stick_index = -1
		_stick = Vector2.ZERO
		_base.visible = false
		_knob.visible = false
		_apply_stick()
	if _skill_ring:
		_skill_ring.modulate = DB.element_color(Game.current_element)
	visible = not get_tree().paused
