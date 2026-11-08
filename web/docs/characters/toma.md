# Toma — Hoja de diseño para VRoid Studio 2.16

> Niño de la calle de unos 12 años. Lleva mensajes por Vael Harrow y conoce cada callejón. Siempre está regateando ("¡Socio! Si oyes de algo brillante y sin vigilar…"). Es rápido, descarado y de buen corazón.

**Archivo final:** `web/assets_src/vroid/toma.vrm` (VRM **1.0**) · **Tiempo:** 45–60 min

## 0. Antes de empezar
Lee las reglas comunes en [README.md](README.md). Proyecto: **File → Save As → `toma`**.

### Paleta
| Uso | Hex |
|---|---|
| Chaqueta (principal) | `#E08A3C` (naranja) |
| Sombra de la chaqueta | `#A85A3A` |
| Pantalón corto / bolsa | `#5A4636` |
| Sombra del marrón | `#3E2E26` |
| Bufanda y pañuelo | `#2F8F8A` (verde azulado) |
| Sombra de la bufanda | `#1F5F66` |
| Camiseta interior | `#E9E2CF` |
| **Acento moneda** | `#FFD36B` |
| Calcetín izquierdo / derecho | `#2F8F8A` / `#C9573A` (desparejados) |
| Pelo base | `#2A1E18` (casi negro, castaño) |
| Pelo sombra | `#1A1210` |
| Pelo reflejo | `#6A4A38` |
| Ojos | `#C98A2E` (miel) |
| Piel / sombra | `#DDA67E` / `#C07E66` |

**Motivo:** monedas hexagonales de Vael Harrow (un collar de monedas y un botón-moneda en la chaqueta). **Asimetría:** chaqueta caída del **hombro izquierdo**; manga derecha remangada más alta que la izquierda; calcetines desparejados; tirita en la mejilla derecha.

## 1. Modelo base
**Create New → Male** (cuerpo de niño ajustando los deslizadores) → guardar como `toma`.

## 2. Cuerpo
| Deslizador | Valor |
|---|---|
| Height | **10** (≈ 138 cm; el mínimo o casi) |
| Head Size | **68** (cabeza grande = niño) |
| Neck Length / Width | **40** / **36** |
| Shoulder Width | **35** |
| Chest | **30** |
| Waist | **42** |
| Hip Width | **38** |
| Arm Length | **46** |
| Leg Length | **48** |
| Hand Size | **52** (manos algo grandes: torpe y simpático) |

Piel: `#DDA67E` y sombra `#C07E66`.

## 3. Cara
1. **Face Set:** el preset más **joven**, de ojos grandes y redondos.
2. **Face Shape:** Face width **52**, Chin length **40** (cara redonda), Cheek **62**.
3. **Eyes:** Size **66**, Height **60**, Tilt **56** (rabillo arriba = pícaro), Iris Size **58**.
4. **Iris:** base `#C98A2E`; mitad superior `#7A4A16`; anillo exterior `#4A2C0E`; pupila `#2A180A`; reflejo inferior `#FFD98A` al 50 %.
5. **Highlight:** **un brillo grande y dos pequeños** (ojos muy vivos).
6. **Eyeline:** grueso y corto, sin pestañas largas. Color `#2A1E18`.
7. **Eyebrows:** **gruesas, cortas y en ángulo** (de picardía). Color `#2A1E18`, posición **58**.
8. **Mouth:** preset de **sonrisa ladeada con un colmillo** si existe; si no, sonrisa abierta. Width **46**.
9. **Makeup:** pecas suaves `#B07050` al 30 % en la nariz y las mejillas. **Tirita** (plaster) en la mejilla **derecha**: un rectángulo `#F3EEE2` con dos líneas cruzadas `#D9CDB8`.

## 4. Pelo
**Silueta:** pelo de punta **muy desordenado**, aplastado por un **pañuelo verde azulado atado en la frente** cuyas puntas cuelgan por la **izquierda**. Los mechones salen por encima y por detrás del pañuelo.
1. **Preset:** masculino **corto y de punta (spiky)**. **Edit Hairstyle**.
2. **Front Hair, 6 mechones:** cortos, en punta (Tip **90**), apuntando en direcciones distintas; dos caen sobre la frente por encima del pañuelo. Desactiva la simetría.
3. **Back Hair:** **8 mechones** cortos en punta, hacia atrás y hacia fuera (Curl **30**), como un erizo.
4. **Ahoge:** uno grande y doble en la coronilla.
5. **Material:** Base `#2A1E18`, Shade `#1A1210`, Highlight `#6A4A38` (0.5). Textura: anillo de brillo en zigzag `#7A5A48` al 50 %.
6. **Pañuelo (bandana):** si hay **Accessory → Headband / Bandana**, colócalo a la altura de la frente en `#2F8F8A`, con las puntas atadas a la **izquierda**. Si no existe, se añade en la sección 8.

## 5. Ropa
Capas: camiseta → chaqueta enorme → bufanda → pantalón corto con cinturón de cuerda → bolsa cruzada.
1. **Tops:** **chaqueta con capucha grande y holgada** (hoodie / parka), una o dos tallas mayor.
   * Base `#E08A3C`, sombra `#A85A3A`.
   * **Mangas remangadas**: manga derecha hasta el codo y la izquierda hasta media manga (si hay deslizador **Sleeve Length**, ponlo en **60** y pinta el remangado como una banda `#C9783A` con pliegues).
   * **Parches** cosidos: uno cuadrado `#5A4636` en el codo izquierdo y uno `#2F8F8A` en el bolsillo derecho, con puntadas `#E9E2CF`.
   * Un **botón-moneda** hexagonal `#FFD36B` en el pecho.
   * La chaqueta **cae del hombro izquierdo**: pinta el cuello desplazado hacia ese lado, dejando ver la camiseta `#E9E2CF`.
2. **Bufanda:** si existe en Accessory, una **bufanda corta** `#2F8F8A` anudada con una punta hacia la espalda.
3. **Bottoms:** **pantalón corto** hasta la rodilla, `#5A4636`, con el bajo deshilachado (zigzag pintado `#3E2E26`) y un **cinturón de cuerda** `#C9A87A`.
4. **Calcetines:** **desparejados**: el izquierdo `#2F8F8A` hasta media pantorrilla y el derecho `#C9573A` caído.
5. **Shoes:** **botas cortas gastadas** `#4A3426`, con la puntera remendada `#5A4636` y cordones `#C9A87A`.
6. **Gloves:** **mitón** solo en la **mano izquierda**, `#5A4636`.

## 6. Accesorios en VRoid
* Bandana (si no se hizo arriba) y bufanda.
* Nada más.

## 7. Aspecto
Outline 0.3 (`#2A2433`; pelo `#120C0A`) · Shading Toony **0.95** · Rim light `#FFE9C9` a **0.35**.

## 8. Accesorios de firma (Blender / Three.js)
1. **Bolsa de mensajero** cruzada del hombro derecho a la cadera izquierda: lona `#5A4636` con **cartas** asomando, lacradas en `#C9573A`.
2. **Collar de monedas**: tres monedas hexagonales `#FFD36B` atadas con un cordón.
3. **Bandana** con las puntas largas a la izquierda (que ondean con la física).
4. **Silbato** de latón colgado de la bolsa.
5. **Tirita** en relieve (si no se pintó).

## 9. Expresiones
**happy** al 100 % con los ojos entrecerrados. **surprised** al 100 %. **angry** al 70 % (enfado de puchero).

## 10. Exportar
**VRM 1.0**, polígonos 15 000–25 000, materiales ≤ 8, atlas 2048. Avatar name `Toma`. Guarda en **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\toma.vrm`**.

### Comprobación rápida (`/character_lab.html?shot=toma`)
* [ ] Es el más bajo de la fila, con cabeza grande y chaqueta enorme.
* [ ] El pañuelo tiene las puntas a la izquierda y la tirita está en la mejilla derecha.
* [ ] Lleva un calcetín de cada color.
