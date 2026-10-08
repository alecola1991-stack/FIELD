# FIELD — fútbol arcade

Juego de fútbol 2D original para navegador, construido con Canvas 2D, JavaScript y CSS. No necesita paquetes, compilación ni motor externo.

Incluye partidos contra BOT a cinco goles, modo entrenamiento, y un selector de competiciones con cinco opciones: Champions, Liga Nacional, Mundial, Eurocopa y Copa América. Los tres torneos tienen cuadros de 16 participantes y cuatro rondas; la liga cuenta con 16 jornadas. En la Liga puedes configurar si cada partido va a dos, tres o cinco goles. Las victorias competitivas otorgan 100 XP; el progreso queda guardado localmente hasta el nivel 100.

La primera vez que se elige un modo, se solicita un equipo, nombre y dorsal antes de empezar. El perfil se guarda en el dispositivo; las siguientes partidas arrancan directamente. El selector muestra un equipo cada vez, con flechas para recorrer la competición o región elegida. Los clubes aparecen con el sufijo CF y sin escudos; las selecciones usan paletas de color originales sin banderas ni escudos.

La Liga Nacional permite escoger LaLiga, Premier League, Serie A, Ligue 1 o Bundesliga y sortea 16 rivales de esa competición. La Copa Champions fija Barcelona, Real Madrid, PSG, Mónaco, Borussia Dortmund, Bayern, Inter y Milan; completa el cuadro con clubes aleatorios de las cinco ligas. El Mundial mezcla selecciones de Europa y América; Eurocopa y Copa América limitan el sorteo a sus regiones. Cada torneo cuenta con un trofeo vectorial y un diseño de campo propio.

El BOT conserva tres dificultades; Difícil se desbloquea en el nivel 5. Las competiciones guardan automáticamente la jornada o ronda y el estado del partido para continuar desde el menú principal. El disparo normal sale radialmente desde el jugador; el disparo de fuego es más potente y se recarga cada tres segundos.

## Cuenta y guardado en la nube con Supabase

La cuenta permite registrarse e iniciar sesión con correo y contraseña. Al iniciar sesión se sincronizan nombre, equipo, dorsal, ajustes, nivel, experiencia, estadísticas, goles, trofeos y la competición pendiente. El modo invitado conserva sus datos localmente; cada cuenta tiene un espacio independiente. Supabase Auth gestiona las cuentas y Postgres guarda el perfil protegido mediante Row Level Security.

### Configuración de Supabase

1. Crea un proyecto en Supabase y abre **SQL Editor**.
2. Ejecuta el contenido de `supabase/schema.sql`. Crea la tabla de perfiles, limita cada fila a su propietario y define la función segura de guardado.
3. El proyecto FIELD ya lleva la URL y la clave **Publishable** configuradas. Son valores públicos de navegador; RLS restringe el acceso a los perfiles propios. Nunca pongas la clave `secret` o `service_role` en el cliente.
4. En Supabase **Authentication → URL Configuration**, añade el dominio de producción de Netlify a las URL permitidas. Configura el registro y la confirmación de correo según prefieras.

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
