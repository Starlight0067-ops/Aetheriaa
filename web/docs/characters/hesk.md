# Hesk — Hoja de diseño para VRoid Studio 2.16

> Herrero de Vael Harrow, unos 45 años. Grande, de pocas palabras y con un orgullo enorme por su oficio. Reconoce enseguida que la espada de Kael "tiene un plegado que nadie forja desde hace siglos". Tiene el pelo y la barba pelirrojos, y cicatrices de quemaduras en los antebrazos.

**Archivo final:** `web/assets_src/vroid/hesk.vrm` (VRM **1.0**) · **Tiempo:** 50–70 min

## 0. Antes de empezar
Lee las reglas comunes en [README.md](README.md). Proyecto: **File → Save As → `hesk`**.

### Paleta
| Uso | Hex |
|---|---|
| Delantal (principal) | `#5E4330` (cuero) |
| Sombra del delantal | `#3E2A20` |
| Pantalón | `#3A3530` (carbón) |
| Camisa | `#D8CFC0` (lino) |
| Sombra de la camisa | `#A9A0A8` |
| Cobre óxido (remaches, placa) | `#B5654A` |
| Hierro (hebillas, herramientas) | `#6A6E78` |
| **Acento brasa** | `#FF8A3D` |
| Pelo y barba base | `#A8452A` |
| Pelo sombra | `#6E2A1A` |
| Pelo reflejo | `#E07A48` |
| Ojos | `#5A4A3A` (marrón oscuro) |
| Piel / sombra | `#E0A886` / `#C27E68` |

**Motivo:** el **sello del gremio de herreros**, un yunque dentro de un hexágono, en la placa del delantal. **Asimetría:** la manga derecha está remangada hasta el hombro y la izquierda hasta el codo; el **brazal de cuero** va solo en el antebrazo **izquierdo**; las gafas cuelgan del cuello hacia la **derecha**.

## 1. Modelo base
**Create New → Male** → guardar como `hesk`.

## 2. Cuerpo (el más corpulento del elenco)
| Deslizador | Valor |
|---|---|
| Height | **88** (≈ 184 cm) |
| Head Size | **40** |
| Neck Width | **70** (cuello grueso) |
| Neck Length | **40** |
| Shoulder Width | **85** |
| Chest | **80** |
| Waist | **65** |
| Hip Width | **60** |
| Arm thickness / Upper arm (si existe) | **80** |
| Forearm (si existe) | **75** |
| Hand Size | **62** |
| Leg Length | **52** |
| Thigh / Calf | **70** / **65** |

Piel: `#E0A886` y sombra `#C27E68`.

## 3. Cara
1. **Face Set:** preset masculino de **ojos pequeños y rasgos marcados**.
2. **Face Shape:** Face width **58**, Chin length **52**, Jaw **70** (mandíbula cuadrada), Cheek **40**.
3. **Eyes:** Size **40**, Height **40**, Tilt **48**, Upper eyelid **58**, Iris Size **44**.
4. **Iris:** base `#5A4A3A`; mitad superior `#3A2E24`; pupila `#1E1812`; reflejo inferior `#FFB070` al 35 % (el resplandor de la fragua).
5. **Highlight:** un brillo pequeño.
6. **Eyeline:** grueso y corto. Color `#2A1E18`.
7. **Eyebrows:** **gruesas, rectas y pobladas**. Color `#6E2A1A`, posición **46** (bajas, de ceño fuerte).
8. **Nose:** **55** (nariz con presencia). **Mouth:** serio y ancho, Width **50**.
9. **Barba (VRoid no tiene barbas):** píntala en la **textura de la cara** (**Face → Edit Texture → Skin**):
   * Una **barba corta y llena** que cubre la mandíbula, el mentón y el bigote, en `#A8452A`, con el borde exterior en zigzag (mechones) y el interior en `#6E2A1A`.
   * Deja la piel libre alrededor de la boca (un óvalo pequeño).
   * El volumen 3D de la barba se añade en Blender (sección 8). Lo pintado sirve de base.
10. **Cicatriz:** una línea fina `#C27E68` que cruza la ceja izquierda.

## 4. Pelo
**Silueta:** **corto por los lados** y un poco más largo arriba, **peinado hacia atrás** con algún mechón rebelde; nada de flequillo.
1. **Preset:** masculino **corto peinado hacia atrás**. **Edit Hairstyle**.
2. **Front Hair:** **4 mechones** gruesos hacia atrás (Thickness **70**, Tip **60**); uno cae suelto sobre la frente por la **derecha**.
3. **Laterales:** muy cortos (rapados): reduce su longitud al mínimo.
4. **Back Hair:** corto, hasta la nuca, en mechones gruesos.
5. **Material:** Base `#A8452A`, Shade `#6E2A1A`, Highlight `#E07A48` (0.5). Textura: degradado de raíz `#8A3420` a puntas `#C25A36` y anillo de brillo marcado `#F09A62`.

## 5. Ropa
Capas: camisa → delantal de cuero largo → cinturón de herramientas → brazal.
1. **Tops:** **camisa de lino** de cuello abierto con las mangas largas, **remangadas**: la derecha hasta el hombro y la izquierda hasta el codo (ajústalo con **Sleeve Length** y pinta los pliegues del remangado).
   * Base `#D8CFC0`, sombra `#A9A0A8`.
   * **Manchas de hollín** `#6A6460` al 30 % en el pecho y los puños.
   * **Cicatrices de quemadura** en los antebrazos (en la textura de la piel): manchas irregulares `#D0907A` al 40 %.
2. **Delantal:** VRoid no tiene delantal de herrero. Píntalo en la camisa y el pantalón **o** usa **One-piece/Skirt** como base:
   * **Peto** de cuero `#5E4330` desde el pecho hasta **debajo de la rodilla**, con el borde cosido en `#3E2A20` y **remaches** `#B5654A`.
   * **Placa del gremio** en el pecho: un hexágono `#B5654A` con un yunque `#3E2A20` dentro.
   * **Quemaduras** en el delantal: dos manchas `#2A1E18` cerca del bajo.
   * Correas al cuello y a la cintura en `#3E2A20`. (El volumen real del delantal se añade en Blender si el pintado no basta.)
3. **Bottoms:** **pantalón de trabajo** recto `#3A3530`, con rodilleras pintadas `#4A443E`.
4. **Shoes:** **botas de trabajo altas y gruesas** `#2E2420`, puntera de hierro `#6A6E78` y dos hebillas de hierro.
5. **Gloves:** **guante de herrero solo en la mano izquierda** (la que sujeta las tenazas), grande, de cuero `#5E4330` y con puño alto. **En el antebrazo izquierdo**, un **brazal de cuero** `#3E2A20` con tres correas.

## 6. Accesorios en VRoid
* **Gafas de forja** colgando del cuello (si hay **Glasses** que pueda bajarse al cuello; si no, sección 8): montura `#6A6E78` y cristales ahumados `#4A3A2A`.

## 7. Aspecto
Outline 0.35 (`#2A2433`; pelo `#4A1A10`) · Shading Toony **0.95** · Rim light `#FFC9A0` a **0.35** (luz cálida de fragua).

## 8. Accesorios de firma (Blender / Three.js)
1. **Barba 3D:** volumen de mechones gruesos `#A8452A` sobre la mandíbula, con bigote. Es lo más importante de su silueta.
2. **Martillo de forja** colgado a la **cadera derecha**: cabeza de hierro `#6A6E78` y mango de madera oscura con cuero.
3. **Cinturón de herramientas**: tenazas, un cincel y un trapo `#B5654A` colgando.
4. **Gafas de forja** al cuello, ladeadas hacia la derecha.
5. **Pendiente**: un aro de hierro en la oreja izquierda.
6. **Brasas**: partículas `#FF8A3D` que salen del delantal cuando trabaja (efecto del motor).

## 9. Expresiones
**happy** al 60 % (sonrisa contenida bajo la barba). **angry** al 100 %. Comprueba que **aa** abre la boca dentro de la barba pintada.

## 10. Exportar
**VRM 1.0**, polígonos 15 000–25 000, materiales ≤ 8, atlas 2048. Avatar name `Hesk`. Guarda en **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\hesk.vrm`**.

### Comprobación rápida (`/character_lab.html?shot=hesk`)
* [ ] Es el más alto y ancho de la fila; el delantal llega bajo la rodilla.
* [ ] Lleva el guante y el brazal en el brazo izquierdo y la manga derecha remangada hasta el hombro.
* [ ] La barba pelirroja se lee desde lejos.
