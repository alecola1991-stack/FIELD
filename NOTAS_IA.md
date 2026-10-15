# Notas de cambios entre asistentes de IA

Registro compartido entre ChatGPT y Claude. Las entradas más recientes van arriba. El protocolo está en [`AGENTS.md`](AGENTS.md).

---

## 2026-10-15 · Claude · Ajustes divididos en secciones (Juego, Audio, Vídeo, Mandos)
**Commit:** `74cfe0f` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 74cfe0f`.
**Archivos:** `index.html`, `src/ui/UI.js`, `src/styles.css`, `NOTAS_IA.md`
**Qué y por qué:** Ale pidió dividir mejor Ajustes por categorías.
**Cómo:**
- `#settings-screen .settings-card` tiene ahora pestañas `.settings-tabs` (`data-settings-tab`: `game`, `audio`, `video`, `controls`) y paneles `section.settings-panel[data-settings-panel]`, que se ocultan con el atributo `hidden`. `UI.showSettingsTab(name)` cambia de pestaña (también con ← / →). Al arrancar se muestra Juego.
- **Se conservan todos los IDs y filas existentes**, solo movidos de sitio: `sound-enabled`, `volume`, `effects-volume`, `music-*`, `ambience-*`, `controller-*`, `settings-difficulty`, `shot-preview-enabled`, `trajectory-enabled`. El smoke test del Portable (`desktop/main.cjs`) sigue funcionando: dispara eventos sobre elementos aunque estén en un panel oculto. Comprobado en el navegador.
- Controles nuevos: `#goal-replays-enabled` (→ `settings.goalReplays`), `#vertical-field-enabled` (→ `settings.verticalField`) y `#fullscreen-toggle`, que usa la Fullscreen API y se oculta si `document.fullscreenEnabled` es falso, por ejemplo en iPhone. La pestaña Mandos incluye también una tabla de teclas (`.settings-keys`).
- CSS: bloque nuevo al final de `styles.css`.
**Para el otro asistente:** si añades un ajuste, colócalo en el panel que le corresponda y regístralo en las listas de `fillInputs()` y `bind()` de `UI.js`, donde están los pares `[id, clave]`.

## 2026-10-15 · Claude · Campo a pantalla completa, sin bandas negras y vertical en móvil
**Commit:** `b6db27f` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert b6db27f` (revierte antes `74cfe0f` si también quieres quitar sus ajustes).
**Archivos:** `src/game/Renderer.js`, `src/game/Input.js`, `src/game/Game.js`, `src/config/settings.js`, `src/ui/UI.js`, `src/styles.css`, `tests/FieldView.test.js` (nuevo)
**Qué y por qué:** Ale pidió que el partido se viera más grande y sin bandas negras.
**Cómo:**
- **CSS (bloque al final de `styles.css`):** `.game-screen` pasa a `position:fixed; inset:0` y ocupa todo el viewport (antes estaba limitada a los 1260 px de `.app-shell`). El canvas llena `.field-wrap` sin `max-height`. Como la pantalla ya no hace scroll, `.pause-overlay` tiene ahora scroll propio. En móvil horizontal se oculta parte del pie de página para ganar altura.
- **`Renderer`:** el fondo del canvas se pinta con el color `net` del tema del campo, el mismo del entorno, en lugar de `#0b1115`, así que no hay bandas. El encuadre recorta el margen vacío del mundo (`VIEW_TOP`/`VIEW_BOTTOM`: solo la franja que pueden alcanzar los cuerpos), lo que da un 7-8 % más de zoom. Toda transformación del mundo pasa por `applyWorldTransform()`.
- **Vertical (móvil en retrato):** si el canvas es más alto que ancho (×1,1), `renderer.rotated = true` y el campo se dibuja girado: la portería atacada (+x) queda arriba. En pantallas táctiles se reservan 176 px abajo (`TOUCH_CONTROLS_HEIGHT`) para que la cruceta y el botón de disparo no tapen el campo. Los nombres, dorsales, sombras y etiquetas HOME/AWAY se contra-rotan para leerse derechos. La clave de la caché del campo incluye `rotated`.
- **Controles:** `Input.axes()` devuelve ejes de mundo. Con `input.rotated`, que se asigna en `Game.loop` desde `renderer.rotated`, convierte la dirección de pantalla: arriba = hacia la portería atacada. El online envía ejes ya convertidos, así que no hay cambios de protocolo.
- **Ajuste nuevo** `verticalField` (por defecto `true`; `Game.loop` → `renderer.setAllowRotate`). Va en la sección Vídeo de Ajustes (siguiente commit).
- **Repeticiones:** en vertical, el cartel `#replay-banner` se coloca en el extremo contrario al gol (`.at-bottom`). El texto de ayuda se adapta a teclado, táctil o mando.
- Verificado en Chromium a 1280×800, 1920×1080, 390×844 (vertical) y 844×390 (horizontal), con un gol real forzado, la repetición y el salto con ESPACIO y con el botón táctil. Tests nuevos: rotación de controles, encuadre sin bandas y campo vertical libre de controles. Total: 106 OK.
**Para el otro asistente:** cualquier dibujo nuevo en el mundo debe ir dentro de `applyWorldTransform()`. Si dibujas texto, contra-rota con `if (this.rotated) c.rotate(Math.PI / 2)`. No uses `WORLD.height` para el encuadre: usa `VIEW_TOP`/`VIEW_BOTTOM`.

## 2026-10-15 · Claude · Repeticiones de gol (3 s, saltables; online requiere que salten ambos)
**Commit:** `eb1d96a` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert eb1d96a` (revierte antes `b6db27f` y `74cfe0f`, que tocan el cartel y el ajuste de repeticiones).
**Archivos:** `src/game/Game.js`, `src/game/OnlineMatch.js`, `src/game/Renderer.js`, `src/game/GamepadController.js`, `src/main.js`, `src/ui/UI.js`, `src/config/settings.js`, `index.html`, `src/styles.css`, `tests/GoalReplay.test.js` (nuevo)
**Qué y por qué:** Ale pidió repeticiones de 3 s del último gol que se puedan saltar. En online la repetición solo termina antes de tiempo si **los dos** jugadores la saltan.
**Cómo:**
- **Grabación local (`Game.js`):** `captureReplayFrame(dt)` se llama en `loop()` después de `update`/`predictOnlineGuest` y guarda los últimos 3 s (posición, orientación, `kickScale`, `powerFlash` y `spin` de jugador, rival y balón). Tras un gol (`markGoalForReplay`, llamado en `recordGoal` y en el invitado al detectar el cambio de marcador) graba 0,45 s más y sella el clip. **No se envían frames por la red.**
- **Secuencia del gol:** celebración (`goalTimer` de 1,65 s) → `startReplay()` → `updateReplay()` → `finishGoalSequence()`. Este último método contiene el código que antes estaba inline: reposicionar y cuenta atrás, o fin de partido. No hay repetición en entrenamiento ni con el ajuste `goalReplays: false` (nuevo valor por defecto `true` en `settings.js`).
- **Saltar:** ESPACIO, el botón del cartel `#replay-skip`, el botón de disparo táctil o el mando (`GamepadController` deja pasar el disparo si hay `game.replay`). Offline, un solo salto termina la repetición.
- **Online:** el anfitrión es la autoridad. `captureSnapshot(true)` añade `replay: { active, skipHost, skipGuest }`. El invitado sigue la fase con `syncGuestReplay()` y reproduce **su propio clip**. Cuando el invitado salta, envía la señal `replay-skip` (`OnlineMatch.sendReplaySkip` → `handlers.onReplaySkip` → `game.setRemoteReplaySkip`) y la reenvía cada 0,3 s hasta que `skipGuest` vuelve en el snapshot. La repetición acaba con los dos saltos o a los 3 s como máximo, así que nunca bloquea.
- **Compatibilidad:** mientras dura la repetición, el snapshot informa `goalTimer >= 0.01`, así que un invitado con versión antigua sigue esperando como en la celebración. El fin de partido del invitado espera a que acabe la repetición. Si el invitado tiene las repeticiones desactivadas, salta automáticamente.
- **Render:** `replayView()` construye cuerpos temporales desde el frame; `Renderer.render` recibe `replay: true` para oscurecer ligeramente y dibujar un marco dorado. El cartel DOM es `#replay-banner` (`UI.updateReplay`).
- Tests: `tests/GoalReplay.test.js`, con 6 casos (offline, fin natural, desactivado, entrenamiento, online con doble salto y paquete perdido, invitado desactivado y gol de la victoria). Total: 103 OK.
**Para el otro asistente:** si cambias el flujo de gol, ten en cuenta `finishGoalSequence()` y el estado `this.replay`. Para un guardado a mitad de repetición, `captureSnapshot()` mantiene `goalTimer > 0` a propósito.

## 2026-10-15 · Claude · Accesos directos a Champions y Liga + selector visual de ligas
**Commit:** `7e772a4` (rama `claude/accesos-y-selector-ligas`, fusionada en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 7e772a4`.
**Archivos:** `index.html`, `src/ui/UI.js`, `src/styles.css`, `NOTAS_IA.md`
**Qué y por qué:** Ale pidió accesos directos a Champions y Liga Nacional en el menú principal, y un selector de ligas más intuitivo que el desplegable.
**Cómo:**
- `index.html` (inicio): dos fichas nuevas tras Online, `.hub-champions` (`data-action="champions"`) y `.hub-league` (`data-action="league"`). Las fichas se renumeran de 01 a 08.
- `UI.selectMode`: los modos `champions` y `league` llaman al nuevo `openCompetitionShortcut(id)`. Este posiciona el selector de competiciones y llama a `chooseCompetition()`, así que reutiliza las comprobaciones de perfil y equipo válido y, en Liga, preselecciona la liga del club del jugador.
- Pantalla de liga: el `<select id="league-competition">` **se mantiene, pero oculto** (`hidden`). Sigue siendo la fuente de verdad y lo usan `chooseCompetition`, `savePlayer`, `beginLeague` y el smoke test del Portable (`desktop/main.cjs` espera a que tenga opciones). **No lo elimines.**
- Selector nuevo: `#league-picker`, con pestañas de país `#league-country-tabs` (`data-league-country`) y tarjetas `#league-options` (`data-league-option`, `role="radio"`). Lo pinta `renderLeaguePicker()`, que se llama al final de `updateLeaguePreview()`. Al pulsar una tarjeta, `selectLeagueOption(id)` cambia el valor del select y dispara `change` (persistencia y vista previa existentes).
- Helper de módulo `leagueTierLabel(id)`, que da 1ª/2ª/3ª/4ª CATEGORÍA. Si se añaden segundas divisiones nuevas, inclúyelas en su lista.
- `styles.css`: bloque nuevo al final. La rejilla del inicio pasa a 4 columnas (2 por debajo de 900 px), y se añaden los estilos `.league-country-tab` y `.league-option`.
- Verificado en Chromium a 1280 px y 390 px: shortcuts, cambio de país y liga, guardado en `localStorage`, sin errores JS ni elementos desbordados. 97 tests OK y build OK.
**Para el otro asistente:** el desplegable "GANAR EL PARTIDO A" (`#league-goal-target`) no se ha tocado.

## 2026-10-15 · Claude · Ligas Primera y Segunda RFEF
**Commit:** `884ba43` (rama `claude/ligas-rfef`, fusionada en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 884ba43`.
**Archivos:** `src/config/teams.js`, `src/game/Competitions.js`, `src/game/Renderer.js`, `tests/RfefLeagues.test.js` (nuevo), `README.md`, `NOTAS_IA.md`
**Qué y por qué:** Ale pidió añadir Primera y Segunda Federación de España. Se añaden 7 ligas jugables, una por grupo oficial 2026/27 (fuente: RFEF), con 130 clubes en total: Primera RFEF tiene 2 grupos de 20 y Segunda RFEF 5 grupos de 18.
**Cómo:**
- `TEAM_LEAGUES`: nuevas entradas `primera-rfef-1`, `primera-rfef-2` y `segunda-rfef-1` … `segunda-rfef-5`, insertadas tras `laliga2` y marcadas con `federation: true`. Las etiquetas siguen el formato `Primera RFEF Grupo N · España 26/27`.
- Nuevo export `FEDERATION_LEAGUE_IDS` (un `Set`) en `teams.js`, derivado de `federation: true`. Úsalo en lugar de escribir la lista a mano.
- `TEAM_COUNTRIES.spain.groups` incluye las 7 ligas, así que en el selector aparecen dentro de "España" (Ale lo pidió así).
- Equipos con `define()`, que añade " CF" como en LaLiga e Hypermotion. Los IDs siguen el formato `<liga>-<club>`, por ejemplo `primera-rfef-2-zaragoza`. **No renombrar** estos IDs: van en guardados y competiciones.
- Estrellas: la regla general de `team.stars` da **2** a todo el bloque federativo (decisión de Ale).
- `KIT_PATTERN_GROUPS`: se añaden los clubes RFEF con rayas o mitades conocidas; el resto usa el patrón por hash, como el resto de segundas divisiones.
- `Competitions.js` → `createChampionsDraw`: los clubes de `FEDERATION_LEAGUE_IDS` quedan fuera de los rivales de la Champions (antes se cogía un club de cada liga de `TEAM_LEAGUES`). Un club RFEF sí puede jugarla si es el equipo del jugador.
- `Renderer.js`: tema de campo común `RFEF_THEME` aplicado a `league-<id>` para las 7 ligas. Importa `FEDERATION_LEAGUE_IDS`.
- Trofeos: `TROPHY_CATALOG` crea automáticamente 7 trofeos "Campeón · Primera/Segunda RFEF Grupo N".
- Tests nuevos: tamaño de cada grupo, 2 estrellas, presencia en España, calendarios completos, Champions sin rivales RFEF y trofeos. Resultado: 97 tests OK; el build OK.
**Para el otro asistente:**
- Composición verificada con la RFEF (con los cambios de julio y agosto: Real Madrid C al G5, Astorga al G1, Calamocha al G2, Castellón B al G3, Puente Genil al G4 y Atlético Paso al G5).
- **Colores aproximados:** no se pudieron verificar con una fuente. Son fiables los de filiales y clubes históricos (Lugo, Mirandés, Zaragoza, Huesca, Cartagena, Hércules, Murcia, Recreativo, Xerez, Numancia, Ponferradina, Barakaldo, Sestao, Racing de Ferrol, Pontevedra, Cultural, Alcorcón, Algeciras, Ibiza, Badajoz, Salamanca, etc.). Los de los clubes pequeños de Segunda RFEF y algunos de Primera (Mérida, Coria, UD Ourense, Antequera, Teruel, Rayo Majadahonda, Juventud Torremolinos, Real Jaén, Sant Andreu, Águilas) son estimaciones: corrígelos si Ale lo pide, solo cambiando los colores, sin tocar los IDs.
- Al final de cada temporada habrá que actualizar los grupos (ascensos y descensos), sin borrar IDs que puedan estar en guardados.

## 2026-10-15 · Claude · Protocolo de notas entre asistentes
**Commit:** este mismo commit en `main`
**Archivos:** `AGENTS.md` (nuevo), `NOTAS_IA.md` (nuevo)
**Qué y por qué:** Ale trabaja en el repo con ChatGPT y con Claude. Estos archivos sirven para que cada uno sepa qué cambió el otro y cómo, sin conflictos ni trabajo repetido.
**Cómo:** solo documentación; no se ha tocado código. `AGENTS.md` es el archivo de instrucciones que leen los agentes de código.
**Para el otro asistente:** antes de trabajar, lee estas notas. Al terminar, añade tu entrada arriba con el formato de `AGENTS.md`.

Revisión del repo (sin cambios todavía, solo detectado; no hay nada empezado sobre estos puntos):
- El README dice que el tiro de fuego recarga cada 3 s y que la victoria da 100 XP. En el código son 20 s (`POWER_SHOT_COOLDOWN_SECONDS` en `Game.js`) y 50 XP por partido jugado (`Progression.js`).
- Las URLs de Google OAuth del README apuntan a `alecola1991-stack.github.io/FIELD/`, pero el juego ahora se sirve en la raíz de futarcade.es.
- La clasificación sin sesión muestra el error de Supabase: `field_online` no está concedido a `anon`.
- Código del online antiguo sin uso: `OnlineMatch.findMatch/createRoom/joinRoom`, `AccountService.recordOnlineResult/listOnlineLeaderboard` y la tabla `online_match_results`.
- `teams.js` → `KIT_PATTERN_GROUPS` contiene IDs que no existen: `europe-argentina` y `europe-usa`.
- `FIELD-Netlify-Supabase.zip` es una copia antigua del proyecto que no se usa.
- No hay `.gitignore` en la raíz.
