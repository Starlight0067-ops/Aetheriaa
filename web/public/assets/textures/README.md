# AI-painted textures (generated with Figma AI for AETHERIA, processed by tools/process_textures.py)

Opaque (sRGB JPG, 1024²): roof_tiles, plaster, timber, cobblestone, stone_wall, grass, dirt_path, rock_cliff, bark, wood_planks.
- Organic ones (plaster, grass, dirt_path, rock_cliff, bark) tile seamlessly with RepeatWrapping.
- Patterned ones (stone_wall, wood_planks, roof_tiles, cobblestone, timber) are not perfectly seamless:
  use THREE.MirroredRepeatWrapping (or keep UVs inside one tile per face) to hide seams.

Cards (RGBA PNG, 1024², alpha cutout ~0.5, colour bled into transparent areas):
- leaves_broadleaf.png, leaves_pine.png, leaves_blossom.png: one foliage cluster centred.
- ivy.png: vines hanging from the top edge.
- flowers.png: 2x2 sheet. Top-left pink petunias, top-right white daisies, bottom-left yellow buttercups, bottom-right blue forget-me-nots.
