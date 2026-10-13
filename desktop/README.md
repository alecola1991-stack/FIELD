# Fútbol arcade para Windows

Descarga el instalador o la versión portable en:
https://github.com/alecola1991-stack/FIELD/releases/tag/windows-latest

- `Futbol-Arcade-Setup-1.1.0.exe`: instala el juego y crea un acceso directo.
- `Futbol-Arcade-Portable-1.1.0.exe`: abre el juego sin instalar.
- Windows de 64 bits. Pantalla completa: F11.
- El juego está incluido, con modos contra la IA disponibles sin internet.
- Online y sincronización de cuenta requieren internet.
- El progreso local es independiente del navegador. Inicia sesión con la misma cuenta para sincronizar tu progreso.
- Los ejecutables no tienen firma digital; Windows puede mostrar una advertencia de editor desconocido.

Cada cambio del juego en `main` genera una nueva compilación para Windows. Para actualizar, descarga de nuevo el instalador o portable. Las partidas se guardan en los datos de usuario de la aplicación, fuera del directorio de instalación.

## Desarrollo

Desde la raíz: `npm ci` y `npm run build -- --mode desktop`.
Luego: `npm ci --prefix desktop` y `npm run start --prefix desktop`.
Para generar los dos `.exe`: `npm run package:win --prefix desktop`.

La acción `Windows executable` construye y prueba la aplicación empaquetada con las conexiones externas bloqueadas antes de publicar los archivos.

La versión 1.1 añade Modificadores en todos los modos, menús más legibles y correcciones de guardado y sincronización. Las reglas de una sala online son compartidas y no se cambian durante la partida.
