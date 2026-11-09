class_name ElyndraLayout
extends RefCounted
## Authored geography of Elyndra. The terrain is an analytic height function
## shaped by hand-placed features (river, lake, ridge, plateaus, flattened
## settlement pads), so the world is designed rather than random.
## Axes: +X east, -Z north. Units: metres.

const HALF := 120.0           # world spans -120..120
const STEP := 2.0             # terrain grid spacing
const WATER_Y := 1.0

const TOWN_CENTER := Vector2(6, 0)
const PLAZA := Vector2(10, 0)
const LAKE := Vector2(-40, -75)
const LAKE_R := 22.0
const RUINS := Vector2(74, -20)
const ARENA := Vector2(80, 32)
const CORE := Vector2(90, -48)
const OVERLOOK := Vector2(-82, -22)

## Hollow Sanctum interior: a roofed Choir temple on the path to the arena.
const SANCTUM := Vector2(80, 3)
const SANCTUM_FLOOR := 12.0
const SANCTUM_Z0 := -10.5
const SANCTUM_Z1 := 16.5

## Named roads (polylines). Used for terrain tint and to keep props off paths.
const ROADS := {
	"forest_road": [Vector2(-58, 84), Vector2(-50, 62), Vector2(-38, 44), Vector2(-28, 26), Vector2(-22, 10), Vector2(-16, 0)],
	"main_street": [Vector2(-28, 0), Vector2(-4, 0), Vector2(10, 0), Vector2(36, -2)],
	"east_road":   [Vector2(36, -2), Vector2(48, -8), Vector2(60, -15), Vector2(70, -19)],
	"lake_road":   [Vector2(-22, -4), Vector2(-26, -24), Vector2(-30, -42), Vector2(-36, -52)],
	"sanctum_path":[Vector2(76, -12), Vector2(78, 6), Vector2(80, 20)],
	"overlook_path":[Vector2(-26, -24), Vector2(-50, -26), Vector2(-70, -24), Vector2(-80, -22)],
}

## (center, radius, target height) pads.
const PADS := [
	[TOWN_CENTER, 36.0, 2.6],
	[RUINS, 18.0, 10.0],
	[ARENA, 17.0, 10.0],
	[CORE, 10.0, 12.0],
	[OVERLOOK, 7.0, 12.0],
]

## (center, radius, height) hills.
const HILLS := [
	[Vector2(-82, -22), 22.0, 9.0],
	[Vector2(48, 46), 18.0, 5.0],
	[Vector2(-90, 60), 24.0, 7.0],
	[Vector2(20, -60), 20.0, 5.0],
	[Vector2(-5, 70), 16.0, 3.0],
]


static func river_x(z: float) -> float:
	return -10.0 + 6.0 * sin(z * 0.03)


static func smoothstep(e0: float, e1: float, x: float) -> float:
	var t: float = clamp((x - e0) / (e1 - e0), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


static func height(x: float, z: float) -> float:
	var h := 3.0 + 1.4 * sin(x * 0.045) * cos(z * 0.04) + 0.7 * sin(x * 0.11 + z * 0.07) + 0.35 * sin(z * 0.17 - x * 0.05)
	for hill in HILLS:
		var d := Vector2(x, z).distance_to(hill[0])
		h += hill[2] * (1.0 - smoothstep(0.0, hill[1], d))
	# eastern ridge
	h += 8.0 * smoothstep(40.0, 66.0, x) * (1.0 - smoothstep(55.0, 80.0, z))
	# northern plateau above Silverfall
	h += 13.0 * smoothstep(-92.0, -100.0, z)
	# mountain rim
	var edge: float = max(abs(x), abs(z))
	if edge > 96.0:
		h += pow(edge - 96.0, 1.35) * 0.9
	# settlement pads
	for pad in PADS:
		var d := Vector2(x, z).distance_to(pad[0])
		var w := 1.0 - smoothstep(pad[1] * 0.75, pad[1], d)
		h = lerp(h, float(pad[2]), w)
	# lake basin
	var ld := Vector2(x, z).distance_to(LAKE)
	h = lerp(h, -1.5, 1.0 - smoothstep(LAKE_R * 0.6, LAKE_R + 4.0, ld))
	# river channel (lake -> south edge)
	if z > -60.0:
		var rd: float = abs(x - river_x(z))
		var depth := 1.0 - smoothstep(3.0, 7.5, rd)
		depth *= smoothstep(-62.0, -52.0, z)
		h = lerp(h, -0.6, depth)
	return h


static func dist_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var t: float = clamp((p - a).dot(ab) / max(ab.length_squared(), 0.0001), 0.0, 1.0)
	return p.distance_to(a + ab * t)


static func road_distance(x: float, z: float) -> float:
	var p := Vector2(x, z)
	var best := 9999.0
	for key in ROADS:
		var pts: Array = ROADS[key]
		for i in pts.size() - 1:
			best = min(best, dist_to_segment(p, pts[i], pts[i + 1]))
	return best


static func is_water(x: float, z: float) -> bool:
	return height(x, z) < WATER_Y + 0.2


## True where props (trees, rocks) must not be placed.
static func is_blocked(x: float, z: float) -> bool:
	if road_distance(x, z) < 3.5:
		return true
	if is_water(x, z) or abs(x - river_x(z)) < 8.0 and z > -60.0:
		return true
	if Vector2(x, z).distance_to(TOWN_CENTER) < 38.0:
		return true
	for pad in PADS:
		if Vector2(x, z).distance_to(pad[0]) < pad[1]:
			return true
	return false


static func ground_color(x: float, z: float, h: float, slope: float) -> Color:
	var n := sin(x * 0.31) * cos(z * 0.27) * 0.5 + sin(x * 0.07 + z * 0.11) * 0.5
	var grass := Color("#6FBF5A").lerp(Color("#4C9A48"), 0.5 + 0.5 * n)
	var c := grass
	# meadows south of town are sunlit and flowery
	if z > 15.0 and z < 55.0 and x > -20.0 and x < 40.0:
		c = c.lerp(Color("#8CCB5E"), 0.5)
	# forest floor darker
	if Vector2(x, z).distance_to(Vector2(-58, 52)) < 40.0:
		c = c.lerp(Color("#3F7D3E"), 0.55)
	if h < WATER_Y + 0.9:
		c = c.lerp(Color("#D9C99A"), 0.8)
	if slope > 0.55 or h > 22.0:
		c = c.lerp(Color("#8E8A84"), clamp((slope - 0.55) * 3.0 + (h - 22.0) * 0.1, 0.0, 1.0))
	if h > 30.0:
		c = c.lerp(Color("#EEF3F7"), clamp((h - 30.0) * 0.1, 0.0, 0.85))
	var rd := road_distance(x, z)
	if rd < 3.2:
		c = c.lerp(Color("#B89A6A"), 1.0 - smoothstep(1.8, 3.2, rd))
	if Vector2(x, z).distance_to(TOWN_CENTER) < 33.0 and rd > 3.0:
		c = c.lerp(Color("#A9B36A"), 0.25)
	if Vector2(x, z).distance_to(PLAZA) < 10.0:
		c = Color("#CDBB98").lerp(Color("#BFAE8B"), 0.5 + 0.5 * n)
	for p in [RUINS, ARENA]:
		if Vector2(x, z).distance_to(p) < 14.0:
			c = Color("#9AA7B5").lerp(Color("#8592A0"), 0.5 + 0.5 * n)
	return c
