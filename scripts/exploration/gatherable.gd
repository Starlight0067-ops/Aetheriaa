class_name Gatherable
extends Interactable
## Harvestable resource node (Sunpetal, Riverstone, Glowcap).

var item := "sunpetal"
var amount := 1


static func create(node_id: String, item_id: String, n: int = 1) -> Gatherable:
	var g := Gatherable.new()
	g.id = node_id
	g.item = item_id
	g.amount = n
	g.prompt = "Gather " + DB.item_name(item_id)
	g.interact_radius = 2.0
	return g


func _ready() -> void:
	super()
	if Game.opened.has(id):
		queue_free()
		return
	var k := MeshKit.new()
	var c := Color(DB.items.get(item, {}).get("color", "#ffffff"))
	match item:
		"sunpetal":
			k.cyl(Vector3(0, 0.25, 0), 0.02, 0.03, 0.5, Color("#4E9A45"), 4)
			for i in 6:
				var a := i * TAU / 6.0
				k.sphere(Vector3(cos(a) * 0.12, 0.52, sin(a) * 0.12), Vector3(0.14, 0.05, 0.14), c, 5)
			k.sphere(Vector3(0, 0.54, 0), Vector3(0.1, 0.08, 0.1), Color("#E07B2A"), 5)
		"riverstone":
			k.sphere(Vector3(0, 0.12, 0), Vector3(0.5, 0.25, 0.4), c, 6)
			k.sphere(Vector3(0.2, 0.1, 0.15), Vector3(0.3, 0.2, 0.25), c.darkened(0.15), 5)
		"glowcap":
			k.glow_color = c
			for i in 3:
				var p := Vector3((i - 1) * 0.15, 0, (i % 2) * 0.1)
				k.cyl(p + Vector3(0, 0.1, 0), 0.03, 0.04, 0.2, Color("#EDE6D6"), 5)
				k.sphere(p + Vector3(0, 0.22, 0), Vector3(0.18, 0.1, 0.18), c, 6, true)
	k.instance(self, "Visual")


func interact(_player: Node) -> void:
	Game.opened[id] = true
	Sfx.play("pickup")
	Inventory.add(item, amount)
	Effects.burst(get_parent(), global_position + Vector3(0, 0.4, 0), Color(DB.items[item].color), 10)
	queue_free()
