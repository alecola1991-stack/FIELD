# Fútbol arcade para Windows

Para Windows de 64 bits hay instalador (`Futbol-Arcade-Setup`: acceso directo, menú Inicio y desinstalación) y Portable (abrir sin instalar). Ambos comparten datos y actualizaciones. Descarga la última versión en:
https://github.com/alecola1991-stack/FIELD/releases/tag/windows-latest

Desde Portable 1.2.1 se muestra «Buscando actualizaciones» antes de iniciar. Descarga y verifica el paquete de juego publicado por GitHub; aplica las novedades en ese mismo inicio. Si falla la comprobación, muestra un aviso y abre la copia local. El menú Juego → Buscar actualizaciones permite volver a comprobarlo.

Se conservan los datos de usuario y las competiciones guardadas. La copia actualizada funciona sin internet en modos contra la IA. Online y cuentas requieren conexión. El progreso local es independiente del navegador; la misma cuenta permite sincronizarlo.

El juego se actualiza automáticamente; una actualización de Electron o del propio lanzador requiere un nuevo EXE. Desde 1.2.2 (Electron 44.9.1) el lanzador acepta paquetes de juego de hasta 48 MB; las versiones anteriores, hasta 12 MB. Si el juego crece por encima, esas copias seguirán abriendo su versión local hasta que se descargue el EXE nuevo.

`ads.txt` (solo para AdSense en la web) no entra en la compilación de escritorio: el paquete de actualización solo admite archivos del juego. Pantalla completa: F11. El EXE no tiene firma digital.

## Desarrollo

Desde la raíz: `npm ci` y `npm run build -- --mode desktop`.
Después: `npm ci --prefix desktop` y `npm run start --prefix desktop`.
Genera Portable con `npm run package:win --prefix desktop`.

La acción Windows executable prueba los menús y el juego empaquetado sin internet y comprueba la descarga real del paquete publicado. Las reglas online son fijas; los modificadores se reservan a los modos sin conexión.

## Firma digital

Los EXE se firman como «alecola» (Authenticode SHA-256 con sello de tiempo). Con los secretos de GitHub `WINDOWS_CERT_PFX` (el .pfx en base64) y `WINDOWS_CERT_PASSWORD` se usa ese certificado; si es de una autoridad (Certum, Sectigo, SSL.com…), Windows muestra «alecola» como editor verificado y SmartScreen deja de avisar con el tiempo. Sin ellos, la acción crea un certificado autofirmado CN=alecola: la firma aparece en Propiedades → Firmas digitales, pero Windows no la considera de confianza.

## Inicio de sesión con Google (1.3.0)

El botón de Google abre el navegador del sistema. Al terminar, Google vuelve a una dirección local que sirve el propio juego (`http://127.0.0.1:47821/auth/callback`, o los puertos 47822 y 47823 si está ocupado) y la sesión se abre en el juego (OAuth con PKCE). En Supabase → Authentication → URL Configuration → Redirect URLs deben figurar esas tres direcciones. Las copias anteriores a 1.3.0 (sin ese puente) piden descargar la versión nueva.
