# Project FIELD — Fútbol arcade / Vibecoded - Alejandro Sánchez Gómez

Juego de fútbol 2D original para navegador, construido con Canvas 2D, JavaScript y CSS. No necesita paquetes, compilación ni motor externo.

Incluye partidos contra BOT a cinco goles, modo entrenamiento, y un selector de competiciones con cinco opciones: Champions, Liga Nacional, Mundial, Eurocopa y Copa América. Los tres torneos tienen cuadros de 16 participantes y cuatro rondas; la liga cuenta con 16 jornadas. En la Liga puedes configurar si cada partido va a dos, tres o cinco goles. Las victorias competitivas otorgan 100 XP; el progreso queda guardado localmente hasta el nivel 100.

La primera vez que se elige un modo, se solicita un equipo, nombre y dorsal antes de empezar. El perfil se guarda en el dispositivo; las siguientes partidas arrancan directamente. El selector muestra un equipo cada vez, con flechas para recorrer la competición o región elegida. Los clubes aparecen con el sufijo CF y sin escudos; las selecciones usan paletas de color originales sin banderas ni escudos.

La Liga Nacional permite escoger LaLiga, Premier League, Serie A, Ligue 1 o Bundesliga y sortea 16 rivales de esa competición. La Copa Champions fija Barcelona, Real Madrid, PSG, Mónaco, Borussia Dortmund, Bayern, Inter y Milan; completa el cuadro con clubes aleatorios de las cinco ligas. El Mundial mezcla selecciones de Europa y América; Eurocopa y Copa América limitan el sorteo a sus regiones. Cada torneo cuenta con un trofeo vectorial y un diseño de campo propio.

España incluye también Primera Federación (2 grupos de 20) y Segunda Federación (5 grupos de 18) de la temporada 2026/27, según la composición oficial de la RFEF. Cada grupo es una liga jugable propia, con valoración de 2 estrellas, y sus clubes no se sortean como rivales de la Champions.

El BOT conserva tres dificultades; Difícil se desbloquea en el nivel 5. Las competiciones guardan automáticamente la jornada o ronda y el estado del partido para continuar desde el menú principal. El disparo normal sale radialmente desde el jugador; el disparo de fuego es más potente y se recarga cada tres segundos.

## Cuenta y guardado en la nube con Supabase

La cuenta permite registrarse e iniciar sesión con correo y contraseña. Al iniciar sesión se sincronizan nombre, equipo, dorsal, ajustes, nivel, experiencia, estadísticas, goles, trofeos y la competición pendiente. El modo invitado conserva sus datos localmente; cada cuenta tiene un espacio independiente. Supabase Auth gestiona las cuentas y Postgres guarda el perfil protegido mediante Row Level Security.

### Configuración de Supabase

1. Crea un proyecto en Supabase y abre **SQL Editor**.
2. Ejecuta el contenido de `supabase/schema.sql`. Crea la tabla de perfiles, limita cada fila a su propietario y define la función segura de guardado.
3. El proyecto FIELD ya lleva la URL y la clave **Publishable** configuradas. Son valores públicos de navegador; RLS restringe el acceso a los perfiles propios. Nunca pongas la clave `secret` o `service_role` en el cliente.
4. En Supabase **Authentication → URL Configuration**, añade el dominio de producción de Netlify a las URL permitidas. En Authentication → Sign In / Providers, mantén activado el registro por correo y desactivado Confirm email para entrar inmediatamente al crear la cuenta. El online requiere una cuenta y un nombre de usuario único; el acceso anónimo no está habilitado.

Para cambiar de proyecto Supabase, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (local) o en las variables de Netlify. Ejecuta `npm install` y `npm run dev` para desarrollo local.

## Ejecutar localmente

Instala las dependencias y crea el juego compilado:

```bash
npm install
npm run build
```

Para probarlo como archivos estáticos, sirve `dist` con cualquier servidor local. Para probar las funciones, ejecuta `npm run dev` con el proyecto enlazado a Netlify.

## Publicar en Netlify

Importa el repositorio conectado a Netlify. El `netlify.toml` configura `npm run build` y `dist`. La autenticación y base de datos viven en Supabase, así que configura las dos variables de entorno anteriores antes del despliegue de producción.

## Controles

- `WASD` o flechas: moverse.
- `Espacio`: golpear cuando estés cerca de la pelota.
- `Esc` o botón `Ⅱ`: pausar o reanudar.
- Desde la pausa, “Guardar y salir al menú” conserva el partido de Liga o Champions.

La trayectoria de la pelota se activa en Ajustes (también aparece en el control rápido de entrenamiento). En entrenamiento puedes reiniciar la posición del jugador o de la pelota.

## Arquitectura

- `src/game/Game.js`: bucle `requestAnimationFrame`, reglas, marcador y reinicios.
- `src/game/Progression.js`: experiencia y niveles persistentes hasta el nivel 100.
- `src/game/CompetitionSave.js`: guardado local de la competición y el estado del partido.
- `src/game/CareerProfile.js`: estadísticas, goles y vitrina de trofeos, con contadores por dispositivo para combinar sesiones.
- `src/game/Competitions.js`: selector y sorteos de Champions y torneos internacionales, más calendario de rivales de liga.
- `Player.js`, `Ball.js`, `Physics.js`: entidades y física 2D.
- `BotAI.js`: decisiones basadas en el estado actual y configuración de dificultad.
- `Input.js`, `Renderer.js`, `GameState.js`, `Sound.js`: controles, dibujo, estado y efectos.
- `src/ui/UI.js`: navegación, HUD, editor y ajustes.
- `src/account/AccountService.js`: registro, inicio y cierre de sesión y sincronización del perfil.
- `supabase/schema.sql`: tabla de perfiles, políticas RLS y guardado autenticado de progreso.
- `src/account/AccountService.js`: registro, inicio/cierre de sesión y sincronización de perfiles con Supabase.
- `src/config/settings.js`: valores de juego y persistencia en `localStorage`.

Los efectos de sonido se sintetizan en el navegador; pueden sustituirse por archivos de audio dentro de `Sound.js` si se agregan recursos más adelante.

El BOT cambia entre presión ofensiva y cobertura del arco; ajusta reacción, velocidad y precisión según dificultad. Los dos jugadores también rebotan y se separan físicamente al chocar. El campo de nombre ignora los atajos del juego mientras está enfocado, así puedes escribir cualquier letra sin restricción.


## Actualizaciones de Windows (desde 1.2.0)

Desde Portable 1.2.1 aparece «Buscando actualizaciones» antes del juego. La versión Portable comprueba al abrirse el paquete `game-update.json` de la publicación `windows-latest` de este repositorio. Descarga, verifica y aplica las nuevas versiones antes de abrir el juego. Si falla la conexión, muestra un aviso y abre la copia local. Juego → Buscar actualizaciones permite comprobarlo manualmente y reiniciar cuando esté preparado.

La descarga se verifica con el SHA-256 publicado por GitHub y el de cada archivo. Un fallo de red o una descarga incompleta conserva la copia anterior. Se mantienen el mismo origen local y la carpeta de perfil, por lo que no se borran experiencia, ajustes ni competiciones. El juego actualizado queda disponible sin conexión. Cada compilación correcta de Windows publica el paquete después de probarlo.

Las versiones 1.1.1 y anteriores requieren descargar una vez Portable 1.2.0. Este sistema actualiza el juego; una actualización futura de Electron o del propio lanzador requiere descargar un nuevo ejecutable. En Portable, la actualización se guarda en el perfil de Windows de ese ordenador, por lo que al llevar el EXE a otro equipo se descargará allí de nuevo.

Por el momento solo se genera y publica Portable; no se distribuye una versión instalable.


## Online con identidad, amigos y modos de juego

Se requiere una cuenta y un nombre de usuario único (3–20 letras, números o guiones bajos, sin distinguir mayúsculas). Las cuentas anteriores conservan su progreso y deben reservar un usuario disponible para entrar al nuevo online. El usuario se muestra junto al equipo, dorsal y nivel.

- Ranked: búsqueda pública de rival, 500 ELO iniciales, K=32 y resultado confirmado por ambos participantes. Abandonar cuenta como derrota. La base de datos actualiza los dos ELO una sola vez; los clientes no pueden escribirlos directamente.
- Partido rápido: público por búsqueda o privado por código, sin ELO.
- Torneo: público o privado por código, cuatro participantes, dos semifinales y una final; sin ELO.
- Amigos: añadir por usuario, aceptar/declinar amistad, invitar a partido privado y aceptar/declinar invitaciones. Las invitaciones caducan a los cinco minutos.

Todos los modos online usan las reglas por defecto, a cinco goles. Los modificadores de preferencias y de mensajes recibidos no cambian estas reglas. Los canales de partida son privados y se autorizan solo para sus dos participantes.

`supabase/online.sql` añade el esquema privado y el RPC autenticado. Las tablas no están expuestas al cliente. `supabase/online-test.sql` prueba los flujos con cuentas temporales dentro de una transacción que se revierte. No se asignan usuarios a cuentas existentes automáticamente.

Después se ejecutan, en este orden, `supabase/online-rematch.sql` (revancha) y `supabase/online-teams.sql` (2v2 en partido rápido y Ranked, y torneos de 4, 6 u 8 jugadores). Sus pruebas son `supabase/online-rematch-test.sql` y `supabase/online-teams-test.sql`, que también se revierten. El cliente solo muestra las opciones 2v2 y de tamaño de torneo cuando la base de datos ya tiene `online-teams.sql`. Por último, `supabase/online-swap.sql` permite intercambiar de equipo en una sala 2v2 privada llena (prueba: `supabase/online-swap-test.sql`); el botón «Cambiar» solo aparece cuando la base de datos lo tiene. Después van `supabase/online-profiles.sql` (búsqueda de jugadores y perfiles públicos; prueba: `supabase/online-profiles-test.sql`) y `supabase/online-bots.sql` (bots que completan las salas públicas tras 16 s de búsqueda; prueba: `supabase/online-bots-test.sql`). Sin `online-bots.sql` el cliente no pide bots y la búsqueda sigue como antes. `supabase/online-bots-2.sql` (después; prueba: `supabase/online-bots-2-test.sql`) hace que los bots acepten la revancha una de cada tres veces y permite que abandonen tras un gol.

La simulación sigue siendo entre pares con uno de los jugadores como anfitrión; la confirmación de resultados y ELO evita cambios unilaterales, pero no sustituye un servidor de simulación con protección contra trampas. Una pérdida de presencia superior a 90 segundos puede resolverse como abandono. Para entrar a esta versión del online, todos los participantes deben tener el juego actualizado.


## Mandos y audio

DualShock 4 (PS4), DualSense (PS5) y Xbox con el mapeo estándar de Gamepad API: USB o Bluetooth según el sistema. Pulsa un botón tras conectarlo. Stick izquierdo y cruceta mueven al jugador y recorren menús; ✕/A dispara o acepta, R1/R2/RB/RT dispara, ○/B vuelve y Options/Menu pausa en los modos sin conexión. La velocidad del stick es analógica, con zona muerta. Los disparos se activan al pulsar, sin repetirse al mantener el botón. El online transmite los cambios analógicos con frecuencia limitada; tiros y paradas se envían inmediatamente.

Ajustes permite configurar disparar/aceptar/volver/pausa, restablecer los botones y activar la vibración cuando esté disponible. Los campos de texto abren un teclado en pantalla con el botón de aceptar. Cambiar de ventana o desconectar el mando deja de introducir movimiento. No se requieren controladores especiales del juego; el sistema operativo y el navegador deben reconocer el mando. Las pruebas automatizadas simulan los layouts; no sustituyen pruebas físicas con cada modelo.

La playlist incluye cuatro grabaciones reales de The Cynic Project publicadas con licencia CC0 en OpenGameArt: The Charm 68, Awake! (Megawall-10), Hyperflight Racing y Hyper Ultra-Racing. Los archivos MP3 están incluidos en la web y en la portable, sin servicios externos de streaming ni descargas durante la compilación. Se normalizan a -18 LUFS y se codifican a 128 kbps para equilibrar calidad y tamaño. `src/assets/music/LICENSES.md` conserva autor, fuentes, licencia y hashes de los originales. La reproducción avanza automáticamente al acabar cada tema y se pausa durante los partidos. El ambiente de estadio y los controles de volumen independientes se mantienen. Algunos navegadores requieren un clic o una pulsación de teclado para habilitar el audio.

### Inicio de sesión con Google (web)

El botón «Continuar con Google» comprueba que el proveedor esté activo antes de redirigir. Requiere configurar Google Cloud y Supabase; el código del cliente no contiene secretos OAuth.

1. En Google Auth Platform, configura la audiencia y el consentimiento de Fútbol arcade. Crea un cliente OAuth de tipo **Aplicación web**, con los permisos básicos `openid`, `email` y `profile`.
2. Origen JavaScript autorizado: `https://alecola1991-stack.github.io`.
3. URI de redirección autorizada en Google: `https://nughauzrbwwmyumkqjez.supabase.co/auth/v1/callback`.
4. Copia el **Client ID** (termina en `.apps.googleusercontent.com`) y el **Client Secret** a Authentication → Sign In / Providers → Google en Supabase. Estos valores no son el correo ni la contraseña de Google. Activa el proveedor y conserva las comprobaciones nonce.
5. En Supabase → Authentication → URL Configuration, permite `https://alecola1991-stack.github.io/FIELD/` como URL de retorno.
6. En modo Testing, Google limita el acceso a los usuarios de prueba añadidos. Configura la audiencia de producción cuando vayas a abrirlo al público.

El inicio OAuth está preparado para la web HTTPS. La portable conserva correo y contraseña; todavía no implementa el retorno desde el navegador al ejecutable.
