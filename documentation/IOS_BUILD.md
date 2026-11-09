# Cómo instalar AETHERIA en tu iPhone (sin Mac)

La app se compila en una Mac de la nube (GitHub Actions) y tú la instalas desde tu PC con Windows.

## Una sola vez

1. **Cuenta de GitHub** (gratis): https://github.com. Crea un repositorio **privado** vacío llamado `aetheria`, sin README.
2. **Sideloadly** (gratis): https://sideloadly.io. Instálalo en Windows. Pide la versión de iTunes e iCloud de la web de Apple (no la de Microsoft Store); Sideloadly te avisa si falta.
3. El **Modo desarrollador** del iPhone se activa después del primer intento de instalación (la opción no aparece antes); ver "Instalar en el iPhone".

## Compilar

1. Sube el proyecto al repositorio (lo hace Claude con tu permiso; la primera vez Windows te pedirá iniciar sesión en GitHub).
2. En GitHub, abre la pestaña **Actions → iOS build → Run workflow**. Tarda unos 15–25 minutos.
3. Cuando termine con ✓, entra a la ejecución y descarga el artefacto **AETHERIA-iOS-unsigned**. Es un .zip que contiene `AETHERIA-unsigned.ipa`.

## Instalar en el iPhone

1. Conecta el iPhone a la PC por cable y desbloquéalo; si pregunta, toca **Confiar**.
2. Abre Sideloadly, arrastra `AETHERIA-unsigned.ipa`, escribe tu **Apple ID** y pulsa **Start**. Sideloadly firma la app con tu cuenta, y la contraseña la escribes tú directamente en Sideloadly.
3. En el iPhone: **Ajustes → General → VPN y gestión de dispositivos →** toca tu Apple ID **→ Confiar**.
4. En el iPhone: **Ajustes → Privacidad y seguridad → Modo desarrollador → Activar**. Se reinicia; al encender, confirma con **Activar** y tu código.
5. Abre AETHERIA desde la pantalla de inicio.

Con un Apple ID gratuito la app **caduca a los 7 días**. Para renovarla, repite "Instalar en el iPhone" con el mismo .ipa; tus partidas guardadas se conservan. Con la membresía de desarrollador de Apple (99 USD al año) dura un año y se puede usar TestFlight.

## Controles táctiles

- **Mitad izquierda:** joystick flotante. Empújalo hasta el borde para correr.
- **Mitad derecha:** arrastra para girar la cámara.
- **Botones:** ATK (atacar), E (habilidad elemental), » (esquivar), ▲ (saltar), USE (hablar o interactuar, aparece cuando hay algo cerca), + (curarse), ◎ (fijar objetivo), ◆ (cambiar de elemento) y ≡ (menú).
- **Diálogos:** toca la pantalla para avanzar.
