# AETHERIA — Elenco para VRoid Studio 2.16

Guías paso a paso para construir los 7 personajes de Vael Harrow en **VRoid Studio 2.16** y exportarlos como **VRM 1.0** a `web/assets_src/vroid/<id>.vrm`. Están escritas para alguien que no es artista: sigue los pasos en orden y copia los valores tal cual.

| # | Archivo | Personaje | Papel | Altura | Colores principales | Acento | Silueta (cómo se reconoce de lejos) |
|---|---|---|---|---|---|---|---|
| 1 | [kael.md](kael.md) | **Kael Arden** | Protagonista | 174 cm | verde azulado `#1F6F78`, azul tinta `#2A2F45`, crema `#EDE6D6` | Éter `#7FF5FF` + cobre `#C9893F` | Abrigo largo de dos colas, media capa en el hombro izquierdo, pelo plateado en punta con coleta fina y ahoge |
| 2 | [lyra.md](lyra.md) | **Lyra Vensel** | Aprendiz Lanternwright (Zephyr) | 162 cm | crema `#F2E6CF`, menta `#3FAE8C`, cuero `#7A4E32` | latón `#D9A441` + Zephyr `#5FE8B0` | Coleta lateral alta, gafas de latón en la frente, capita corta en el hombro derecho y cartera de dibujo |
| 3 | [maren.md](maren.md) | **Anciana Maren Holt** | Portavoz del Concord | 168 cm | ciruela `#4A2F52`, oro `#E2B95B`, ceniza `#D9D4CC` | azul pizarra `#8FA8D8` | Túnica larga recta, manto de cuello alto, moño con corona trenzada y cadena de cargo |
| 4 | [ostin.md](ostin.md) | **Hermano Ostin** | Sacerdote de la Campana Silente | 178 cm | marfil `#ECE4D4`, pervinca `#6F7FB8`, latón `#B8935A` | azul pálido `#A8C4FF` | Hábito ancho de mangas acampanadas, estola larga a un lado y campanita al pecho |
| 5 | [toma.md](toma.md) | **Toma** | Mensajero callejero | 138 cm | naranja `#E08A3C`, marrón `#5A4636`, verde azulado `#2F8F8A` | moneda `#FFD36B` | Chaqueta enorme con mangas remangadas, pañuelo en la cabeza y bolsa de cartas cruzada |
| 6 | [hesk.md](hesk.md) | **Hesk** | Herrero | 184 cm | cuero `#5E4330`, carbón `#3A3530`, cobre óxido `#B5654A` | brasa `#FF8A3D` | Torso ancho, delantal de cuero largo, barba pelirroja y martillo al cinto |
| 7 | [wenna.md](wenna.md) | **Wenna** | Dueña de "La Tetera Dorada" | 163 cm | vino `#8A3B3B`, crema `#F2EBDD`, verde `#4E8A5A` | oro `#E8B65A` | Trenza lateral cobriza, pañuelo verde, delantal blanco sobre falda en capas y llavero en la cadera |

Orden de alturas en la fila del elenco: Hesk > Ostin > Kael > Maren > Wenna ≥ Lyra > Toma. Así la fila se lee clara y variada.

## Reglas comunes (léelas antes de cualquier hoja)

1. **Idioma de los menús.** Se dan en inglés (como en VRoid 2.16 por defecto) con traducción entre paréntesis. **Settings → Language** cambia el idioma.
2. **Deslizadores.** Valores en la escala que muestra VRoid. Si tu versión usa otra escala: `0` = izquierda, `50` = centro (valor por defecto) y `100` = derecha. Lo que no aparezca en la guía, déjalo por defecto.
3. **Colores.** Pega el hex en el campo **Hex / #** del selector de color.
4. **Asimetría.** Todos los diseños son asimétricos. Desactiva **Symmetry (Simetría)** cuando la guía diga "solo izquierda/derecha".
5. **Izquierda/derecha** = las del personaje.
6. **Sombras.** Siempre frías y de color (azuladas o violáceas) en la ropa, y rosadas y cálidas en la piel. **Nunca gris ni negro.**
7. **Motivo del mundo:** hexágonos (cierres, broches, cenefas) y el cian del Éter `#7FF5FF`, que solo usa Kael. Los demás llevan su propio acento.
8. **Contorno (Look → Outline):** activado, grosor 0.25–0.35, color `#2A2433` en la ropa y un tono oscuro del propio pelo en el pelo.
9. **Exportar:** **Camera/Exporting → Export → Export as VRM → VRM 1.0**. Materiales: 8 o menos, atlas de 2048. Polígonos: 20 000–40 000 triángulos (NPCs: 15 000–25 000). Guarda en `web/assets_src/vroid/<id>.vrm`, en minúsculas.
10. **Original.** No copies peinados, trajes ni símbolos de personajes de otros juegos. Las referencias solo marcan el **nivel de acabado**.

## Qué pasa cuando exportas
* Con el servidor de desarrollo encendido (`http://127.0.0.1:5173`), Vite vigila `assets_src/vroid/`: al aparecer `kael.vrm`, la página se recarga y el personaje usa el VRM (con MToon ajustado, física de pelo y ropa, parpadeo y mirada).
* Hasta entonces se ve el modelo provisional de Blender.
* Vista de comprobación: `http://127.0.0.1:5173/character_lab.html?shot=lineup` (elenco) o `?shot=<id>` (un personaje).
* Para la build final: `node tools/characters/sync.mjs` copia los VRM a `public/assets/characters/`.

## Accesorios que añade el equipo después
Cada hoja termina con una lista de "accesorios de firma" (cristales, hebillas, armas, etc.) que se montan sobre los huesos del VRM en Blender/Three.js. **No hace falta hacerlos en VRoid.**
