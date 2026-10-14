# Fútbol arcade Portable para Windows

Solo se distribuye Portable, para Windows de 64 bits. Descarga la última versión en:
https://github.com/alecola1991-stack/FIELD/releases/tag/windows-latest

Desde Portable 1.2.1 se muestra «Buscando actualizaciones» antes de iniciar. Descarga y verifica el paquete de juego publicado por GitHub; aplica las novedades en ese mismo inicio. Si falla la comprobación, muestra un aviso y abre la copia local. El menú Juego → Buscar actualizaciones permite volver a comprobarlo.

Se conservan los datos de usuario y las competiciones guardadas. La copia actualizada funciona sin internet en modos contra la IA. Online y cuentas requieren conexión. El progreso local es independiente del navegador; la misma cuenta permite sincronizarlo.

El juego se actualiza automáticamente; una actualización de Electron o del propio lanzador requiere un nuevo EXE. Pantalla completa: F11. El EXE no tiene firma digital.

## Desarrollo

Desde la raíz: `npm ci` y `npm run build -- --mode desktop`.
Después: `npm ci --prefix desktop` y `npm run start --prefix desktop`.
Genera Portable con `npm run package:win --prefix desktop`.

La acción Windows executable prueba los menús y el juego empaquetado sin internet y comprueba la descarga real del paquete publicado. Las reglas online son fijas; los modificadores se reservan a los modos sin conexión.
