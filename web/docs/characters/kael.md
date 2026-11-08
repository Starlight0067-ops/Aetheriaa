# Kael Arden — Hoja de diseño para VRoid Studio 2.16

> Protagonista de AETHERIA. Aparenta 19 años. Despertó en el Bosque Susurrante sin memoria, con un colgante de cristal afinador agrietado. Es la "voz" del Núcleo de Elyndra hecha cuerpo (secreto L-093): oye las **seis** Resonancias. Es el personaje con la **silueta más fuerte** del elenco.

**Archivo final:** `web/assets_src/vroid/kael.vrm` (VRM **1.0**)
**Tiempo estimado:** 60–90 minutos siguiendo los pasos en orden.

---

## 0. Antes de empezar (lee esto una vez)

* **Nombres de menú.** Se dan en inglés (tal como aparecen en VRoid Studio 2.16 con el idioma por defecto) y, entre paréntesis, su traducción. Si tienes VRoid en español, busca la palabra equivalente. Para cambiar el idioma: menú **Settings (Ajustes) → Language (Idioma)**.
* **Deslizadores.** VRoid muestra un número al lado de cada deslizador. En esta guía los valores van en la **misma escala que muestra VRoid**. Si tu versión muestra otra escala, usa la posición equivalente: `0` = izquierda del todo, `50` = centro (valor por defecto) y `100` = derecha del todo. Si un valor no está en la guía, **déjalo como está**.
* **Colores.** Cada vez que la guía da un color en hexadecimal (por ejemplo `#1F6F78`), haz clic en el cuadrado de color, busca el campo **Hex / #** del selector y pega el código **sin** cambiar nada más.
* **Guarda a menudo.** **File (Archivo) → Save (Guardar)** cada 10 minutos. Nombre del proyecto: `kael`.
* **Simetría.** En la edición de pelo y texturas, VRoid tiene un botón de **simetría (Symmetry)**. Kael es **asimétrico**: cuando la guía diga "solo lado izquierdo", **desactiva la simetría** antes de editar.
* **Izquierda/derecha** = las del personaje (su izquierda queda a la derecha de tu pantalla cuando lo miras de frente).

### Paleta de Kael (cópiala a un bloc de notas)

| Uso | Hex | Notas |
|---|---|---|
| Abrigo de viaje (principal) | `#1F6F78` | Verde azulado profundo |
| Sombra del abrigo | `#14495A` | |
| Túnica interior / pantalón | `#2A2F45` | Azul tinta |
| Sombra de túnica | `#1A1D2E` | |
| Cobre (cierres, ribetes, hebillas) | `#C9893F` | Color de los metales |
| Cobre claro (brillo del ribete) | `#E9B872` | |
| Crema (fajín, forro, camisa) | `#EDE6D6` | |
| Cuero (cinturones, botas) | `#4A3328` | |
| **Acento Éter** | `#7FF5FF` | Solo en detalles pequeños: líneas, colgante, mechón |
| Pelo base (plata ceniza) | `#D5DCE6` | |
| Pelo sombra (interior) | `#8E9AB4` | Plata azulada |
| Pelo mechones Éter | `#7FE6E8` | Solo puntas, lado izquierdo |
| Ojos (iris) | `#E8A33C` | Ámbar |
| Piel base | `#F6DCC8` | |
| Piel sombra | `#E8B7A6` | Rosada y cálida, nunca gris |
| Contorno (outline) general | `#2A2433` | |

**Regla de color:** 3 colores grandes (verde azulado, azul tinta y crema) + cobre para el metal + cian Éter **solo** en detalles (menos del 5 % de la superficie).

**Motivo:** hexágonos. Los cierres, la hebilla y el colgante son hexagonales. El ribete del abrigo lleva una cenefa de hexágonos pequeños.

---

## 1. Crear el modelo base

1. Abre VRoid Studio 2.16.
2. Pantalla de inicio: **Create New (Crear nuevo)**.
3. Elige el cuerpo base **Male (Masculino)**.
4. Se abre el editor con las pestañas arriba: **Face (Cara)**, **Hairstyle (Peinado)**, **Body (Cuerpo)**, **Outfit (Ropa)**, **Accessory (Accesorios)** y **Look (Aspecto)**.
5. **File → Save As (Guardar como)** → `kael`.

---

## 2. Cuerpo (pestaña **Body**)

Abre **Body → Body Shape (Forma del cuerpo)**. Kael es esbelto y atlético, de hombros algo anchos y piernas largas: proporción de unas **7 cabezas** (estilo de RPG anime de mundo abierto, no chibi).

| Deslizador | Valor | Por qué |
|---|---|---|
| Height (Altura) | **72** (≈ 174 cm) | Más alto que Lyra y Toma; más bajo que Hesk |
| Head Size (Tamaño de cabeza) | **42** | Cabeza algo más pequeña = proporción heroica |
| Neck Length (Largo del cuello) | **55** | |
| Neck Width (Grosor del cuello) | **40** | |
| Shoulder Width (Ancho de hombros) | **60** | Silueta de "V" |
| Chest / Bust (Pecho) | **45** | |
| Waist (Cintura) | **38** | Cintura estrecha bajo el abrigo |
| Hip Width (Cadera) | **42** | |
| Arm Length (Largo de brazos) | **52** | |
| Hand Size (Tamaño de manos) | **48** | |
| Leg Length (Largo de piernas) | **62** | Piernas largas = silueta de protagonista |
| Thigh (Muslo) | **42** | |
| Calf (Pantorrilla) | **45** | |

* **Skin color (Color de piel):** en **Body → Skin (Piel)** pon el color base `#F6DCC8`. Si hay un campo de sombra de piel (**Shade color**), pon `#E8B7A6`.

---

## 3. Cara (pestaña **Face**)

### 3.1 Punto de partida
1. **Face → Face Set (Conjunto de cara)**: elige el preset masculino de **ojos más rasgados y serenos** (no el más infantil ni el de ojos redondos). Si dudas, el segundo o el tercer preset masculino.
2. A partir de ahí ajusta lo siguiente.

### 3.2 Forma de la cara (**Face → Face Shape / Contorno**)
| Deslizador | Valor |
|---|---|
| Face width (Ancho de cara) | **44** |
| Chin length (Largo del mentón) | **58** (mentón algo afilado) |
| Chin width / Jaw (Mandíbula) | **36** |
| Cheek (Mejillas) | **40** (poco redondeadas: no es un niño) |

### 3.3 Ojos (**Face → Eyes**)
Kael tiene una **mirada tranquila y algo melancólica**, con párpados un poco caídos y la mirada al frente.

| Deslizador | Valor |
|---|---|
| Eye Size (Tamaño) | **55** |
| Eye Height / Vertical (Alto del ojo) | **40** (ojo algo rasgado) |
| Eye Width (Ancho) | **58** |
| Eye Position up/down | **48** |
| Eye Spacing (Separación) | **50** |
| Eye Corner / Tilt (Inclinación del rabillo) | **46** (ligeramente hacia abajo = sereno) |
| Upper eyelid (Párpado superior) | **58** (algo caído) |
| Iris Size (Tamaño de iris) | **56** |
| Iris Height | **54** |

**Texturas de los ojos (Edit Texture / Editar textura):**
1. **Iris:** haz clic en el icono de pincel de **Iris → Edit Texture**.
   * Capa base: rellena el iris con `#E8A33C` (ámbar).
   * Mitad superior del iris: un degradado más oscuro, `#9A5A1C`, del borde superior hasta la mitad (pincel suave de tamaño grande, opacidad 60 %).
   * Anillo exterior del iris: un trazo fino de `#5A3412`.
   * Pupila: `#3A1E0C`, pequeña y vertical.
   * **Detalle de firma:** un anillo fino `#7FF5FF` (cian Éter) alrededor de la pupila, opacidad 50 %. Es el eco del Núcleo y debe verse **solo de cerca**.
   * Mitad inferior: un reflejo suave `#FFD38A` (opacidad 40 %).
2. **Eye Highlight (Brillo del ojo):** elige el preset con **un brillo grande arriba y uno pequeño abajo**. Color del brillo: `#FFFFFF`. Si se puede cambiar el color del brillo pequeño, ponlo en `#BFFBFF`.
3. **Eye White (Blanco del ojo):** `#F7F4F2`, con la sombra superior en `#D9D4E3`.
4. **Eyeline / Eyelash (Delineado / Pestañas):** elige un delineado **grueso arriba con una pequeña "cola" en el rabillo exterior**. Color `#2A2433`. Pestañas inferiores: casi ninguna (opacidad baja o el preset más fino).

### 3.4 Cejas (**Face → Eyebrows**)
* Preset: **rectas y finas, algo inclinadas hacia arriba en el extremo exterior**.
* Color: `#8E9AB4` (más oscuro que el pelo, para que se lean).
* Position up/down: **54**. Grosor: **40**.

### 3.5 Nariz y boca
* **Nose (Nariz):** el preset **más pequeño** (solo un punto de sombra). Size: **35**.
* **Mouth (Boca):** preset **neutro, pequeño y cerrado**. Width: **42**. Color de labios: el de la piel; no hagas que resalten.

### 3.6 Orejas
* **Ears (Orejas):** normales (no élficas). Size: **48**.

---

## 4. Pelo (pestaña **Hairstyle**)

**Objetivo de la silueta:** pelo corto, desordenado y con volumen arriba. Flequillo partido en mechones afilados que **tapan parcialmente el ojo derecho**. Mechones laterales largos que enmarcan la cara (el **izquierdo** más largo). Una **coleta baja y fina** en la nuca que cae hasta los omóplatos. Un **ahoge** (mechón rebelde) arriba. Dos o tres mechones de **color Éter** en el lado izquierdo.

### 4.1 Preset de partida
1. **Hairstyle → Hairstyle (Peinado)** y haz clic en la lista de presets.
2. Elige un **preset masculino corto en capas, con flequillo largo** (de los que tienen mechones en punta cayendo sobre la frente). Si hay uno con "wolf cut" o mechones desordenados, mejor.
3. Pulsa **Edit Hairstyle (Editar peinado)** para abrir el editor de mechones. Verás grupos: **Front Hair (Flequillo)**, **Back Hair (Pelo trasero)**, **Base Hair (Base)** y, si los hay, **Side/Other**.

### 4.2 Base Hair (Pelo base / cuero cabelludo)
* Selecciona **Base Hair** y elige la base **corta con raya ligeramente a la derecha**.
* Color de la base: el mismo del pelo (lo pondremos en 4.7).

### 4.3 Flequillo (**Front Hair**)
Edita el grupo de flequillo. Cada mechón es un "hair guide" que puedes seleccionar y mover.
1. Debes tener **7 mechones** de flequillo: borra o duplica (**Duplicate**) hasta tener 7.
2. Forma de cada mechón: **punta afilada** (sube **Tip Sharpness / Punta** a **85**) y **grosor medio** (**Thickness / Grosor** **55**).
3. Longitudes (de la izquierda del personaje a la derecha):
   1. Mechón 1 (lado izquierdo, junto a la sien): hasta el pómulo.
   2. Mechón 2: hasta la mitad del ojo.
   3. Mechón 3: hasta la ceja.
   4. Mechón 4 (centro): hasta la punta de la nariz, **curvado hacia la derecha**.
   5. Mechón 5: **cruza el ojo derecho** hasta el pómulo (es el mechón de firma).
   6. Mechón 6: hasta el párpado inferior derecho.
   7. Mechón 7 (sien derecha): hasta la mandíbula.
4. **Desactiva la simetría** para que izquierda y derecha no coincidan.
5. Dale a todo el flequillo una curva hacia fuera en las puntas (**Curl / Rizo** **20**) para que las puntas se separen de la cara.

### 4.4 Mechones laterales (dentro de **Front Hair** o **Side**)
* **Izquierdo:** un mechón largo y fino delante de la oreja que llega **hasta la clavícula**. Grosor **40** y punta **90**.
* **Derecho:** uno igual pero **más corto, hasta la mandíbula**.
* Esta asimetría es clave en la silueta de Kael: no la iguales.

### 4.5 Pelo trasero (**Back Hair**)
1. Volumen: mechones cortos en capas que cubren la nuca, **en punta hacia abajo y hacia fuera** (como plumas). Necesitas **10–12 mechones** en dos capas:
   * **Capa interior** (más corta, hasta la nuca), que tomará el color de sombra.
   * **Capa exterior** (algo más larga, hasta la base del cuello) con las puntas abiertas hacia fuera (Curl **25**).
2. **Coleta baja de firma:** añade un grupo nuevo (**Add Group / Añadir grupo**) en la nuca. Haz una **coleta fina y larga** (3 mechones juntos) que caiga **hasta los omóplatos**, con la punta afilada. Átala con un anillo (lo añadiremos como accesorio en Blender/Three.js; por ahora deja un espacio de 2 cm bajo la nuca).
3. Activa **física (Sway / Bones)** en la coleta y los mechones laterales: en el panel del grupo, **Hair Swaying / Bones → Add (Añadir huesos)**. Rigidez (Stiffness) **0.4**, gravedad **0.3**.

### 4.6 Ahoge (mechón rebelde)
* Añade un mechón suelto en la coronilla que **sube y se curva hacia atrás** en forma de "?". Longitud unos 8 cm, grosor **30**, punta **95**.
* Físicas: rigidez **0.7** (que se mueva un poco, no que flote).

### 4.7 Color y material del pelo
Selecciona el material del pelo (**Hair → Material / Edit Texture**):
| Campo | Hex |
|---|---|
| Base color (Color base) | `#D5DCE6` |
| Shade color (Color de sombra) | `#8E9AB4` |
| Highlight / Specular (Brillo) | `#FFFFFF` (intensidad **0.5**) |
| Rim / Outline (si aparece) | `#5E6A86` |

**Textura del pelo (Edit Texture):**
1. En la capa base, **degradado de raíz a punta**: raíz `#B9C3D3` y puntas `#E6ECF3`. Así la raíz queda más oscura.
2. **Anillo de brillo ("angel ring"):** en una capa nueva, pinta una **banda horizontal en zigzag** a un 25 % de la longitud desde la raíz, color `#FFFFFF` con opacidad 70 % y bordes duros. Es el brillo típico del anime.
3. **Mechones Éter (solo lado izquierdo, desactiva la simetría):** elige **2 mechones del flequillo izquierdo** y **1 mechón lateral izquierdo**. Pinta su **último tercio** con un degradado de `#D5DCE6` a `#7FE6E8`. **No** pintes más de 3 mechones.
4. Capa interior del pelo trasero: más oscura, `#A3AEC4`.

---

## 5. Ropa (pestaña **Outfit**)

Kael viste de viajero: **abrigo largo de viaje verde azulado**, abierto, con **cola dividida en dos** detrás; túnica interior azul tinta de cuello alto; fajín crema asimétrico; pantalón ajustado; botas altas de cuero; guantes sin dedos. Las capas se ven en este orden, de dentro hacia fuera: túnica → fajín → cinturones → abrigo.

### 5.1 Tops (Parte de arriba)
1. **Outfit → Tops** y elige el preset de **abrigo o chaqueta larga (coat / long jacket)**. Si no hay abrigo largo, elige la chaqueta con el bajo más largo.
2. Ajustes:
   * **Hem Length / Largo del bajo:** **90–100** (hasta las rodillas o debajo).
   * **Sleeve Length (Largo de manga):** **100** (mangas largas).
   * **Collar (Cuello):** el más **alto** disponible (cuello mao/levantado).
   * **Front opening (Abertura delantera):** abierto (si existe la opción).
3. **Recolorear (Edit Texture):**
   * Capa base del abrigo: `#1F6F78`. Sombra: `#14495A`.
   * **Forro** (interior visible cuando el abrigo se abre): `#EDE6D6`.
   * **Ribete cobre:** con el pincel duro de 6–8 px, traza una **línea de 1 cm** a lo largo de todo el borde delantero, el bajo, los puños y el cuello, en `#C9893F`, y una línea fina de brillo `#E9B872` dentro.
   * **Cenefa de hexágonos:** justo por dentro del ribete del bajo, pinta una fila de **hexágonos pequeños (1,5 cm)** en contorno `#C9893F`, separados 1 cm. Si te resulta difícil a mano, pinta rombos: también se leen como motivo.
   * **Costuras Éter:** una línea **muy fina** (2 px) `#7FF5FF` que baja por la espalda desde los omóplatos hasta la cintura, como una "vena" luminosa. Solo esa línea.
   * **Cola dividida:** en la parte trasera, pinta con **transparencia (borrador / alpha)** una ranura vertical desde el bajo hasta la cintura, en el centro de la espalda, para que el abrigo forme **dos colas**. Si tu versión no permite transparencia en la ropa, pinta la ranura con `#2A2F45` (se leerá como abertura).
   * **Asimetría:** el **puño izquierdo** lleva doble ribete cobre y el derecho uno solo.
4. Activa **física** en el bajo del abrigo si aparece la opción (**Skirt / Hem swaying**).

### 5.2 Camisa / túnica interior
Si el preset de Tops permite capa interior (**Inner / Shirt**), usa una camisa de **cuello alto**. Si no, pinta la zona del pecho visible del abrigo así:
* Túnica `#2A2F45`, cruzada en diagonal de la cadera izquierda al hombro derecho.
* Borde de la túnica en `#C9893F` (línea fina).
* **Dos correas** cruzadas en "X" sobre el pecho en `#4A3328`, con una hebilla **hexagonal** cobre en el cruce (dibuja un hexágono de 3 cm `#C9893F` con el centro `#2A2F45`).

### 5.3 Bottoms (Parte de abajo)
1. **Outfit → Bottoms** y elige **pantalón ajustado largo (slim pants)**.
2. Color `#2A2F45` y sombra `#1A1D2E`.
3. Detalle: una **banda cobre fina** en la rodilla izquierda solamente (asimetría).

### 5.4 Fajín (sash)
VRoid no tiene fajín propio. Hazlo pintando en la textura de la parte superior **o** del pantalón, a la altura de la cintura:
* Fajín crema `#EDE6D6` de 8 cm de ancho, **anudado a la izquierda**, con **dos tiras que cuelgan** por el muslo izquierdo hasta medio muslo. Si tienes **Accessory → Waist / Ribbon (Lazo)**, usa un lazo en la cadera izquierda con las tiras largas y colorea el lazo en `#EDE6D6`.
* Encima, **cinturón** de cuero `#4A3328` con hebilla hexagonal `#C9893F`.

### 5.5 Shoes (Calzado)
1. **Outfit → Shoes** y elige **botas altas (long boots) hasta debajo de la rodilla**.
2. Color `#4A3328`, con la suela y la puntera en `#2E211A`.
3. Pinta **dos correas** horizontales en cada bota con hebilla cobre `#C9893F`. En la bota izquierda, una tercera correa más arriba (asimetría).
4. Borde superior de la bota con doblez en `#5E4436`.

### 5.6 Gloves (Guantes)
1. **Outfit → Gloves** y elige **guantes cortos sin dedos (fingerless)**. Si no hay, usa guantes cortos normales.
2. Color `#2A2F45` con el puño en `#4A3328`.
3. **Mano derecha** (la de la espada): pinta una placa hexagonal pequeña en el dorso `#C9893F`.

---

## 6. Accesorios en VRoid (pestaña **Accessory**)

Añade solo lo que VRoid tiene; lo demás se añade después en Blender/Three.js (sección 8).
1. **Pendiente (earring) en la oreja izquierda:** si hay **Accessory → Earring**, uno **largo y colgante** en la oreja izquierda solamente. Color `#C9893F`. La gema la cambiaremos en Three.js por un cristal cian.
2. **Colgante:** si hay **Necklace (Collar)**, uno de **cordón corto** con una pieza colgando. Color del cordón `#4A3328` y pieza `#7FF5FF`.
3. **Nada más aquí**: los cierres del abrigo, la espada y el cristal agrietado van en la sección 8.

---

## 7. Aspecto (pestaña **Look**)

Estos ajustes dan el acabado de "anime de estudio" y se exportan como MToon (el motor los reajusta un poco, pero conviene partir de aquí).

1. **Outline (Contorno):** actívalo para **pelo, cuerpo, cara y ropa**.
   * Width (Grosor): **0.25–0.35** (o "fino"; que no parezca dibujo de cómic grueso).
   * Color: `#2A2433` para la ropa y el cuerpo, y `#5E6A86` para el pelo (más suave, para que el pelo plateado no se ensucie).
2. **Shading / Shadow (Sombreado):** toony alto (sombras de borde nítido). Si hay deslizador **Shading Toony**, **0.9**. **Shadow Shift** **−0.05**.
3. **Rim Light (Luz de borde):** suave. Color `#FFF1DC`, intensidad **0.3**.
4. **Shade color de la ropa:** como en la tabla de paleta (sombras frías y azuladas, nunca grises).

---

## 8. Accesorios de firma que añadiremos después (Blender / Three.js)

**No intentes hacerlos en VRoid.** Se montan sobre los huesos del VRM en el motor:
1. **Cristal afinador agrietado (colgante):** un hexágono alargado de cristal cian `#7FF5FF` (de 4 cm) con una grieta dorada, sobre el pecho y colgando del cordón. Brilla suavemente (emisivo) y **late** cuando Kael lanza habilidades.
2. **Cierres del abrigo:** tres **cierres hexagonales de cobre** `#C9893F` en el lado izquierdo del abrigo, unidos por cadenitas cortas al lado derecho (el abrigo nunca se cierra del todo).
3. **Hombrera-capa corta asimétrica:** una media capa en el **hombro izquierdo** de tela `#1F6F78` con ribete cobre y forro crema, que cae hasta el codo. Es la pieza que hace reconocible la silueta de Kael desde lejos.
4. **Espada corta de un filo:** hoja recta de 60 cm `#DDE6EE` con una línea de runas `#7FF5FF` grabada, guarda hexagonal cobre y empuñadura envuelta en cuero `#4A3328`. Envainada en la **cadera izquierda**, en diagonal; vaina `#2A2F45` con contera cobre.
5. **Pendiente:** en la oreja izquierda, una gota de cristal cian que cuelga de un aro cobre.
6. **Anillo de la coleta:** un aro cobre con un pequeño hexágono.
7. **Seis cuentas de Resonancia** en el cordón del colgante (una por elemento, apagadas): Pyra `#FF6A3D`, Aqua `#3DA9FF`, Terra `#C79A4B`, Volt `#B46BFF`, Zephyr `#5FE8B0` y Crya `#A8E6FF`.

---

## 9. Expresiones (pestaña **Face → Expression**, si tu versión la tiene)

El motor usa las expresiones VRM estándar: **blink, happy, angry, sad, relaxed, surprised, aa, ih, ou, ee, oh**. VRoid las genera solas; revisa solo que:
* **blink** cierre los ojos del todo sin que las pestañas atraviesen la piel;
* **happy** sea una sonrisa leve (Kael es contenido): si puedes ajustar su intensidad, déjala al **70 %**.

---

## 10. Exportar a VRM 1.0

1. Arriba a la derecha, haz clic en el icono de **cámara/exportar** (**Camera/Exporting**) y luego en **Export (Exportar)**.
2. Elige **Export as VRM (Exportar como VRM)**.
3. Cuando pregunte la versión, elige **VRM 1.0** (no "VRM 0.0").
4. **Pose/Expresión de previsualización:** déjala por defecto.
5. **Reducción (Polygon reduction / Material reduction):**
   * **Reduce polygons:** reducción **baja** o ninguna (presupuesto: 20 000–40 000 triángulos).
   * **Hair mesh reduction:** **50 %** si el pelo pasa de 15 000 triángulos.
   * **Material reduction / Texture atlas:** **activado**, materiales en **8** o menos, atlas de **2048 × 2048**.
   * **Delete transparent meshes:** sí.
6. **Metadatos (Avatar information):**
   * Avatar name: `Kael Arden`
   * Author: tu nombre o `AETHERIA`
   * Version: `1.0`
   * Permisos: los que quieras (es un proyecto privado). Se recomienda "Only Author" para "Avatar use".
7. Pulsa **Export** y guarda en:
   **`C:\Users\gabs0\Downloads\atheria\web\assets_src\vroid\kael.vrm`**
   (el nombre debe ser exactamente `kael.vrm`, en minúsculas).
8. **Listo.** Con el servidor de desarrollo en marcha, el juego detecta el archivo automáticamente y recarga la página: Kael aparecerá con su VRM en lugar del modelo provisional. Para la versión final (build), ejecuta `node tools/characters/sync.mjs` para copiarlo a `public/assets/characters/`.

### Comprobación rápida
Abre `http://127.0.0.1:5173/character_lab.html?shot=kael` y comprueba:
* [ ] El mechón 5 del flequillo cruza el ojo derecho.
* [ ] El mechón lateral izquierdo es más largo que el derecho y hay 2–3 puntas cian solo a la izquierda.
* [ ] El abrigo llega a la rodilla, con ribete cobre y dos colas detrás.
* [ ] El fajín crema está anudado a la izquierda y la bota izquierda tiene 3 correas.
* [ ] El contorno se ve fino y limpio; las sombras son azuladas, no grises.
