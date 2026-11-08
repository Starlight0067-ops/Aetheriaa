# Hermano Ostin — Hoja de diseño para VRoid Studio 2.16

> Sacerdote de la Iglesia de la Campana Silente, unos 30 años. Amable y sincero; cita las escrituras ("Lo que está en silencio no puede romperse"). Cree que Kael es una señal de advertencia, pero lo trata con cariño. Alto y de hombros caídos, con una calma que se nota en la postura.

**Archivo final:** `web/assets_src/vroid/ostin.vrm` (VRM **1.0**) · **Tiempo:** 50–70 min

## 0. Antes de empezar
Lee las reglas comunes en [README.md](README.md). Proyecto: **File → Save As → `ostin`**.

### Paleta
| Uso | Hex |
|---|---|
| Hábito (principal) | `#ECE4D4` (marfil) |
| Sombra del hábito | `#BFB4C9` (sombra lavanda) |
| Estola y capucha | `#6F7FB8` (pervinca) |
| Sombra de la estola | `#4A5590` |
| Latón (campana, hebillas) | `#B8935A` |
| Cordón del cinturón | `#C9A87A` |
| **Acento azul pálido (silencio)** | `#A8C4FF` |
| Cuentas de oración | `#3E4A78` |
| Pelo base (castaño cálido) | `#5A4030` |
| Pelo sombra | `#3A2820` |
| Ojos | `#7A5A44` (avellana) |
| Piel / sombra | `#E9C6A8` / `#D39C86` |

**Motivo:** la **campana hexagonal** (una campana sin badajo, símbolo del silencio) en el pecho y bordada en la estola. **Asimetría:** la estola cae larga por la **izquierda** y corta por la derecha; las cuentas de oración se enrollan en la **muñeca derecha**; hay una **trencita** detrás de la oreja derecha.

## 1. Modelo base
**Create New → Male** → guardar como `ostin`.

## 2. Cuerpo
| Deslizador | Valor |
|---|---|
| Height | **78** (≈ 178 cm) |
| Head Size | **44** |
| Neck Length | **56** |
| Shoulder Width | **50** (hombros algo caídos) |
| Waist | **46** |
| Arm Length | **54** |
| Leg Length | **60** |

Piel: `#E9C6A8` y sombra `#D39C86`.

## 3. Cara
1. **Face Set:** preset masculino de **ojos suaves y caídos** (aspecto amable).
2. **Face Shape:** Face width **46**, Chin length **52**, Cheek **44**.
3. **Eyes:** Size **50**, Height **44**, Tilt **40** (rabillo hacia abajo = bondad), Upper eyelid **60**, Iris Size **52**.
4. **Iris:** base `#7A5A44`; mitad superior `#4A3426`; anillo exterior `#2E2018`; pupila `#1E140E`; reflejo inferior `#C9A98A` al 40 %. Detalle de firma: un **anillo muy tenue** `#A8C4FF` al 25 % (es un Resonante que lo oculta… o eso sospechan algunos).
5. **Highlight:** un brillo mediano arriba y otro pequeño abajo.
6. **Eyeline:** fino, con pestañas cortas. Color `#2E2420`.
7. **Eyebrows:** **suaves, curvadas y con la parte interior levantada** (gesto de preocupación amable). Color `#3A2820`.
8. **Mouth:** preset de **sonrisa leve y cerrada**, Width **44**. **Nose:** **40**.

## 4. Pelo
**Silueta:** corto, suave y algo ondulado, con raya al lado; flequillo largo apartado hacia la izquierda y una **trencita fina detrás de la oreja derecha** que llega a la clavícula.
1. **Preset:** masculino **corto y ondulado** con flequillo largo. **Edit Hairstyle**.
2. **Base Hair:** raya a la **derecha** (el flequillo cae hacia su izquierda).
3. **Front Hair, 5 mechones** gruesos y suaves (Tip **45**, Thickness **65**, Curl **15**): barridos hacia la izquierda; el más largo llega a la ceja izquierda.
4. **Laterales:** cortos, por detrás de las orejas.
5. **Back Hair:** hasta la nuca, puntas suaves hacia dentro.
6. **Trencita:** grupo nuevo detrás de la oreja **derecha**, de 3 mechones trenzados (o un mechón fino) hasta la clavícula, con una **cuenta azul** al final (accesorio). Física: Stiffness **0.5**.
7. **Material:** Base `#5A4030`, Shade `#3A2820`, Highlight `#E6C9A8` (0.4). Textura: degradado de raíz `#4A3426` a puntas `#6E5040` y anillo de brillo suave.

## 5. Ropa
Capas: hábito largo → escapulario/estola → capucha caída a la espalda → cinturón de cordón.
1. **One-piece (o Tops + Bottoms):** **hábito largo hasta los tobillos**, de **mangas muy anchas y acampanadas**.
   * Base `#ECE4D4`, sombra `#BFB4C9`.
   * Ribete pervinca `#6F7FB8` de 3 cm en el bajo y las mangas, con una **línea fina** `#B8935A` dentro.
   * **Escapulario** delantero: una franja de tela `#6F7FB8` de 22 cm de ancho que cae del cuello al bajo por delante, con la **campana hexagonal** bordada en `#B8935A` a la altura del pecho.
2. **Estola:** pintada sobre los hombros (o con **Accessory → Scarf/Stole**). Cae **hasta la rodilla por la izquierda** y solo hasta el pecho por la derecha. Color `#6F7FB8` y puntas con flecos `#B8935A`.
3. **Capucha:** si el Tops tiene **Hood**, actívala **bajada** sobre la espalda (`#6F7FB8`).
4. **Cinturón:** cordón `#C9A87A` atado a la izquierda, con **dos cabos colgando** hasta la rodilla con nudos en la punta.
5. **Shoes:** sandalias cerradas de cuero `#6A5038`, con calcetines `#ECE4D4`.
6. **Gloves:** ninguno.

## 6. Accesorios en VRoid
* **Necklace:** cordón largo `#C9A87A` (donde colgará la campanita).
* Nada más.

## 7. Aspecto
Outline 0.28 (`#2A2433`; pelo `#2A1E18`) · Shading Toony **0.88** (algo más suave: carácter dulce) · Rim light `#F2F0FF` a **0.3**.

## 8. Accesorios de firma (Blender / Three.js)
1. **Campanita sin badajo:** de latón `#B8935A` y forma hexagonal, cuelga del cordón al pecho. Es el símbolo de la Campana Silente.
2. **Cuentas de oración** `#3E4A78` enrolladas tres vueltas en la **muñeca derecha**, con una cuenta grande `#A8C4FF`.
3. **Libro de escrituras** pequeño de tapas `#6F7FB8`, sujeto al cinturón con correa.
4. **Cuenta azul** al final de la trencita.
5. **Bastón de peregrino** (opcional, para las escenas): madera clara con una campanita en la punta.

## 9. Expresiones
**happy** al 80 % (sonrisa amable). **sad** al 100 %. **angry** al **40 %** (casi nunca se enfada).

## 10. Exportar
**VRM 1.0**, polígonos 15 000–25 000, materiales ≤ 8, atlas 2048. Avatar name `Brother Ostin`. Guarda en **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\ostin.vrm`**.

### Comprobación rápida (`/character_lab.html?shot=ostin`)
* [ ] Es la segunda figura más alta del elenco y la silueta de hábito se ensancha abajo (forma de campana).
* [ ] La estola es larga a la izquierda, las cuentas están en la muñeca derecha y la trencita en la oreja derecha.
