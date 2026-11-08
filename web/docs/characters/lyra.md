# Lyra Vensel — Hoja de diseño para VRoid Studio 2.16

> Aprendiz de los Lanternwrights, 22 años. Curiosa, habladora y siempre dibujando. Es la guía de Kael. Resonancia: **Zephyr** (viento). Lema del gremio: "Toda cerradura la hizo una mano. Toda mano puede entenderse."

**Archivo final:** `web/assets_src/vroid/lyra.vrm` (VRM **1.0**) · **Tiempo:** 60–80 min

## 0. Antes de empezar
Lee las **reglas comunes** de [README.md](README.md) (escala de deslizadores, colores en hex, simetría, izquierda/derecha = las del personaje). Proyecto: **File → Save As → `lyra`**.

### Paleta
| Uso | Hex |
|---|---|
| Blusa / falda pantalón (principal) | `#F2E6CF` |
| Sombra de la crema | `#C9BBA6` |
| Capita y detalles menta | `#3FAE8C` |
| Sombra de la menta | `#2A7A70` |
| Cuero (corsé, cartera, botas) | `#7A4E32` |
| Cuero oscuro | `#4E3122` |
| Latón (gafas, hebillas, remaches) | `#D9A441` |
| **Acento Zephyr** | `#5FE8B0` |
| Medias | `#3C4656` |
| Pelo base (castaño cobrizo) | `#8A4B32` |
| Pelo sombra | `#5A2E24` |
| Pelo mechón Zephyr | `#5FE8B0` |
| Ojos | `#3FB58A` (verde jade) |
| Piel / sombra de piel | `#F7DCC9` / `#EBB4A4` |

**Motivo:** engranajes hexagonales (los remaches y el broche de la capa son hexágonos de latón). **Asimetría:** coleta lateral a la **derecha** y trenza fina a la **izquierda**; capita solo en el **hombro derecho**; brazal de cuero solo en el **antebrazo izquierdo**.

## 1. Modelo base
**Create New → Female (Femenino)** → guardar como `lyra`.

## 2. Cuerpo (**Body → Body Shape**)
| Deslizador | Valor |
|---|---|
| Height | **58** (≈ 162 cm) |
| Head Size | **48** |
| Neck Length / Width | **52** / **42** |
| Shoulder Width | **45** |
| Bust | **50** |
| Waist | **40** |
| Hip Width | **50** |
| Arm Length | **50** |
| Leg Length | **58** |
| Thigh / Calf | **48** / **46** |

Piel: base `#F7DCC9` y sombra `#EBB4A4`.

## 3. Cara (**Face**)
1. **Face Set:** preset femenino de **ojos grandes y redondeados**, con expresión despierta.
2. **Face Shape:** Face width **46**, Chin length **48**, Cheek **52** (mejillas suaves).
3. **Eyes:** Eye Size **62**, Eye Height **58** (ojo abierto y curioso), Eye Tilt **54** (rabillo ligeramente hacia arriba), Iris Size **60**.
4. **Iris (Edit Texture):** base `#3FB58A`; mitad superior en degradado `#1E6B57`; anillo exterior `#164A3E`; pupila `#0F2E27`; reflejo inferior `#9FF2CF` (opacidad 45 %). Detalle de firma: **tres puntitos** `#5FE8B0` en la mitad inferior del iris, como motas de viento.
5. **Eye Highlight:** preset de **dos brillos grandes** (uno arriba y otro a un lado), en `#FFFFFF`.
6. **Eyeline / Eyelash:** delineado medio con **pestañas superiores marcadas** y una pequeña curva hacia arriba en el rabillo. Color `#3A2420`. Pestañas inferiores finas.
7. **Eyebrows:** preset **arqueado y fino**, color `#5A2E24`, posición **56**.
8. **Nose:** pequeño (**35**). **Mouth:** preset **sonriente con la boca entreabierta**, Width **46**.
9. **Maquillaje (Face → Makeup / Cheek):** rubor suave `#F2A6A0` al 40 %. Una **mancha de tinta** pequeña `#3A4A5A` en la mejilla izquierda (dibuja mucho).

## 4. Pelo (**Hairstyle**)
**Silueta:** media melena con flequillo desigual, **coleta lateral alta a la derecha** que cae hasta la cintura, **trenza fina a la izquierda** delante de la oreja y un lápiz detrás de la oreja izquierda (accesorio, sección 8).

1. **Preset:** uno femenino de **media melena con flequillo** (hasta los hombros). Después **Edit Hairstyle**.
2. **Base Hair:** raya a la **izquierda**.
3. **Front Hair (flequillo), 6 mechones:** puntas redondeadas pero definidas (Tip **60**, Thickness **55**). Longitudes de izquierda a derecha: ceja, mitad del ojo, ceja, entre las cejas (más corto), ceja y pómulo. Desactiva la simetría.
4. **Lateral izquierdo:** sustitúyelo por una **trenza fina** (si tu versión tiene preset de trenza en **Add Group → Braid**, úsalo) que llegue hasta el pecho, con un **anillo de latón** al final (accesorio).
5. **Lateral derecho:** un mechón liso hasta la barbilla.
6. **Back Hair:** capa hasta los hombros, puntas hacia dentro (Curl **−15**).
7. **Coleta lateral (grupo nuevo):** en el lado **derecho**, por encima de la oreja. **Ocho mechones** que nacen juntos y caen ondulados (Curl **20**) **hasta la cintura**, con las puntas abiertas. Activa la física: Stiffness **0.3** y Gravity **0.35**.
8. **Ahoge:** dos mechones cortos y curvos en la coronilla, en forma de "antenitas".
9. **Material del pelo:** Base `#8A4B32`, Shade `#5A2E24`, Highlight `#FFE3C7` (0.45).
   * Textura: degradado de raíz `#6E3A28` a puntas `#A86040`, y el anillo de brillo en zigzag al 25 % (`#FFE3C7`, 65 %).
   * **Mechón Zephyr:** solo el **interior de la coleta** (los 3 mechones de debajo): pinta su segunda mitad en degradado hacia `#5FE8B0`. Al moverse, la coleta enseña el verde.

## 5. Ropa (**Outfit**)
Capas de dentro hacia fuera: blusa → corsé-chaleco → falda pantalón → capita → cinturón de herramientas.

1. **Tops:** blusa de **mangas abullonadas cortas** (puff sleeves) con cuello redondo.
   * Base `#F2E6CF`, sombra `#C9BBA6`. Puños con ribete menta `#3FAE8C`.
   * Pinta un **corsé-chaleco** de cuero `#7A4E32` desde debajo del pecho hasta la cadera, con **6 remaches hexagonales** `#D9A441` en dos filas y **cordones** cruzados `#4E3122` en el centro.
   * Bolsillos: dos bolsillitos en el corsé (lado izquierdo), con tapa y botón de latón.
2. **Bottoms:** **falda pantalón (culotte) por encima de la rodilla** o shorts anchos. Color `#F2E6CF`, con el bajo ribeteado en `#3FAE8C`. Con **medias** largas `#3C4656` (si hay **Socks / Legwear**, elige medias opacas por encima de la rodilla).
3. **Capita (shoulder cape):** si hay una capa corta en **Tops** o **Accessory**, úsala; si no, se añade en Blender (sección 8). Color `#3FAE8C`, forro `#F2E6CF` y broche hexagonal de latón. **Solo en el hombro derecho.**
4. **Shoes:** **botines de cordones** hasta media pantorrilla. Cuero `#7A4E32`, suela `#4E3122` y ojales de latón.
5. **Gloves:** **ninguno en la derecha** (dibuja con esa mano). En el **antebrazo izquierdo**, un **brazal de cuero** con correas (si hay **Gloves → arm cover**, úsalo y coloréalo `#7A4E32`; si no, va en la sección 8).
6. **Manchas de tinta** pequeñas `#3A4A5A` en los dedos de la mano derecha (textura de la piel de las manos).

## 6. Accesorios en VRoid (**Accessory**)
* **Goggles / Glasses (Gafas) sobre la cabeza**, si existen: dos lentes redondas de latón `#D9A441`, con el cristal `#9FF8E8`, colocadas **en la frente, sobre el flequillo**.
* **Pendientes:** dos aros pequeños de latón.

## 7. Aspecto (**Look**)
Outline 0.25 (`#2A2433` en la ropa y `#4A2418` en el pelo) · Shading Toony **0.9** · Rim light `#FFF4E0` a **0.3**.

## 8. Accesorios de firma (Blender / Three.js)
1. **Gafas de Lanternwright** (si VRoid no las tenía): montura de latón con remaches hexagonales y lentes `#9FF8E8` con un ligero brillo.
2. **Cartera de dibujo** cruzada del hombro izquierdo a la cadera derecha: cuero `#7A4E32` con un **cuaderno** asomando y una correa con hebilla de latón.
3. **Lápiz** detrás de la oreja izquierda y **anillo de latón** al final de la trenza.
4. **Cinturón de herramientas**: compás, una pequeña llave inglesa y un frasquito con luz verde `#5FE8B0`.
5. **Colgante del gremio**: un engranaje hexagonal de latón con una pequeña bombilla.

## 9. Expresiones
**happy** al 100 % (es expresiva) y **surprised** al 100 %. Comprueba que **blink** no atraviese el flequillo.

## 10. Exportar
**Camera/Exporting → Export → Export as VRM → VRM 1.0**. Polígonos 20 000–35 000, materiales ≤ 8, atlas 2048. Avatar name `Lyra Vensel`. Guarda en **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\lyra.vrm`**.

### Comprobación rápida (`/character_lab.html?shot=lyra`)
* [ ] La coleta está a la derecha y la trenza a la izquierda.
* [ ] Las gafas quedan sobre la frente, la capita en el hombro derecho y el brazal en el brazo izquierdo.
* [ ] Al girar se ve el verde Zephyr dentro de la coleta.
