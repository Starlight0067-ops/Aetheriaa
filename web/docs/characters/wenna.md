# Wenna — Hoja de diseño para VRoid Studio 2.16

> Dueña de la posada **La Tetera Dorada**, unos 35 años. Cálida, generosa y lista para los negocios ("Media ciudad discute del Núcleo en mis mesas. ¡La mejor semana en años!"). Le da a Kael pan de miel para el camino. Lleva siempre las mangas subidas y un llavero que suena al andar.

**Archivo final:** `web/assets_src/vroid/wenna.vrm` (VRM **1.0**) · **Tiempo:** 50–70 min

## 0. Antes de empezar
Lee las reglas comunes en [README.md](README.md). Proyecto: **File → Save As → `wenna`**.

### Paleta
| Uso | Hex |
|---|---|
| Corpiño y falda (principal) | `#8A3B3B` (vino) |
| Sombra del vino | `#5A2638` |
| Blusa | `#F2EBDD` (crema) |
| Sombra de la blusa | `#C9BBC0` |
| Delantal | `#FAF7F0` |
| Pañuelo y enagua | `#4E8A5A` (verde) |
| Sombra del verde | `#2F5E48` |
| **Acento oro (tetera)** | `#E8B65A` |
| Latón (llaves) | `#C99A4A` |
| Pelo base (cobrizo) | `#B5602E` |
| Pelo sombra | `#7A3420` |
| Pelo reflejo | `#F0A060` |
| Ojos | `#5E9A4A` (verde oliva) |
| Piel / sombra | `#F2CDB2` / `#E0A090` |

**Motivo:** la **tetera dorada** (broche y bordado del delantal), con una cenefa de hexágonos en el bajo del delantal. **Asimetría:** trenza lateral por el **hombro izquierdo**; el delantal va recogido con un pellizco en la **cadera derecha** y deja ver la enagua verde; el llavero cuelga de la **cadera derecha**.

## 1. Modelo base
**Create New → Female** → guardar como `wenna`.

## 2. Cuerpo
| Deslizador | Valor |
|---|---|
| Height | **60** (≈ 163 cm) |
| Head Size | **45** |
| Neck Length | **50** |
| Shoulder Width | **50** |
| Bust | **60** |
| Waist | **48** |
| Hip Width | **60** |
| Arm Length | **50** |
| Leg Length | **54** |

Piel: `#F2CDB2` y sombra `#E0A090`.

## 3. Cara
1. **Face Set:** preset femenino **adulto y amable**, de ojos almendrados.
2. **Face Shape:** Face width **48**, Chin length **48**, Cheek **50**.
3. **Eyes:** Size **52**, Height **48**, Tilt **46** (rabillo algo hacia abajo = cálida), Upper eyelid **55**, Iris Size **52**.
4. **Iris:** base `#5E9A4A`; mitad superior `#2F5A28`; anillo exterior `#1E3A1A`; pupila `#142412`; reflejo inferior `#C9E89A` al 40 %.
5. **Highlight:** un brillo mediano y uno pequeño.
6. **Eyeline:** con **pestañas superiores largas**, un rabillo suave y pestañas inferiores finas. Color `#3A2420`.
7. **Eyebrows:** arqueadas y suaves. Color `#7A3420`.
8. **Mouth:** **sonrisa amplia y cálida**, Width **50**. Labios `#D9776A` al 40 %.
9. **Makeup:** rubor `#F0A090` al 45 % y un **lunar** pequeño `#6A3A30` bajo el ojo derecho.

## 4. Pelo
**Silueta:** larga melena **ondulada y cobriza**, recogida en una **trenza lateral gruesa** que cae por el **hombro izquierdo** hasta la cintura, con un **pañuelo verde** en la cabeza (tipo cinta ancha anudada en la nuca). Unos mechones sueltos enmarcan la cara.
1. **Preset:** femenino **largo y ondulado**. **Edit Hairstyle**.
2. **Base Hair:** raya en medio, peinada hacia atrás bajo el pañuelo.
3. **Front Hair:** **dos mechones ondulados** sueltos a cada lado de la cara, hasta la barbilla (Curl **25**, Tip **55**); el izquierdo algo más largo. Un flequillo muy corto y abierto en el centro.
4. **Back Hair:** recógelo todo hacia la **izquierda**: borra los mechones de la derecha y deja una masa suave en la nuca.
5. **Trenza lateral (grupo nuevo):** desde detrás de la oreja izquierda, por delante del hombro izquierdo, **hasta la cintura**, gruesa (si hay preset de trenza, úsalo con grosor **70**). Física: Stiffness **0.45** y Gravity **0.4**.
6. **Material:** Base `#B5602E`, Shade `#7A3420`, Highlight `#F0A060` (0.5). Textura: degradado de raíz `#8A4422` a puntas `#D07A40` y anillo de brillo ondulado `#FFC08A` al 60 %.
7. **Pañuelo:** si hay **Accessory → Headscarf / Bandana / Hair band**, una **cinta ancha** `#4E8A5A` que cubre la parte superior de la cabeza, anudada en la nuca con **dos puntas** que caen por la espalda. Bordes con ribete `#E8B65A`.

## 5. Ropa
Capas: blusa → corpiño con cordones → falda larga en capas → enagua verde asomando → delantal blanco.
1. **Tops:** **blusa** de escote barco con **mangas abullonadas subidas por encima del codo** (sleeve length **55**).
   * Base `#F2EBDD`, sombra `#C9BBC0`, con un ribete de puntilla pintada en el escote (ondas `#FFFFFF`).
   * **Corpiño** pintado de debajo del pecho a la cadera, en `#8A3B3B`, con **cordones cruzados** `#E8B65A` delante y costuras `#5A2638`.
2. **Bottoms:** **falda larga hasta los tobillos** (Skirt length **95**), con vuelo.
   * Base `#8A3B3B`, sombra `#5A2638`, con una franja `#5A2638` de 4 cm cerca del bajo.
   * **Enagua:** pinta un **borde verde** `#4E8A5A` de 3 cm asomando por debajo del bajo.
3. **Delantal:** pintado sobre la falda (o como segunda falda si tu versión permite capas): **blanco** `#FAF7F0`, desde la cintura hasta media pantorrilla, de 50 cm de ancho, con una **tetera dorada** `#E8B65A` bordada abajo a la izquierda y una **cenefa de hexágonos** `#E8B65A` en el bajo. **Recogido en la cadera derecha** (píntalo con un pliegue diagonal y deja ver más falda en ese lado).
4. **Shoes:** **botines** de tacón bajo `#3A2A22`, con cordones `#C99A4A`.
5. **Gloves:** ninguno.

## 6. Accesorios en VRoid
* **Pendientes:** gotas de oro `#E8B65A`.
* Pañuelo (si no se puso en el paso 4.7).

## 7. Aspecto
Outline 0.28 (`#2A2433`; pelo `#4A1E12`) · Shading Toony **0.9** · Rim light `#FFE6C8` a **0.35** (luz de posada, cálida).

## 8. Accesorios de firma (Blender / Three.js)
1. **Broche de la tetera dorada** en el pecho: una tetera pequeña de oro `#E8B65A` con un rubí `#8A3B3B`.
2. **Llavero** a la **cadera derecha**: un aro grande de latón `#C99A4A` con 5 llaves antiguas, que tintinea al andar (físicas).
3. **Trapo** de cocina a cuadros (`#FAF7F0` y `#4E8A5A`) metido en la cinturilla izquierda.
4. **Lazo** de tela `#4E8A5A` al final de la trenza.
5. **Bandeja con tetera** (prop para las escenas de posada).

## 9. Expresiones
**happy** al 100 % (sonríe con los ojos). **surprised** al 80 %. **relaxed** al 100 %.

## 10. Exportar
**VRM 1.0**, polígonos 15 000–25 000, materiales ≤ 8, atlas 2048. Avatar name `Wenna`. Guarda en **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\wenna.vrm`**.

### Comprobación rápida (`/character_lab.html?shot=wenna`)
* [ ] La trenza cae por el hombro izquierdo y el pañuelo verde se ve con sus puntas en la espalda.
* [ ] El delantal blanco está recogido a la derecha, la enagua verde asoma y la tetera dorada está bordada.
* [ ] La silueta es de reloj de arena con falda amplia.
