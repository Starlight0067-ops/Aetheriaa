# Anciana Maren Holt — Hoja de diseño para VRoid Studio 2.16

> Portavoz del Concord de Harrow, unos 55 años. Severa pero justa; habla con frases cortas. Perdió a una hija en un accidente de Resonancia, y por eso desconfía de los Resonantes. Lleva **luto discreto**: una cinta oscura en la muñeca izquierda.

**Archivo final:** `web/assets_src/vroid/maren.vrm` (VRM **1.0**) · **Tiempo:** 50–70 min

## 0. Antes de empezar
Lee las reglas comunes en [README.md](README.md). Proyecto: **File → Save As → `maren`**.

### Paleta
| Uso | Hex |
|---|---|
| Túnica (principal) | `#4A2F52` (ciruela) |
| Sombra de la túnica | `#2E1D38` |
| Manto | `#3A2440` |
| Oro (bordados, cadena de cargo) | `#E2B95B` |
| Oro oscuro | `#A7823A` |
| Ceniza (fajín, forro, cuello interior) | `#D9D4CC` |
| **Acento azul pizarra** | `#8FA8D8` |
| Cinta de luto | `#231A2B` |
| Pelo base (plata) | `#C9C9D3` |
| Pelo sombra | `#8C8AA0` |
| Ojos | `#6A86A8` (azul acero) |
| Piel / sombra | `#EED3C0` / `#D9A99A` |

**Motivo:** el sello del Concord, un **hexágono dorado con un fragmento de cristal**, en el broche del manto y en el colgante de la cadena. **Asimetría:** el manto cae más largo por la **izquierda**, el bordado de la túnica sube solo por el **lado derecho** y la cinta de luto va en la **muñeca izquierda**.

## 1. Modelo base
**Create New → Female** → guardar como `maren`.

## 2. Cuerpo
| Deslizador | Valor |
|---|---|
| Height | **64** (≈ 168 cm) |
| Head Size | **44** |
| Neck Length | **58** (cuello largo y erguido) |
| Shoulder Width | **50** |
| Bust | **42** |
| Waist | **46** |
| Hip Width | **48** |
| Leg Length | **55** |

Piel: `#EED3C0` y sombra `#D9A99A`.

## 3. Cara
1. **Face Set:** el preset femenino más **adulto**: ojos alargados y estrechos.
2. **Face Shape:** Face width **44**, Chin length **55**, Cheek **34** (pómulos marcados, sin redondez infantil).
3. **Eyes:** Size **44**, Height **38** (ojos estrechos y serios), Tilt **52**, Upper eyelid **62** (párpado pesado), Iris Size **46** (iris pequeño = mirada adulta).
4. **Iris:** base `#6A86A8`; mitad superior `#34465E`; anillo exterior `#22303F`; pupila `#141C26`; reflejo inferior `#B9CBE6` al 35 %.
5. **Highlight:** **un solo brillo pequeño** (`#FFFFFF`).
6. **Eyeline:** delineado fino y recto, sin "cola". Color `#2A2433`. Añade una **línea fina de edad** bajo el ojo (en **Face → Makeup**, o pintada en la textura de la cara: un trazo `#C99A8C` al 30 %).
7. **Eyebrows:** rectas, finas y **ligeramente fruncidas** hacia el centro. Color `#8C8AA0`, posición **50**.
8. **Mouth:** preset **serio, labios finos y rectos**, Width **40**. Pinta una sombra muy suave en las comisuras (`#C99A8C` al 25 %).
9. **Nose:** **42** (algo más presente que en los jóvenes).

## 4. Pelo
**Silueta:** recogido en un **moño bajo** con una **corona trenzada** alrededor de la cabeza; un único mechón suelto enmarca la cara por la **derecha**.
1. **Preset:** uno femenino **recogido (moño / bun)**. Después **Edit Hairstyle**.
2. **Base Hair:** raya en medio, peinado **tirante y liso** hacia atrás.
3. **Front Hair:** **sin flequillo**: deja solo dos mechones muy cortos peinados hacia atrás en las sienes y **un mechón suelto en la sien derecha** hasta la barbilla (Tip **70** y Curl **15**).
4. **Corona trenzada:** grupo nuevo, una **trenza** que rodea la cabeza de oreja a oreja por encima de la frente (si tu versión tiene preset de trenza; si no, 5 mechones cortos superpuestos en arco).
5. **Moño:** grupo en la nuca, **moño bajo** redondo de unos 9 cm. Física desactivada (es un moño rígido).
6. **Material:** Base `#C9C9D3`, Shade `#8C8AA0`, Highlight `#FFFFFF` (0.4). Textura: degradado de raíz `#B0AFBF` a puntas `#DCDCE4` y anillo de brillo fino al 25 %.

## 5. Ropa
Capas: túnica larga → fajín → manto con cuello alto → cadena de cargo.
1. **Tops** + **Bottoms**, o mejor **One-piece (Vestido entero)** si existe: un vestido **largo hasta los tobillos**, recto, de **mangas largas acampanadas**.
   * Base `#4A2F52`, sombra `#2E1D38`.
   * **Bordado dorado** `#E2B95B`: una **franja vertical de 5 cm** que sube por el **lado derecho** del vestido, desde el bajo hasta la cadera, con **hexágonos encadenados** dentro. Las mangas llevan una franja dorada de 3 cm en el borde.
   * Bajo del vestido: ribete `#D9D4CC` de 2 cm.
2. **Fajín:** pintado en la cintura, ceniza `#D9D4CC` de 7 cm con un **nudo plano a la izquierda**.
3. **Manto:** si hay **capa / cape** en Tops o Accessory, una **capa hasta media pantorrilla con cuello alto rígido**. Color `#3A2440`, forro `#D9D4CC` y ribete `#E2B95B`. Debe caer **más larga por la izquierda** (si no se puede, pinta el bajo en diagonal con transparencia). Si VRoid no tiene capa, se añade en Blender (sección 8).
4. **Shoes:** zapatos cerrados de tacón bajo `#2E1D38` (apenas se ven).
5. **Gloves:** ninguno. En la **muñeca izquierda**, pinta una **cinta de luto** `#231A2B` de 1,5 cm con un pequeño lazo.

## 6. Accesorios en VRoid
* **Pendientes:** dos gotas pequeñas de oro `#E2B95B`.
* **Collar:** si hay una cadena larga, úsala en `#E2B95B` (será la base de la cadena de cargo).

## 7. Aspecto
Outline 0.3 (`#2A2433`; pelo `#5E5C70`) · Shading Toony **0.92** · Rim light `#EDE6FF` a **0.25** (frío y digno).

## 8. Accesorios de firma (Blender / Three.js)
1. **Cadena de cargo** del Concord: eslabones dorados sobre los hombros, con el **sello hexagonal** (hexágono de oro con un fragmento de cristal azul pizarra `#8FA8D8`) en el pecho.
2. **Broche del manto:** un hexágono de oro en el hombro izquierdo.
3. **Horquilla del moño:** dos agujas de oro cruzadas con una pequeña gema `#8FA8D8`.
4. **Libro del Concord** pequeño de tapas `#2E1D38`, sujeto a la cadera con una cadenita.
5. **Cinta de luto** (si no se pintó): cinta de tela `#231A2B` con las puntas sueltas.

## 9. Expresiones
**happy** reducida al **40 %** (sonríe poco). **angry** al **70 %**. **sad** al 100 % (se usará en la escena de su hija).

## 10. Exportar
**VRM 1.0**, polígonos 15 000–25 000 (NPC), materiales ≤ 8, atlas 2048. Avatar name `Maren Holt`. Guarda en **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\maren.vrm`**.

### Comprobación rápida (`/character_lab.html?shot=maren`)
* [ ] La silueta es recta, larga y vertical (la más "columna" del elenco).
* [ ] El bordado dorado sube solo por la derecha y la cinta de luto está en la muñeca izquierda.
* [ ] Tiene ojos estrechos, iris pequeño y un solo brillo.
