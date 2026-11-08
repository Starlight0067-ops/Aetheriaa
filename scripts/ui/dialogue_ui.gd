class_name DialogueUI
extends CanvasLayer
## Reusable dialogue box: speaker name + portrait, typewriter text, choices,
## conditions/actions from data, and a short history log.

var _root: Control
var _portrait: Panel
var _portrait_letter: Label
var _name: Label
var _title: Label
var _text: RichTextLabel
var _choices: VBoxContainer
var _hint: Label
var _nodes: Dictionary = {}
var _node: Dictionary = {}
var _npc_node: Node
var _npc_id := ""
var _typing := 0.0
var _active := false
var history: Array = []
var _opened_frame := -1


func _ready() -> void:
	layer = 8
	add_to_group("dialogue_ui")
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.theme = UITheme.get_theme()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.25)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(shade)
	var box := PanelContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	box.custom_minimum_size = Vector2(900, 200)
	box.position = Vector2(-450, -230)
	_root.add_child(box)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 18)
	box.add_child(hb)
	_portrait = Panel.new()
	_portrait.custom_minimum_size = Vector2(120, 120)
	_portrait.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	hb.add_child(_portrait)
	_portrait_letter = UITheme.title("", 64, Color.WHITE)
	_portrait_letter.set_anchors_preset(Control.PRESET_FULL_RECT)
	_portrait_letter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_portrait_letter.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_portrait.add_child(_portrait_letter)
	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(vb)
	var nb := HBoxContainer.new()
	vb.add_child(nb)
	_name = UITheme.title("", 26)
	_title = UITheme.label("", 15, UITheme.MUTED)
	_title.size_flags_vertical = Control.SIZE_SHRINK_END
	nb.add_child(_name)
	nb.add_child(_title)
	_text = RichTextLabel.new()
	_text.fit_content = true
	_text.bbcode_enabled = false
	_text.custom_minimum_size = Vector2(700, 70)
	_text.add_theme_font_size_override("normal_font_size", 20)
	_text.add_theme_color_override("default_color", UITheme.TEXT)
	vb.add_child(_text)
	_choices = VBoxContainer.new()
	vb.add_child(_choices)
	_hint = UITheme.label("[F / Space / Click] Continue", 13, UITheme.MUTED)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	vb.add_child(_hint)
	_root.visible = false


func start_npc(npc_id: String, npc_node: Node = null) -> void:
	var npc: Dictionary = DB.npcs.get(npc_id, {})
	var chosen := ""
	for entry in npc.get("dialogues", []):
		if Game.check_condition(entry.get("condition", {})):
			chosen = entry.id
			break
	if chosen == "" or not DB.dialogues.has(chosen):
		return
	_npc_id = npc_id
	_npc_node = npc_node
	# talking to someone counts for "talk" objectives (fired at start, before actions)
	Quests.notify_event("talk", npc_id)
	_nodes = DB.dialogues[chosen].nodes
	_open()
	_show(_nodes.get("start", {}))


## One-off text (signs, engravings, locked mechanisms).
func show_text(speaker: String, text: String) -> void:
	_npc_id = ""
	_npc_node = null
	_nodes = {"start": {"speaker": "_custom", "custom_name": speaker, "text": text, "end": true}}
	_open()
	_show(_nodes.start)


func is_active() -> bool:
	return _active


func _open() -> void:
	_active = true
	_opened_frame = Engine.get_process_frames()
	_root.visible = true
	Game.open_ui("dialogue")


func _close() -> void:
	_active = false
	_root.visible = false
	Game.close_ui("dialogue")
	if _npc_node and _npc_node.has_method("end_talk"):
		_npc_node.end_talk()
	_npc_node = null


func _show(node: Dictionary) -> void:
	_node = node
	var speaker: String = node.get("speaker", "narrator")
	var display := ""
	var title := ""
	var color := Color("#556070")
	match speaker:
		"narrator":
			display = ""
		"_custom":
			display = node.get("custom_name", "")
			color = Color("#76839A")
		_:
			var npc: Dictionary = DB.npcs.get(speaker, {})
			display = npc.get("name", speaker)
			title = npc.get("title", "")
			color = Color(npc.get("color", "#76839A"))
	_name.text = display
	_title.text = ("   " + title) if title != "" else ""
	_portrait.visible = display != ""
	var sb := UITheme.panel(color.darkened(0.35), color.lightened(0.3), 12, 3)
	_portrait.add_theme_stylebox_override("panel", sb)
	_portrait_letter.text = display.substr(0, 1)
	_text.text = node.get("text", "")
	_text.visible_ratio = 0.0
	_typing = 0.0
	if speaker == "narrator":
		_text.add_theme_color_override("default_color", Color("#BFE9FF"))
	else:
		_text.add_theme_color_override("default_color", UITheme.TEXT)
	history.append(("%s: " % display if display != "" else "") + node.get("text", ""))
	if history.size() > 40:
		history.pop_front()
	for a in node.get("actions", []):
		_run_action(a)
	for c in _choices.get_children():
		c.queue_free()
	_hint.visible = not node.has("choices")


func _show_choices() -> void:
	if not _node.has("choices") or _choices.get_child_count() > 0:
		return
	for ch in _node.choices:
		if not Game.check_condition(ch.get("condition", {})):
			continue
		var b := UITheme.button("›  " + ch.text, func(): _pick(ch), 600)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		_choices.add_child(b)
	if _choices.get_child_count() > 0:
		(_choices.get_child(0) as Button).grab_focus()


func _pick(choice: Dictionary) -> void:
	history.append("> " + choice.text)
	for a in choice.get("actions", []):
		_run_action(a)
	_goto(choice.get("next", ""))


func _goto(next_id: String) -> void:
	if next_id == "" or not _nodes.has(next_id):
		_close()
	else:
		_show(_nodes[next_id])


func _advance() -> void:
	if _text.visible_ratio < 1.0:
		_text.visible_ratio = 1.0
		_show_choices()
		return
	if _node.has("choices"):
		return
	if _node.get("end", false):
		_close()
	else:
		_goto(_node.get("next", ""))


func _run_action(a: Dictionary) -> void:
	for key in a:
		var v = a[key]
		match key:
			"start_quest": Quests.start(v)
			"flag": Game.set_flag(v)
			"unlock_element": Game.unlock_element(v)
			"event":
				var p: PackedStringArray = String(v).split(":")
				Quests.notify_event(p[0], p[1])
			"give_item":
				var p: PackedStringArray = String(v).split(":")
				Inventory.add(p[0], int(p[1]) if p.size() > 1 else 1)
			"take_item":
				var p: PackedStringArray = String(v).split(":")
				Inventory.remove(p[0], int(p[1]) if p.size() > 1 else 1)


func _process(delta: float) -> void:
	if not _active:
		return
	if _text.visible_ratio < 1.0:
		var n: float = max(1.0, _text.get_total_character_count())
		_typing += delta * 55.0
		_text.visible_ratio = min(1.0, _typing / n)
		if _text.visible_ratio >= 1.0:
			_show_choices()


func _unhandled_input(event: InputEvent) -> void:
	if not _active or Engine.get_process_frames() == _opened_frame:
		return
	if event.is_action_pressed("interact") or event.is_action_pressed("jump") or event.is_action_pressed("attack"):
		get_viewport().set_input_as_handled()
		_advance()
	elif event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		_close()
