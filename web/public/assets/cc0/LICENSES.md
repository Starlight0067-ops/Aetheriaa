# Licencias de assets CC0

Todos los archivos de esta carpeta son CC0 1.0 (dominio público) o están equivalentemente dedicados al dominio público. No se incluye ningún asset CC-BY.

Atribución no requerida; se acredita igualmente.

## ground/ (texturas Poly Haven, 1k JPG)

| Archivo | Fuente URL | Licencia | Autor |
|---|---|---|---|
| ground/dirt_floor_diff_1k.jpg | https://polyhaven.com/a/dirt_floor | CC0 1.0 | eye-candy.xyz |
| ground/dirt_floor_nor_gl_1k.jpg | https://polyhaven.com/a/dirt_floor | CC0 1.0 | eye-candy.xyz |
| ground/dirt_floor_rough_1k.jpg | https://polyhaven.com/a/dirt_floor | CC0 1.0 | eye-candy.xyz |
| ground/aerial_grass_rock_diff_1k.jpg | https://polyhaven.com/a/aerial_grass_rock | CC0 1.0 | Rob Tuytel |
| ground/aerial_grass_rock_nor_gl_1k.jpg | https://polyhaven.com/a/aerial_grass_rock | CC0 1.0 | Rob Tuytel |
| ground/aerial_grass_rock_rough_1k.jpg | https://polyhaven.com/a/aerial_grass_rock | CC0 1.0 | Rob Tuytel |
| ground/cobblestone_floor_08_diff_1k.jpg | https://polyhaven.com/a/cobblestone_floor_08 | CC0 1.0 | Rob Tuytel |
| ground/cobblestone_floor_08_nor_gl_1k.jpg | https://polyhaven.com/a/cobblestone_floor_08 | CC0 1.0 | Rob Tuytel |
| ground/cobblestone_floor_08_rough_1k.jpg | https://polyhaven.com/a/cobblestone_floor_08 | CC0 1.0 | Rob Tuytel |

Descarga desde https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<id>/ (URLs obtenidas de https://api.polyhaven.com/files/<id>). La política de licencia de Poly Haven es CC0 para todo el sitio. La API `/info` no expone un campo de licencia por activo, así que esta licencia se basa en esa política del sitio.

## hdri/ (cielo HDR Poly Haven, 1k .hdr)

| Archivo | Fuente URL | Licencia | Autor |
|---|---|---|---|
| hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky (descarga: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr, URL obtenida de api.polyhaven.com/files) | CC0 1.0 | Greg Zaal (original), Jarod Guest (edición del cielo) |

Uso: iluminación basada en imagen (difusa + especular) en los presets `high` / `ultra` (`src/render/environment.js`). Los presets `low` / `medium` no lo descargan.

## buildings/ (modelos glb low-poly)

Fuente común: paquete npm `@netforge/asset-library-files@0.2.0`, tarball https://registry.npmjs.org/@netforge/asset-library-files/-/asset-library-files-0.2.0.tgz, carpeta `library/lowpoly/`. Su NOTICE indica que los archivos son copias optimizadas de arte de terceros en CC0 1.0 (Quaternius y Kenney). El wrapper npm está bajo MIT, pero el contenido de `library/` es CC0. Los archivos individuales no indican pack de origen, así que la columna Autor da el autor del conjunto.

| Archivo | Fuente URL | Licencia | Autor |
|---|---|---|---|
| buildings/building_a.glb | https://quaternius.com (vía npm @netforge/asset-library-files) | CC0 1.0 | Quaternius |
| buildings/building_b.glb | idem | CC0 1.0 | Quaternius |
| buildings/building_c.glb | idem | CC0 1.0 | Quaternius |
| buildings/building_d.glb | idem | CC0 1.0 | Quaternius |
| buildings/building_e.glb | idem | CC0 1.0 | Quaternius |
| buildings/building_f.glb | idem | CC0 1.0 | Quaternius |
| buildings/building_g.glb | idem | CC0 1.0 | Quaternius |
| buildings/building_h.glb | idem | CC0 1.0 | Quaternius |
| buildings/fence.glb | idem | CC0 1.0 | Quaternius |
| buildings/barrel.glb | idem | CC0 1.0 | Quaternius |
| buildings/barrels.glb | idem | CC0 1.0 | Quaternius |
| buildings/crate.glb | idem | CC0 1.0 | Quaternius |
| buildings/chest.glb | idem | CC0 1.0 | Quaternius |
| buildings/campfire.glb | idem | CC0 1.0 | Quaternius |
| buildings/tent.glb | idem | CC0 1.0 | Quaternius |
| buildings/stump.glb | idem | CC0 1.0 | Quaternius |
| buildings/column.glb | idem | CC0 1.0 | Quaternius |

## characters/ (modelos glb rigged con animaciones)

Misma fuente npm que buildings/ (`library/lowpoly/`).

| Archivo | Fuente URL | Licencia | Autor |
|---|---|---|---|
| characters/adventurer.glb | https://quaternius.com (vía npm @netforge/asset-library-files) | CC0 1.0 | Quaternius |
| characters/hooded_adventurer.glb | idem | CC0 1.0 | Quaternius |
| characters/rogue.glb | idem | CC0 1.0 | Quaternius |
| characters/worker.glb | idem | CC0 1.0 | Quaternius |
| characters/mini_male_a.glb | https://kenney.nl/assets/mini-characters (vía npm @netforge/asset-library-files) | CC0 1.0 | Kenney |
| characters/mini_female_a.glb | https://kenney.nl/assets/mini-characters (vía npm @netforge/asset-library-files) | CC0 1.0 | Kenney |

Los archivos de personajes de Quaternius tienen 24 animaciones, incluidas Idle y Run/Walk. Los mini personajes de Kenney tienen 32 animaciones, incluidas idle y walk. Los mini personajes se atribuyen a Kenney por ser el pack CC0 de personajes mini que lista el NOTICE; el archivo no indica pack de origen, así que esa asignación es probable pero no confirmada por archivo.

## Verificación

- Todos los `.glb` empiezan por la cabecera `glTF`.
- Las URLs de Poly Haven se obtuvieron de su API. Las URLs de Quaternius y Kenney se toman del NOTICE del paquete npm y de las páginas de pack de Quaternius (`quaternius.com/packs/*`, que indican "License CC0").
- Los packs de Quaternius se descargan desde itch.io (`quaternius.itch.io`), que no está en la lista de hosts permitidos, así que no se usaron directamente.

## Uso en el prototipo web

- `ground/`: los difusos sustituyen a las texturas pintadas de hierba, tierra y adoquín del terreno (`src/world/nature/textures.js`); el adoquín (difuso + normal) se usa también en calles y plaza (`src/world/town/materials.js`). Los mapas de rugosidad no se usan: los materiales del juego son toon y no tienen canal de rugosidad. `?ground=old` vuelve a las texturas anteriores.
- `characters/`: jugador y NPCs (`src/characters/cc0.js`), con `AnimationMixer` (idle / walk / run). `?chars=vrm` vuelve a los personajes anteriores.
- `buildings/building_*.glb`: son bloques de estilo urbano moderno (tejado plano), que no encajan en la villa medieval; solo se usan con `?buildings=blocks` (`src/world/town/cc0buildings.js`). Las casas por defecto se montan con el kit CC0 "Medieval Village MegaKit" de Quaternius que ya estaba en `public/assets/free/medieval/` (licencia en `LICENSE_License_Standard.txt` de esa carpeta). `?buildings=kit` vuelve a las casas generadas.
- `buildings/` (fence, barrel(s), crate, chest, campfire, tent, stump, column): todavía sin usar.
