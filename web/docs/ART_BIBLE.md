# AETHERIA — Art Bible (web)

## The bar
Professional anime open-world RPG quality. The user supplied reference shots in `refs/`, for craft level only:
`ref_town_aerial.jpg`, `ref_town_street_concept.jpg`, `ref_town_gate.jpg` (environment) and `ref_char_*.jpg` (characters).
Match their **level of finish**: detail density, material richness, silhouette quality, lighting and atmosphere.
Do NOT copy their content. Our world, buildings, symbols and characters are original (see "Identity").

What makes those references read as "AAA anime":
1. **Detail density at every scale.** Roofs have visible individual tiles, ridge caps, dormers and chimneys with caps.
   Walls have half-timber frames with braces, window frames with mullions, shutters, flower boxes and hanging ivy.
   Streets have cobbles, curbs, steps, drains, planters, barrels, crates, lanterns, banners and bunting across the street.
2. **Hand-painted textures** with soft value variation, never flat colour and never photographic noise.
3. **Clean cel lighting.** A bright warm sun, soft-edged toon terminator, cool blue-violet shadows (never grey or black),
   sky-tinted ambient, crisp contact shadows and subtle AO in crevices.
4. **Atmosphere.** Saturated blue sky with stylized cumulus (hard silhouettes, soft inner shading), aerial perspective
   that fades distance to light blue, gentle bloom on emissives, light shafts where it fits.
5. **Silhouette and composition.** Varied roof heights and angles, towers and spires breaking the skyline,
   landmarks visible from far away, foreground framing (trees, flags).
6. **Characters.** Layered anime hair (many clumps, highlight band, coloured inner streaks), big expressive eyes,
   clean face shading with no shadow acne, complex layered outfits (straps, buckles, trims, belts, gloves, ribbons, jewellery),
   a clear 2–3 colour palette plus an accent, crisp outlines and rim light.

## Identity (original)
* Region: Elyndra. Town: **Vael Harrow**, a hillside river town with an arched stone viaduct over the valley,
  half-timbered houses with terracotta roofs stepping down a hill, a hilltop **Concord Hall** keep, a fountain plaza
  with a **Choir crystal** (hexagonal cyan crystal) and windmills on the western hills.
* Distant landmark: **the Elyndra Core**, a colossal crystal spire with floating rings, on the eastern ridge.
* Motifs: hexagons, cyan Aether glow (#7FF5FF), brass and gold filigree, teal cloth, terracotta roofs.
  Banners carry our crest: a gold hexagon with a single crystal shard. No real-world or game logos.

## Palette
Sky #2F7BE0 → horizon #9FD2FF · grass #6CC24A / #9BD65B · roofs #C8552F–#E07A48 (vary per house) ·
plaster #F1E6D0 / #E8D8BC · timber #5E3D27 · stone #B9B2A5 / #8E96A2 · teal #2B9C9A · gold #E2B95B · Aether #7FF5FF.
Shadow tint: #5C6A9C (mix ~35%). Never pure black except outlines (#1A1420).

## Technique notes
* Toon ramp with a soft terminator (smoothstep width ~0.08), two to three value bands max on characters.
* Foliage: alpha-cutout painted leaf cards on branch skeletons, normals blended toward a sphere around the canopy centre.
* Use vertex colour or AO maps to darken crevices and building bases. Add colour variation per instance.
* Performance budget for `high` on a mid-range GPU: 60 fps at 1080p, about 1.5M triangles and 600 draw calls max.
  Use instancing and merging. `low` must stay above 30 fps on Intel UHD at 720p.
