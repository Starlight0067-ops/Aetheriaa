class_name HUD
extends CanvasLayer
## Gameplay HUD: vitals, elements + cooldowns, quest tracker, minimap,
## interaction prompt, notifications, banners, boss bar, lock-on marker.

var player: Player
var _hp: ProgressBar
var _stam: ProgressBar
var _xp: ProgressBar
var _lvl: Label
var _hp_text: Label
var _quest_title: Label
var _quest_step: Label
var _prompt: PanelContainer
var _prompt_label: Label
var _notes: VBoxContainer
var _banner: VBoxContainer
var _banner_title: Label
var _banner_sub: Label
var _boss: VBoxContainer
var _boss_bar: ProgressBar
var _boss_name: Label
var _element_slots: Dictionary = {}
var _lock_marker: Label
var _fps: Label
var _minimap: MapView
var _banner_tween: Tween


func _ready() -> void:
	layer = 5
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UITheme.get_theme()
	add_child(root)

	# --- vitals (top-left) ---
	var vit := PanelContainer.new()
	vit.add_theme_stylebox_override("panel", UITheme.panel(UITheme.BG_SOFT, Color(UITheme.BRASS, 0.5), 10, 1))
	vit.position = Vector2(16, 16)
	root.add_child(vit)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 4)
	vit.add_child(vb)
	var top := HBoxContainer.new()
	vb.add_child(top)
	top.add_child(UITheme.title(Game.player_name, 22, UITheme.TEXT))
	_lvl = UITheme.title("Lv 1", 18, UITheme.BRASS)
	top.add_child(_lvl)
	_hp = UITheme.bar(Color("#5FD38B"), 260, 16)
	vb.add_child(_hp)
	_hp_text = UITheme.label("", 13, UITheme.MUTED)
	vb.add_child(_hp_text)
	_stam = UITheme.bar(Color("#E2B95B"), 200, 8)
	vb.add_child(_stam)
	_xp = UITheme.bar(Color("#7FA8FF"), 260, 5)
	vb.add_child(_xp)

	# --- quest tracker (top-right, under minimap) ---
	_minimap = MapView.new()
	_minimap.minimap = true
	_minimap.custom_minimum_size = Vector2(190, 190)
	_minimap.size = Vector2(190, 190)
	_minimap.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_minimap.position = Vector2(-206, 16)
	root.add_child(_minimap)
	var qp := VBoxContainer.new()
	qp.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	qp.position = Vector2(-336, 216)
	qp.custom_minimum_size = Vector2(320, 0)
	qp.alignment = BoxContainer.ALIGNMENT_END
	root.add_child(qp)
	_quest_title = UITheme.title("", 20, UITheme.BRASS)
	_quest_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_quest_step = UITheme.label("", 16, UITheme.TEXT)
	_quest_step.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_quest_step.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	_quest_step.add_theme_constant_override("outline_size", 4)
	qp.add_child(_quest_title)
	qp.add_child(_quest_step)

	# --- elements (bottom-right) ---
	var eb := HBoxContainer.new()
	eb.anchor_left = 1.0
	eb.anchor_right = 1.0
	eb.anchor_top = 1.0
	eb.anchor_bottom = 1.0
	eb.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	eb.grow_vertical = Control.GROW_DIRECTION_BEGIN
	eb.offset_right = -16
	eb.offset_bottom = -34
	eb.add_theme_constant_override("separation", 8)
	root.add_child(eb)
	for i in DB.ELEMENT_ORDER.size():
		var el: String = DB.ELEMENT_ORDER[i]
		var slot := PanelContainer.new()
		slot.custom_minimum_size = Vector2(56, 70)
		var sv := VBoxContainer.new()
		sv.alignment = BoxContainer.ALIGNMENT_CENTER
		slot.add_child(sv)
		var name_l := UITheme.label(DB.elements[el].name, 12, DB.element_color(el))
		name_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var key_l := UITheme.label(str(i + 1), 18, UITheme.TEXT)
		key_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var cd := UITheme.bar(DB.element_color(el), 44, 5)
		sv.add_child(key_l)
		sv.add_child(name_l)
		sv.add_child(cd)
		eb.add_child(slot)
		_element_slots[el] = {"panel": slot, "cd": cd, "key": key_l}
	var hint := UITheme.label("[E] Skill   [LMB] Attack   [Ctrl/RMB] Dodge   [Tab] Lock-on   [H] Heal", 13, UITheme.MUTED)
	hint.anchor_left = 1.0
	hint.anchor_right = 1.0
	hint.anchor_top = 1.0
	hint.anchor_bottom = 1.0
	hint.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	hint.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hint.offset_right = -16
	hint.offset_bottom = -8
	hint.autowrap_mode = TextServer.AUTOWRAP_OFF
	root.add_child(hint)

	# --- interaction prompt (bottom-center) ---
	_prompt = PanelContainer.new()
	_prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_prompt.position = Vector2(-150, -170)
	_prompt.custom_minimum_size = Vector2(300, 0)
	_prompt_label = UITheme.label("", 18)
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.add_child(_prompt_label)
	_prompt.visible = false
	root.add_child(_prompt)

	# --- notifications (left-middle) ---
	_notes = VBoxContainer.new()
	_notes.position = Vector2(16, 200)
	_notes.custom_minimum_size = Vector2(340, 0)
	root.add_child(_notes)

	# --- banner (center) ---
	_banner = VBoxContainer.new()
	_banner.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_banner.position = Vector2(-400, 120)
	_banner.custom_minimum_size = Vector2(800, 0)
	_banner_title = UITheme.title("", 42, UITheme.TEXT)
	_banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_sub = UITheme.label("", 20, UITheme.BRASS)
	_banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_child(_banner_title)
	_banner.add_child(_banner_sub)
	_banner.modulate.a = 0.0
	root.add_child(_banner)

	# --- boss bar ---
	_boss = VBoxContainer.new()
	_boss.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_boss.position = Vector2(-300, 24)
	_boss.custom_minimum_size = Vector2(600, 0)
	_boss_name = UITheme.title("", 22, UITheme.TEXT)
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_bar = UITheme.bar(Color("#FF6A5A"), 600, 14)
	_boss.add_child(_boss_name)
	_boss.add_child(_boss_bar)
	_boss.visible = false
	root.add_child(_boss)

	_lock_marker = UITheme.title("◆", 26, Color("#FF6A5A"))
	_lock_marker.visible = false
	root.add_child(_lock_marker)
	_fps = UITheme.label("", 14, UITheme.MUTED)
	_fps.position = Vector2(20, 150)
	root.add_child(_fps)

	Game.notified.connect(_on_note)
	Game.banner.connect(_on_banner)
	Game.boss_bar.connect(_on_boss)


func _process(_d: float) -> void:
	if player == null:
		player = get_tree().get_first_node_in_group("player") as Player
		return
	_hp.max_value = Game.max_hp()
	_hp.value = Game.hp
	_hp_text.text = "%d / %d HP" % [int(Game.hp), int(Game.max_hp())]
	_stam.max_value = Game.max_stamina
	_stam.value = Game.stamina
	_xp.max_value = Game.xp_to_next()
	_xp.value = Game.xp
	_lvl.text = "  Lv %d" % Game.level
	var q := Quests.tracked_quest()
	if q == "":
		_quest_title.text = ""
		_quest_step.text = "Explore Elyndra"
	else:
		var step := Quests.current_step(q)
		_quest_title.text = DB.quests[q].title
		var t: String = "◆ " + step.get("text", "")
		if int(step.get("count", 1)) > 1:
			t += "  (%d/%d)" % [Quests.active[q].progress, int(step.count)]
		elif step.get("type") == "collect":
			t += "  (%d/%d)" % [min(Inventory.count(step.target), int(step.get("count", 1))), int(step.get("count", 1))]
		_quest_step.text = t
	for el in _element_slots:
		var s: Dictionary = _element_slots[el]
		var unlocked: bool = el in Game.unlocked_elements
		var panel: PanelContainer = s.panel
		panel.modulate = Color(1, 1, 1, 1.0 if unlocked else 0.3)
		var border := DB.element_color(el) if el == Game.current_element else Color(UITheme.BRASS, 0.3)
		panel.add_theme_stylebox_override("panel", UITheme.panel(UITheme.BG_SOFT, border, 8, 3 if el == Game.current_element else 1))
		var cd: ProgressBar = s.cd
		var total: float = DB.elements[el].skill.cooldown
		cd.max_value = total
		cd.value = total - player.cooldowns.get(el, 0.0)
	if player.interact_target and not Game.is_ui_open():
		_prompt.visible = true
		_prompt_label.text = "[F]  " + player.interact_target.get_prompt()
	else:
		_prompt.visible = false
	var lt := player.lock_target
	if lt and is_instance_valid(lt):
		var cam := get_viewport().get_camera_3d()
		var wp := lt.global_position + Vector3(0, 2.4 * (2.2 if lt is BossWarden else 1.0), 0)
		if cam and not cam.is_position_behind(wp):
			_lock_marker.visible = true
			_lock_marker.position = cam.unproject_position(wp) - Vector2(10, 16)
		else:
			_lock_marker.visible = false
	else:
		_lock_marker.visible = false
	_fps.visible = Settings.data.show_fps
	if _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()


func _on_note(text: String, kind: String) -> void:
	var colors := {"item": Color("#FFE08A"), "quest": Color("#7FF5FF"), "save": Color("#9FE3A8"),
		"xp": Color("#9FB8FF"), "error": Color("#FF6A5A"), "level": Color("#E2B95B")}
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", UITheme.panel(UITheme.BG_SOFT, Color(colors.get(kind, UITheme.BRASS), 0.6), 6, 1))
	var l := UITheme.label(text, 16, colors.get(kind, UITheme.TEXT))
	p.add_child(l)
	_notes.add_child(p)
	if _notes.get_child_count() > 6:
		_notes.get_child(0).queue_free()
	var tw := p.create_tween()
	tw.tween_interval(3.2)
	tw.tween_property(p, "modulate:a", 0.0, 0.6)
	tw.tween_callback(p.queue_free)


func _on_banner(title: String, subtitle: String) -> void:
	_banner_title.text = title
	_banner_sub.text = subtitle
	if _banner_tween:
		_banner_tween.kill()
	_banner_tween = create_tween()
	_banner.modulate.a = 0.0
	_banner_tween.tween_property(_banner, "modulate:a", 1.0, 0.35)
	_banner_tween.tween_interval(2.6)
	_banner_tween.tween_property(_banner, "modulate:a", 0.0, 0.8)


func _on_boss(boss_name: String, ratio: float, show: bool) -> void:
	_boss.visible = show
	_boss_name.text = boss_name
	_boss_bar.value = ratio * 100.0
