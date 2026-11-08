class_name UITheme
extends RefCounted
## AETHERIA interface style: deep navy glass panels, brass trim, serif display type.

const BG := Color(0.06, 0.09, 0.16, 0.88)
const BG_SOFT := Color(0.08, 0.12, 0.2, 0.72)
const BRASS := Color("#E2B95B")
const AETHER := Color("#7FF5FF")
const TEXT := Color("#F4EEDC")
const MUTED := Color("#A9B4C8")

static var _theme: Theme
static var _display_font: Font
static var _body_font: Font


static func display_font() -> Font:
	if _display_font == null:
		var f := SystemFont.new()
		f.font_names = PackedStringArray(["Cinzel", "Georgia", "Palatino Linotype", "Cambria", "Times New Roman", "serif"])
		f.font_weight = 600
		_display_font = f
	return _display_font


static func body_font() -> Font:
	if _body_font == null:
		var f := SystemFont.new()
		f.font_names = PackedStringArray(["Segoe UI", "Noto Sans", "Helvetica", "Arial", "sans-serif"])
		_body_font = f
	return _body_font


static func panel(bg: Color = BG, border: Color = BRASS, radius: int = 10, border_w: int = 2) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(border_w)
	s.set_corner_radius_all(radius)
	s.set_content_margin_all(14)
	s.shadow_color = Color(0, 0, 0, 0.35)
	s.shadow_size = 6
	return s


static func get_theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = body_font()
	t.default_font_size = 18
	t.set_color("font_color", "Label", TEXT)
	t.set_stylebox("panel", "PanelContainer", panel())
	t.set_stylebox("panel", "Panel", panel())
	var normal := panel(Color(0.1, 0.15, 0.26, 0.92), Color(BRASS, 0.55), 8, 1)
	normal.set_content_margin_all(10)
	var hover := panel(Color(0.16, 0.24, 0.38, 0.96), BRASS, 8, 2)
	hover.set_content_margin_all(10)
	var pressed := panel(Color(0.22, 0.32, 0.46, 1.0), AETHER, 8, 2)
	pressed.set_content_margin_all(10)
	var disabled := panel(Color(0.08, 0.1, 0.16, 0.7), Color(0.4, 0.4, 0.45, 0.4), 8, 1)
	disabled.set_content_margin_all(10)
	for kind in ["Button", "OptionButton"]:
		t.set_stylebox("normal", kind, normal)
		t.set_stylebox("hover", kind, hover)
		t.set_stylebox("pressed", kind, pressed)
		t.set_stylebox("focus", kind, hover)
		t.set_stylebox("disabled", kind, disabled)
		t.set_color("font_color", kind, TEXT)
		t.set_color("font_hover_color", kind, Color.WHITE)
		t.set_color("font_disabled_color", kind, Color(0.6, 0.6, 0.65))
	var bar_bg := StyleBoxFlat.new()
	bar_bg.bg_color = Color(0, 0, 0, 0.5)
	bar_bg.set_corner_radius_all(4)
	t.set_stylebox("background", "ProgressBar", bar_bg)
	var bar_fill := StyleBoxFlat.new()
	bar_fill.bg_color = Color("#5FD38B")
	bar_fill.set_corner_radius_all(4)
	t.set_stylebox("fill", "ProgressBar", bar_fill)
	t.set_stylebox("slider", "HSlider", bar_bg)
	var grab := StyleBoxFlat.new()
	grab.bg_color = BRASS
	grab.set_corner_radius_all(4)
	t.set_stylebox("grabber_area", "HSlider", grab)
	t.set_stylebox("grabber_area_highlight", "HSlider", grab)
	t.set_stylebox("panel", "ItemList", panel(BG_SOFT, Color(BRASS, 0.4), 6, 1))
	t.set_stylebox("panel", "TabContainer", panel())
	_theme = t
	return t


static func title(text: String, size: int = 34, color: Color = BRASS) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", display_font())
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("outline_size", 4)
	return l


static func label(text: String, size: int = 18, color: Color = TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func button(text: String, cb: Callable, min_w: int = 240) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, 46)
	b.add_theme_font_override("font", display_font())
	b.add_theme_font_size_override("font_size", 20)
	b.pressed.connect(func():
		Sfx.play("ui_click")
		cb.call())
	b.mouse_entered.connect(func(): Sfx.play("ui_click", 1.6))
	return b


static func bar(color: Color, w: float = 260.0, h: float = 14.0) -> ProgressBar:
	var p := ProgressBar.new()
	p.custom_minimum_size = Vector2(w, h)
	p.show_percentage = false
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(4)
	p.add_theme_stylebox_override("fill", fill)
	return p
