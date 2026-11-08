class_name SignPost
extends Interactable
## Readable sign. The text comes from the "signs" block in the dialogue data.

var text_key := ""
var style := "post"


static func create(key: String, s: String = "post") -> SignPost:
	var p := SignPost.new()
	p.text_key = key
	p.style = s
	p.prompt = "Read"
	return p


func _ready() -> void:
	super()
	var k := MeshKit.new()
	if style == "post":
		k.box(Vector3(0, 0.8, 0), Vector3(0.14, 1.6, 0.14), Color("#6B4630"))
		k.box(Vector3(0, 1.45, 0), Vector3(1.2, 0.5, 0.08), Color("#C9A57A"))
	else:
		k.glow_color = Color("#5FE3E0")
		k.box(Vector3(0, 0.9, 0), Vector3(1.4, 1.8, 0.35), Color("#9AA7B5"))
		k.box(Vector3(0, 1.0, -0.19), Vector3(1.0, 1.0, 0.03), Color("#5FE3E0"), 0.0, true)
	k.instance(self, "Sign")


func interact(_player: Node) -> void:
	var ui := get_tree().get_first_node_in_group("dialogue_ui")
	if ui:
		ui.show_text("Sign" if style == "post" else "Engraving", DB.signs.get(text_key, "..."))
