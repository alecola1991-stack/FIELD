# Notas de cambios entre asistentes de IA

Registro compartido entre ChatGPT y Claude. Las entradas más recientes van arriba. El protocolo está en [`AGENTS.md`](AGENTS.md).

---

## 2026-10-17 · Claude · Partido rápido: selector de formato e IA compañera ordenado
**Commit:** fusionado en main (rama `selector-partido-rapido`, merge e5b97fc). Para deshacerlo: `git revert -m 1 e5b97fc`
**Archivos:** `index.html`, `src/styles.css`, `src/ui/UI.js`
**Qué y por qué:** Ale pidió colocar bien dónde se elige el formato y la IA compañera en Partido rápido. Antes, según el ancho de pantalla, los selectores se montaban unos sobre otros o el botón saltaba a otra línea.
**Cómo:** `#quick-screen .match-setup-actions` pasa a llamarse `.quick-actions` y tiene tres campos `.quick-field` con la etiqueta encima (FORMATO, IA COMPAÑERA, DIFICULTAD DEL RIVAL) más el botón «Empezar partido», todos de 46 px de alto y en una sola fila en PC. En móvil van apilados a lo ancho. El campo de la IA compañera lleva `data-duo-only` y solo se ve en 2v2: `renderSoloFormat()` pone en `<body>` la clase `solo-duo`. Se han eliminado las reglas CSS anteriores de esa fila. En PC, el botón de Modificadores de esta pantalla muestra solo su nombre. Se conservan los IDs `quick-difficulty` y `quick-start` y los atributos `data-solo-format` y `data-mate-difficulty`.
**Para el otro asistente:** sin SQL. Para ocultar algo en 1v1 basta con ponerle `data-duo-only`.


## 2026-10-17 · Claude · Dificultad propia para la IA compañera
**Commit:** fusionado en main (rama `dificultad-companera`, merge f9b3e17). Para deshacerlo: `git revert -m 1 f9b3e17`
**Archivos:** `index.html`, `src/styles.css`, `src/ui/UI.js`, `src/config/settings.js`, `src/game/Game.js`, `src/game/SquadAI.js`, `tests/Duo.test.js`
**Qué y por qué:** Ale quiere elegir la dificultad de su IA compañera aparte de la del rival.
**Cómo:**
- Ajuste nuevo `settings.mateDifficulty` (por defecto 'normal'). Se elige con un selector «IA COMPAÑERA» (`[data-mate-difficulty]`) dentro del bloque de formato de Partido rápido, Liga y Copas, visible solo con 2v2 (clase `.is-duo`).
- Se desbloquea con los mismos niveles que la dificultad del rival. `UI.mateDifficulty()` devuelve la elegida o, si está bloqueada, Avanzado.
- Se pasa como `options.mateDifficulty` al empezar cada partido (también en ligas y copas, con el valor actual). `Game.setupDuo(..., mateLevel)` la entrega a `SquadAI({ mateLevel })`.
- Con su nivel cambian la velocidad, la IA de regate y tiro, y la precisión de pases y tiros de la compañera (`MATE_ERROR`).
- La etiqueta del partido muestra «2 CONTRA 2 · IA <nivel> ·».
**Para el otro asistente:** sin SQL.


## 2026-10-17 · Claude · La compañera siempre tira si recibe del jugador en campo rival
**Commit:** fusionado en main (rama `ia-tiro-tras-pase`, merge 7e498fa). Para deshacerlo: `git revert -m 1 7e498fa`
**Archivos:** `src/game/SquadAI.js`, `tests/Duo.test.js`
**Qué y por qué:** Ale pidió que, si la IA recibe el balón del jugador en el campo rival y tiene tiro, tire siempre.
**Cómo:** `trackTouches()` registra en cada actualización quién tocó el balón por último (`lastToucher`) y quién antes (`prevToucher`), por asiento. En `teammate()` se considera que el balón viene del humano si este fue el último en tocarlo y ya se ha separado del balón, o si la compañera lo controla desde hace menos de 1,2 s tras un toque del humano. En ese caso, con el balón en el campo rival y a su alcance, tira fuerte (potencia 1,25). Para apuntar, `shotLine()` elige entre primer palo, centro y segundo palo el tiro con la línea más despejada de rivales. Si ninguna línea está libre, sigue con su lógica normal. Hay un test nuevo.
**Para el otro asistente:** sin SQL.


## 2026-10-17 · Claude · IA del 2v2: pases largos de la compañera y rivales con roles, pases y paredes
**Commit:** fusionado en main (rama `ia-2v2-mejorada`, merge 02853a3). Para deshacerlo: `git revert -m 1 02853a3`
**Archivos:** `src/game/SquadAI.js`, `tests/Duo.test.js`
**Qué y por qué:** Ale pidió dos cosas. La compañera, desde su campo y con el jugador en el campo rival, debe hacer lo posible por darle el balón con un pase fuerte, por la mejor trayectoria y dejándoselo bien para disparar. Los rivales no deben defender los dos la portería: uno defiende y el otro sube a esperar el balón, se dan pases y regatean usando las paredes, sea cual sea la dificultad.
**Cómo:**
- Pases (`SquadAI`):
  - `bestPassLine()` elige la trayectoria: directa, o rebotando en la banda superior o inferior. Calcula el punto de rebote reflejando el objetivo en la banda y lo estira por la restitución vertical de 0,78. Comprueba que ningún rival corte ninguno de los dos tramos.
  - `passPower()` calcula la potencia para que el balón llegue con velocidad (el frenado del balón es lineal con la distancia, 0,72 por píxel).
  - `receivePoint()` apunta justo delante del jugador, en la línea hacia la portería, más hacia donde corre.
- Compañera:
  - Pase largo prioritario cuando ella está en su campo y el humano en el rival (`lastPass.long`). Si no tiene línea, conduce buscando una.
  - Si un rival controla el balón, se queda entre el balón y la portería conteniendo, en vez de lanzarse a por él.
- Rivales:
  - Roles fijos de portero y delantero (`rivalKeeper`). Solo se intercambian si el portero queda claramente por delante.
  - El delantero presiona hasta 0,7 del campo y nunca baja a la portería. Si atacamos en profundidad, espera arriba la contra; si su portero tiene el balón, se desmarca para recibir.
  - `rivalCarry()`: tira si está a tiro y con línea libre; si no, pasa (el portero siempre busca al delantero; el delantero devuelve el balón si le presionan); si no, regatea con la pared cuando un defensor tapa el camino; y si nada de eso, conduce.
  - La precisión del pase, la probabilidad de usar la pared y el alcance de tiro dependen de la dificultad (`RIVAL_PLAY`).
- Tests: 4 casos nuevos en `tests/Duo.test.js` (pase largo y fuerte, pase con rebote si hay un rival en medio, un solo rival en portería en las 5 dificultades, el portero pasa al delantero y el delantero usa la pared).
**Para el otro asistente:** sin SQL. `SquadAI` ya no usa `BotAI` para los rivales (sí para la compañera cuando regatea o tira). En la orden de pase, `pass: true` y `bank: true` indican el tipo de jugada.


## 2026-10-17 · Claude · Real Madrid totalmente blanco y dorsal sin borde
**Commit:** fusionado en main (rama `real-madrid-blanco`, merge 9c431d2). Para deshacerlo: `git revert -m 1 9c431d2`
**Archivos:** `src/config/teams.js`, `src/game/Player.js`, `src/game/Renderer.js`, `src/game/Game.js`, `src/ui/UI.js`, `src/styles.css`
**Qué y por qué:** Ale pidió la equipación del Real Madrid toda blanca y el dorsal sin borde negro.
**Cómo:**
- El color secundario de Real Madrid, Castilla y Real Madrid C pasa de morado a `#F7F7F7`.
- Nueva propiedad `team.numberOutline = false` para esos tres equipos (el conjunto `PLAIN_DORSAL` de teams.js). `Player` acepta `numberOutline`, y `Renderer.drawPlayer` no dibuja el contorno del nombre ni del dorsal cuando vale `false`. Game la pasa en todas las creaciones de jugadores (1v1, 2v2 online y 2v2 sin conexión).
- En las vistas previas, `paintPlayerPreview` añade la clase `.plain-dorsal`, que quita el `-webkit-text-stroke` y la sombra. El dorsal sigue en azul marino `#17274b`.
**Para el otro asistente:** para quitar el borde del dorsal a otro equipo, añade su id a `PLAIN_DORSAL`.


## 2026-10-17 · Claude · Modo 2v2 en solitario con IA compañera (rápido, ligas y copas)
**Commit:** fusionado en main (rama `modo-2v2-solitario`, merge f020a72). Para deshacerlo: `git revert -m 1 f020a72`
**Archivos:** `src/game/SquadAI.js` (nuevo), `src/game/Game.js`, `src/ui/UI.js`, `src/config/settings.js`, `index.html`, `src/styles.css`, `tests/Duo.test.js` (nuevo)
**Qué y por qué:** Ale pidió un 2v2 sin conexión: el jugador más una IA compañera que defiende y busca pasársela, contra dos IA rivales, disponible en ligas y competiciones (y también en partido rápido).
**Cómo:**
- `Game.start(mode, difficulty, { duo: true })`, en los modos bot, tournament y league, llama a `setupDuo()`, que reutiliza `setupSquad()` del 2v2 online. Asientos: 0 humano, 1 compañera «IA» (dorsal 7 u 8), 2 y 3 rivales. Cada pareja lleva su equipación; las IA van a velocidad de bot. `this.squad.offline = true` y `this.squad.ai = new SquadAI(...)`.
- `updateSquad()`: si existe `squad.ai`, los asientos 1–3 se mueven con sus órdenes (dirección, velocidad, chut con dirección `aim` y potencia `power`).
- `SquadAI`:
  - Compañera: si el humano tiene el balón, se desmarca por delante en la otra banda. Si lo ganan los rivales, defiende como portera entre el balón y la portería. Cuando tiene el balón, pasa al humano si está mejor situado y la línea está libre; si no, regatea o tira con el BotAI en espejo.
  - Rivales: uno presiona con el BotAI de 1v1 y el otro cubre la portería o espera el rechace.
  - Si el balón queda atascado contra las paredes, lo desatasca. Además, nunca chuta hacia la pared cuando el balón está pegado a la banda.
- Ajuste nuevo `settings.soloFormat` ('1v1' | '2v2'), elegible en Partido rápido, Liga y Copas. En las pantallas, `[data-solo-format]` con `UI.setSoloFormat()`/`renderSoloFormat()`.
- Ligas y copas guardan `format` al empezar (`league.format`, `tournament.format`) y mantienen ese formato toda la competición. `currentMatchOptions.duo` se guarda con la partida, así que al continuar se sigue en 2v2.
- `captureSnapshot()` sin conexión guarda `others`. `notifyReplay` solo cuenta los 4 jugadores en el online, así que offline se salta la repetición con un solo ESPACIO.
- La etiqueta del partido empieza por «2 CONTRA 2 ·» y en el marcador aparece «NOMBRE + IA».
**Para el otro asistente:** sin SQL. Las estadísticas de tiros y goles cuentan para el equipo, incluidos los de la compañera. Leyendas y Entrenamiento siguen siendo 1v1.


## 2026-10-17 · Claude · Pantalla de carga con logo, carga giratoria y protips
**Commit:** fusionado en main (rama `pantalla-carga`, merge 6a1d879). Para deshacerlo: `git revert -m 1 6a1d879`
**Archivos:** `index.html`, `src/main.js`
**Qué y por qué:** Ale pidió una pantalla de carga al entrar con el logo en blanco, un símbolo de carga girando y protips («usa las paredes», «haz disparos con rebote»…).
**Cómo:** el marcado, los estilos y el script van en línea en `index.html` (`#boot-screen`, clases `boot-*`), para que se vea antes de que cargue el JS y el CSS de la app. El logo es el SVG de `src/assets/logo.svg` en línea con `fill="currentColor"`, en blanco. Hay 12 consejos que rotan cada 3,2 s empezando por uno al azar. `main.js` llama a `window.__bootHide()` cuando la UI está montada y las fuentes listas (como mucho 1,5 s). La pantalla se muestra al menos 1,6 s, se desvanece y se elimina del DOM. Si algo falla, se oculta sola a los 15 s. Respeta `prefers-reduced-motion`.
**Para el otro asistente:** sin SQL. Si cambian mecánicas (por ejemplo, la recarga de 20 s del tiro de fuego o los niveles de desbloqueo 7 y 15), actualiza los consejos en el script de `index.html`.


## 2026-10-16 · Claude · Resto de submenús en paneles y sin scroll en PC
**Commit:** fusionado en main (rama `submenus-paneles-2`, merge 0257862). Para deshacerlo: `git revert -m 1 0257862`
**Archivos:** `index.html`, `src/styles.css`, `src/ui/UI.js`
**Qué y por qué:** Ale pidió hacer lo mismo con los demás submenús: paneles y sin scroll en PC. Comprobado sin scroll en 1366×657, 1366×768, 1280×720 y 1920×960 en todas las pantallas y en sus estados secundarios (pestañas de Ajustes, cuenta conectada, cuadros de 16 y 32 equipos, clasificación con 50 filas, misiones, vitrina desplegada).
**Cómo:**
- Competiciones: el carrusel se sustituye por paneles en `#competition-grid`, generados en `renderCompetitionGrid()`. Hay 7 competiciones con su trofeo y color, más un panel «Tu equipo». Si tu equipo no vale para esa copa, el panel avisa con «ELEGIRÁS…». El carrusel antiguo (`#competition-picker-card`) sigue en el DOM, oculto, porque `renderTournamentSetup` toma de él el emblema y el color; `competitionIndex` y `chooseCompetition()` no cambian.
- Cuadro de copa: `renderBracket(container, cup, focus, from, { mirror })` admite un modo espejo, con dos mitades que se encuentran en la final. Solo se usa en la pantalla previa (`renderTournamentRoster`) en PC (≥1024 px), así que el cuadro de 32 equipos cabe sin scroll. El cuadro del resultado de partido no cambia. La etiqueta de rondas se genera según el tamaño del cuadro.
- Clasificación: título arriba y dos paneles. El nuevo `renderLeaderboardPodium(rows)` dibuja el podio con el top 3 y tu posición; la lista tiene scroll interno. Se importa `rankFor` en UI.js.
- Misiones: paneles al estilo del menú y un resumen `#missions-summary` (completadas y XP por ganar).
- Ajustes: título en una línea (se oculta en alturas ≤820 px) y opciones en dos columnas; en Mandos, el teclado a la izquierda y el mando a la derecha.
- Perfil: la vitrina desplegada tiene scroll interno, en 6 columnas en PC.
**Para el otro asistente:** sin SQL. Los estilos van al final de `src/styles.css`. Para medir el scroll hay que esperar más de 0,4 s, porque la animación `appear` mueve 7 px la pantalla al entrar.


## 2026-10-16 · Claude · Submenús en paneles y pantallas sin scroll en PC
**Commit:** fusionado en main (rama `submenus-paneles`, merge 1b857f8). Para deshacerlo: `git revert -m 1 1b857f8`
**Archivos:** `index.html`, `src/styles.css`, `src/ui/UI.js`, `src/ui/OnlineHub.js`, `src/ui/ProfileSocial.js`
**Qué y por qué:** Ale pidió actualizar los submenús, evitar el scroll en PC y usar paneles como el menú principal en Jugar, Online y Liga nacional (ligas organizadas por países). Comprobado sin scroll en 1366×768, 1920×1080 y 1366×657 (altura útil real de un portátil con navegador), salvo pantallas con listas largas desplegadas a propósito.
**Cómo:**
- Cabecera compacta en PC (≥1024 px): la navegación de sección (`.section-nav`) se coloca a la derecha de la cabecera, en lugar de la etiqueta `.version`; títulos más pequeños. Capa extra para alturas ≤720 px.
- Jugar: la columna de texto y las tarjetas se sustituyen por 8 paneles `.hub-tile.panel-tile` (rápido, online, copas, liga, entrenamiento, leyendas, modificadores, clasificación) con los mismos `data-action`. Se mantienen `legends-mode-card`, `legends-mode-tag`, `play-continue-wrap`, `continue-competition` y `play-difficulty`. El texto de `legends-mode-tag` lleva ahora el prefijo «06 /».
- Online: las pestañas son ahora paneles (`.online-mode-tabs` con `data-online-tab`, misma lógica en OnlineHub). Cada modo se muestra en `.online-panel-card` a dos columnas (`.panel-col`): pública | privada. `#online-friends-count` pasa a ser un número en una insignia. Con sala activa, `#online-content.in-room` oculta los paneles de modo (salvo Amigos). Se quitó el párrafo «Sin modificadores…» (integrado en la descripción).
- Liga nacional: dos paneles. País (`#league-country-tabs`, ahora `.league-country-tile` con bandera CSS `.flag-<id>` y la marca «TU LIGA») y división (`#league-options`, sin cambios en su lógica), más la fila de ajustes y el botón de empezar. El select oculto `#league-competition` sigue siendo la fuente de verdad. El h2 ya no muestra «N jornadas»; esa cifra sigue en `.league-stat-rounds`. Nuevo `#league-country-name`. En móvil, al elegir un país se desplaza a las divisiones.
- Perfil: la vitrina de trofeos pasa a la nueva pestaña «Trofeos» (`data-profile-panel="trophies"`). ProfileSocial solo refresca el online en Amigos y Buscar.
- Equipo, Ajustes, Modificadores, Partido rápido, Leyendas y Champions: compactados solo con CSS en PC (identidad a la derecha del selector de equipo, modificadores a dos columnas, cuadro de Champions más compacto, etc.).
**Para el otro asistente:** sin SQL. Los estilos nuevos están al final de `src/styles.css`, en bloques `@media(min-width:1024px)` y `(max-height:720px)`. Si añades una pantalla, comprueba que cabe en 1366×657.


## 2026-10-16 · Claude · Perfil rediseñado con amigos, búsqueda de jugadores y ficha pública
**Commit:** fusionado en main (rama `perfil-amigos`, merge 7650425). Para deshacerlo: `git revert -m 1 7650425`
**Archivos:** `index.html`, `src/styles.css`, `src/ui/ProfileSocial.js` (nuevo), `src/ui/UI.js`, `src/ui/OnlineHub.js`, `supabase/online-profiles.sql` (nuevo), `supabase/online-profiles-test.sql` (nuevo), `supabase/online-swap-test.sql`
**Qué y por qué:** Ale pidió un perfil más intuitivo y visual, con amigos y búsqueda de perfiles. El perfil tiene ahora: héroe con la equipación del jugador, su @usuario con rango/ELO y un anillo de nivel; pestañas Resumen / Amigos / Buscar jugadores; en Resumen, 4 estadísticas (anillo de % de victorias), tarjeta de balance con barras (victorias/derrotas, goles a favor/en contra, tiempo, temporadas, trofeos) y tarjeta Ranked con icono y barra al siguiente rango; la vitrina muestra primero los trofeos ganados y pliega los bloqueados («Ver los N trofeos restantes»). Amigos: añadir por usuario, solicitudes (aceptar/rechazar), lista ordenada por ELO con «Invitar a jugar» (sala privada 1v1, abre el online) y «Eliminar». Buscar: por prefijo de usuario; cada fila abre la ficha pública (rango, Ranked V/D, partidos online, siguiente rango, últimos 10 resultados V/D y acciones de amistad).
**Cómo:** `ProfileSocial` (nuevo) gestiona pestañas, amigos, búsqueda y la ficha (`#player-card-overlay`, que se mueve al lado de `#ranks-overlay` al arrancar para cubrir la página). Usa `hub.rpc`/`hub.consume` y los comandos de amigos existentes. SQL: `online-profiles.sql` añade los comandos `search {query}` y `profile {username|userId}` a `field_private.action` y sube la versión a 4; `OnlineHub.consume` pone `supportsProfiles = version >= 4`. Sin la versión 4 el cliente sigue funcionando: la búsqueda muestra un aviso y las filas no abren ficha. Se mantienen los IDs `career-*` anteriores; nuevos: `career-online`, `career-level-ring`, `career-winrate-ring`, `career-goal-average`, `balance-*`, `profile-ranked`, `trophy-toggle`, `profile-*`, `player-card-*`.
**Para el otro asistente:** HAY QUE EJECUTAR `supabase/online-profiles.sql` en el SQL Editor DESPUÉS de `online-swap.sql`; su `field_private.action` pasa a ser la versión vigente (cualquier cambio futuro de `action` debe partir de este archivo). `online-profiles-test.sql` es un test con rollback. Para deshacer: revertir el merge; la función con versión 4 es compatible con clientes anteriores.


## 2026-10-16 · Claude · Pantalla «Ver rangos» en el online
**Commit:** fusionado en `main` el 2026-10-16 con la aprobación de Ale (merge `a45c442`). Para deshacerlo: `git revert -m 1 a45c442`.
**Archivos:** `index.html`, `src/ui/UI.js`, `src/styles.css`
**Qué y por qué:** Ale pidió una opción en el online para ver todos los rangos como una barra de progreso, indicando en cuál estás.
**Cómo:**
- Hay un botón nuevo en la pestaña Ranked: «Ver rangos →» (`data-action="ranks"` → `UI.selectMode('ranks')` → `UI.showRanks()`).
- Diálogo `#ranks-overlay`, al final de `<main>`, con la misma base visual que `#rank-overlay`:
  - `#ranks-you`: tu icono, @usuario, rango y ELO que te falta para el siguiente.
  - `#ranks-ladder`: un tramo igual por rango, con relleno completo en los superados, parcial en el actual (`rankProgress().ratio`) y vacío en el resto, el icono y el ELO de inicio de cada tramo, y el marcador «TÚ» debajo de la barra. En Leyenda, que no tiene techo, el marcador avanza hasta 1000 ELO.
  - `#ranks-list`: una ficha por rango con su tramo de ELO y el estado CONSEGUIDO, TU RANGO o FALTAN N.
- Sin sesión iniciada se ve la escala sin marcador.
- Se cierra con ✕, «Entendido», Escape o un clic fuera.
- Todo se calcula con `RANKS`, `rankIndex` y `rankProgress` de `src/config/ranks.js`; no hay datos fijos en la UI.
**Para el otro asistente:** si cambian los rangos, basta con tocar `RANKS`. La barra reparte un tramo igual por rango, no proporcional al ELO.

## 2026-10-16 · Claude · Rangos por ELO con iconos y pantalla de progreso tras el Ranked
**Commit:** fusionado en `main` el 2026-10-16 con la aprobación de Ale (merge `506ace1`). Para deshacerlo: `git revert -m 1 506ace1`.
**Archivos:** `src/config/ranks.js` y `src/ui/RankIcon.js` (nuevos), `src/ui/OnlineHub.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/Ranks.test.js` (nuevo)
**Qué y por qué:** Ale pidió rangos según el ELO, con un icono al lado del nombre de los jugadores en las salas y en los partidos, y una pantalla con una barra animada de progreso entre rangos tras cada partido Ranked. Rangos: Amateur (desde el inicio, 500), Profesional 550, Experto 600, Campeón 750 y Leyenda 800.
**Cómo:**
- `ranks.js` contiene `RANKS` (id, nombre, `min`, `floor` y colores), `rankFor(elo)`, `rankProgress(elo)` y `rankJourney(antes, después)`.
  - `rankProgress` va de 0 en el suelo del rango a 1 en el siguiente. Por debajo de 500 se queda en 0 y en Leyenda la barra está llena.
  - `rankJourney` devuelve los tramos que hay que animar: llenar y subir, o vaciar y bajar.
  - Todo se calcula en el cliente a partir del ELO; no hay SQL.
- `RankIcon.js` contiene `rankIconSvg(rank|elo, size)` y `rankBadge(elo, {size, withName})`. Son escudos SVG originales, de colores planos y sin degradados, para que no choquen ids al repetirse. Cuanto más alto el rango, más adornado: un galón, dos galones, estrella, laurel y corona, y alas y corona.
- **Dónde salen los iconos:**
  - En `OnlineHub`: identidad online y de cuenta, amigos, cada plaza de la sala (`seatCard`) y las líneas de los partidos (`playerNames()`, nuevo).
  - En `UI`: clasificación, nombres del marcador durante el partido y subtítulos del marcador final. Estos dos últimos usan `UI.setRankedNames(node, [{name, elo}], separador)`; en 2v2 los dos compañeros salen apilados (`.ranked-stack`).
  - `currentMatchOptions.rankedNames` guarda los nombres con su ELO para el marcador final.
- **Pantalla de progreso** (`#rank-overlay`, al final de `<main>`, `position:fixed`, z-index 60):
  - La abre `UI.showRankProgress(antes, después)` cuando `OnlineHub` confirma un partido Ranked (en `updateResultStatus`, o en `consume()` si el servidor lo resuelve por abandono mientras se juega). Se muestra una sola vez por partido (`rankShownFor`).
  - El ELO anterior es el actual menos el `eloDelta` de tu equipo (en el servidor, `eloDelta` es el del equipo izquierdo).
  - Anima tramo a tramo: el icono grande «salta» (`rank-pop`) al subir y «cae» (`rank-drop`) al bajar, el contador de ELO avanza y al final sale el mensaje (ascenso, descenso o «te faltan N ELO para…»). Respeta `prefers-reduced-motion`.
  - «Continuar» o Escape la cierran (`hideRankProgress`); también se cierra al empezar otro partido.
**Para el otro asistente:** los umbrales y nombres de los rangos están solo en `RANKS`. No pongas nombres de rango fijos en la UI; usa `rankFor`/`rankBadge`.

## 2026-10-16 · Claude · Dificultades de la IA: nombres nuevos, Profesional y Champions
**Commit:** fusionado en `main` el 2026-10-16 con la aprobación de Ale (merge `e490884`). Para deshacerlo: `git revert -m 1 e490884`.
**Archivos:** `src/config/settings.js`, `src/game/BotAI.js`, `src/ui/UI.js`, `index.html`, `tests/BotSkills.test.js` (nuevo)
**Qué y por qué:** Ale pidió renombrar las dificultades (fácil → Principiante, normal → Avanzado, difícil → Experto) y añadir Profesional y Champions. En estas dos, el rival debe hacer amagos, llevar el balón pegado antes de disparar y usar las paredes para superar al jugador y marcar.
**Cómo:**
- **Los ids no cambian** (`easy`, `normal`, `hard`, porque están en guardados y competiciones). Se añaden `pro` y `champions` a `BOT_LEVELS`, con velocidad, reacción y precisión entre `hard` y `legend` y un bloque `skills`.
- `DIFFICULTIES` (nuevo en `settings.js`) contiene id, nombre visible y nivel de desbloqueo: Experto 5, Profesional 10 y Champions 15. `difficultyLabel(id)` da el nombre, incluido «Leyenda». La UI ya no tiene nombres fijos: `updateDifficultyControls()` recorre `DIFFICULTIES` en los cuatro `<select>` (`#difficulty`, `#play-difficulty`, `#settings-difficulty` y `#quick-difficulty`) y, si la dificultad guardada está bloqueada, pasa a la más alta desbloqueada.
- `BotAI.skilledAttack()` solo se usa en los niveles con `skills` y en modo ataque. Principiante, Avanzado, Experto y Leyenda conservan exactamente el comportamiento anterior.
  - **Conducción:** se coloca detrás del balón en la línea de avance y lo empuja con toques suaves, regulando la velocidad para no despegárselo. Si está por delante del balón, lo rodea.
  - **Disparo:** con el carril libre desde `shootRange` (380 en Profesional, 430 en Champions), o si le presionan cerca de la portería.
  - **Amago:** si el humano tapa el carril, `feint` se mueve hacia un lado (`show`) y sale por el otro (`cut`, con acelerón).
  - **Paredes:** si le tapan el carril, `bankShot()` busca un tiro contra la banda que entre en la portería. Tiene en cuenta la restitución de 0,78 de la banda, que el balón pase el palo cercano y el alcance por el rozamiento; si no hay ninguno viable, devuelve null. Lejos de la portería hace una pared con la banda para superar al defensor.
  - **Balón suelto en su campo:** con el rival lejos, sale a por él en vez de esperar de portero. Antes se quedaba atascado.
  - `this.random` se puede sustituir en los tests.
- Leyendas: la etiqueta pasa de «IA MUY DIFÍCIL» a «IA LEYENDA» para no confundirla con los nuevos nombres.
**Comprobado:** 137 tests. En `tests/BotSkills.test.js` hay un duelo con la física real contra un defensor que tapa y sale a robar, de 4 × 60 s: Experto marca 0, Profesional 5-7 y Champions 8-11, con el balón pegado más del 90 % del tiempo de conducción. Los tiros contra la pared que la IA decide hacer entran siempre (49 de 49 en un barrido de posiciones).
**Para el otro asistente:** para añadir o ajustar dificultades, edita `DIFFICULTIES` y `BOT_LEVELS`, no la UI. Las competiciones usan `settings.difficulty`, así que también pueden jugarse en Profesional o Champions.

## 2026-10-16 · Claude · Online más robusto: reconexiones, avisos y pruebas con varios navegadores
**Commit:** fusionado en `main` el 2026-10-16 con la aprobación de Ale (merge `439a908`). Para deshacerlo: `git revert -m 1 439a908`.
**Archivos:** `src/game/OnlineMatch.js`, `src/game/Game.js`, `src/ui/OnlineHub.js`, `src/ui/UI.js`, `src/main.js`, `src/styles.css`, `supabase/online-swap.sql` y `supabase/online-swap-test.sql` (nuevos), `supabase/online-teams-test.sql`, `README.md`, `tools/e2e-online/` (nuevo), `tests/OnlineMatch.test.js`, `tests/OnlineHub.test.js`, `tests/Squad.test.js`
**Qué y por qué:** Ale pidió buscar errores y causas de desconexión y asegurar que todos los modos online funcionan con todos los jugadores. Monté un banco de pruebas en el que varios navegadores juegan entre sí con el código real (ver `tools/e2e-online/README.md`), lo ejecuté antes y después de los cambios, y revisé el código y los registros de Supabase.
**Fallos encontrados y arreglados:**
- **Mensajes del partido por HTTP durante los cortes (registros de Realtime: errores 429 y pool de BD agotado).** Si el socket no está unido, supabase-js reenvía cada `send()` a la API REST de broadcast, que en canales privados autoriza contra la BD. A 30 paquetes/s eso saturaba Supabase y agravaba la desconexión. `OnlineMatch.send()` ya no envía si `channel.state !== 'joined'`; los paquetes de juego se descartan.
- **El anfitrión recarga a mitad de partido → bloqueo para siempre (1v1 y 2v2).** Ahora, si un invitado ya emparejado recibe el `hello` de un anfitrión nuevo, responde con `hello` + `resume` (`{matchId,left,right,elapsed,goals}`, en orden del anfitrión, obtenido de `handlers.getResume` → `UI.onlineResume()` → `Game.resumeState()`). El anfitrión arranca y aplica `Game.applyResume()`, así que se conserva el marcador y el tiempo.
- **Tras recargar, el otro lado descartaba los paquetes porque su contador ya era mayor.** Cada conexión envía un `nonce`; si cambia, se reinician `lastInputSequence`, `lastSnapshotSequence` y `seatSequences`.
- **1v1 asignado: el rival que volvía en otra pestaña o dispositivo (con otro `clientId`) recibía «sala llena».** El anfitrión ahora acepta al usuario verificado con su nuevo `clientId`.
- **Tras perder la conexión (`onPeerLeft`) los dos se quedaban en el online con el partido «en juego» sin reintentar.** `UI.handleOnlinePeerLeft` guarda `lastOnlineResume` y pone `hub.connectedMatchId = null`, de modo que el hub se reconecta solo. Si alguien no vuelve, la sala se resuelve en 90 s, como antes.
- **Al abrir el juego con un partido en curso no se volvía a él.** `OnlineHub.activate()` va al online y reconecta.
- **Si el servidor da el partido por terminado mientras juegas (abandono o tiempo agotado y el aviso de Realtime se pierde), el juego seguía.** `OnlineHub.consume()` lo detecta, para el partido y muestra el resultado (victoria por abandono). Además cierra el canal de un partido ya resuelto.
- **Sala en espera de la que el servidor te sacó por inactividad:** la consulta periódica fallaba en bucle con «No perteneces a esta sala» y no se podía salir. Ahora `OnlineHub.dropLobby()` descarta la sala y refresca el estado; `leave` con ese error también limpia.
- **Invitado sin datos del anfitrión durante más de 3 s** (mala conexión o juego en segundo plano): `UI.checkHostStall()` muestra en `#connection-banner` «Esperando al anfitrión…».
- **2v2 privado lleno: nadie podía cambiar de equipo.** `supabase/online-swap.sql` (nuevo) añade `team` con `{swapWith: userId}` para intercambiar con un jugador del otro equipo, y el RPC devuelve `version: 3`. El cliente muestra «Cambiar con @x» (`.room-swap`) solo si `supportsSwap` (versión 3 o superior).
**Comprobado:** 129 tests unitarios; tests SQL (`online-test`, `online-rematch-test`, `online-teams-test`, `online-swap-test`) en Postgres local; el banco de pruebas pasa todos los escenarios (1v1 público, privado e invitación, Ranked y revancha, 2v2 en sus tres variantes, torneos de 4, 6 y 8, cortes y recargas en 1v1 y 2v2, abandono resuelto por el servidor, volver en otra pestaña y sala caducada).
**Para el otro asistente:**
- **`supabase/online-swap.sql` YA ESTÁ APLICADO en producción.** Ale lo ejecutó el 2026-10-16. Claude lo verificó con consultas de solo lectura: `action` y las otras 6 funciones coinciden en md5 con la versión probada en local, y los permisos son correctos. No hay que volver a ejecutarlo.
- `field_private.action` vigente: la de `online-swap.sql`.
- `src/main.js` expone `window.__field` solo en desarrollo (`import.meta.env.DEV`), para el banco de pruebas. No lo uses en producción.
- No vuelvas a enviar paquetes de juego con `channel.send` si el canal no está unido.

## 2026-10-16 · Claude · Arreglos de inicio de sesión
**Commit:** fusionado en `main` el 2026-10-16 con la aprobación de Ale (merge `78299a6`). Para deshacerlo: `git revert -m 1 78299a6`.
**Archivos:** `src/account/AuthErrors.js` (nuevo), `src/account/AccountService.js`, `src/account/GoogleSignIn.js`, `src/ui/UI.js`, `index.html`, `tests/AuthErrors.test.js` (nuevo), `tests/GoogleSignIn.test.js`
**Qué y por qué:** Ale pidió resolver los problemas al iniciar sesión.
- **Problema principal (configuración, no código).** En los registros de Auth de Supabase, todas las peticiones llevan `referer: http://localhost:3000`. Eso indica que la Site URL de Supabase sigue siendo `http://localhost:3000` y que `https://futarcade.es` no está en las Redirect URLs. Por eso, tras entrar con Google, Supabase devuelve al jugador a localhost. Se ve a usuarios repitiendo Google tres veces y acabando por registrarse con correo.
- **Resuelto en el panel (2026-10-16, 13:57):** Ale puso en Authentication → URL Configuration la Site URL `https://futarcade.es` y las Redirect URLs `https://futarcade.es/**` y `https://www.futarcade.es/**`. Claude lo verificó en los registros de Auth: el inicio con Google vuelve ya a `https://futarcade.es/` y la sesión se abre (`/callback` 302 y luego `/user` 200).
**Cómo:**
- `AuthErrors.js` contiene:
  - `authErrorMessage(error, context)`: traduce los errores de Supabase Auth a mensajes en español que dicen qué hacer (credenciales incorrectas con la pista de Google, cuenta ya existente, demasiados intentos, sin conexión, contraseña débil…).
  - `readAuthRedirectError(location)` y `cleanAuthUrl(location)`: leen los errores que vuelven de Google en `?error=` o `#error=` y limpian la dirección.
- `AccountService.signIn/signUp/signInWithGoogle` lanzan ya el mensaje traducido.
- `UI.attach` muestra la pantalla de cuenta con el aviso si se vuelve de Google con un error.
- Al iniciar sesión ya no se exigen 8 caracteres de contraseña (solo al crear la cuenta).
- `GoogleSignIn`: en un dominio público abierto por http redirige a https en vez de fallar. En la Portable (`arcade:`) explica que se use correo y contraseña.
- `index.html`: script en línea al principio de `<head>` que pasa de http a https en dominios públicos. No afecta a localhost, a las IPs de red local ni a la Portable.
**Para el otro asistente:** Los mensajes de error de acceso se añaden en `AuthErrors.js`, no en la UI. No quites el script de https de `index.html`, porque Google necesita https.

## 2026-10-16 · Claude · 2v2 online (rápido y Ranked) y torneos de 4, 6 u 8
**Commit:** `37dc6bd` (fusionado en `main` el 2026-10-16 con la aprobación de Ale, merge `dee5999`). Para deshacerlo: `git revert -m 1 dee5999`.
**Archivos:** `supabase/online-teams.sql` y `supabase/online-teams-test.sql` (nuevos), `src/game/Game.js`, `src/game/Renderer.js`, `src/game/OnlineMatch.js`, `src/game/OnlineRules.js`, `src/ui/OnlineHub.js`, `src/ui/UI.js`, `src/main.js`, `index.html`, `src/styles.css`, `README.md`, `tests/Squad.test.js` (nuevo), `tests/OnlineMatch.test.js`, `tests/OnlineHub.test.js`
**Qué y por qué:** Ale pidió un modo 2v2 online y torneos de 4, 6 u 8 jugadores. Decidió: 2v2 en partido rápido y en Ranked; en la búsqueda pública los equipos se sortean y en la sala privada cada uno elige equipo.
**Cómo:**
- **SQL (`online-teams.sql`, se ejecuta DESPUÉS de `online-rematch.sql`):**
  - Columnas nuevas: `lobbies.size` (quick/ranked: 2 o 4; torneo: 4, 6 u 8; NULL = tamaño antiguo), `lobbies.seeds` (hojas del cuadro, NULL = bye), `members.team` (1 izquierda, 2 derecha) y `matches.p3`/`p4`.
  - `members_slot_check` pasa a 1..8. Hay checks nuevos `members_team_check` y `lobbies_size_check`.
  - Funciones nuevas: `room_size()` y `advance_bracket()`. Esta última crea los partidos de cada ronda, salta los byes y corona al campeón.
  - `launch_room(uuid, manual boolean default false)` sustituye a `launch_room(uuid)`, que se borra con `drop function`.
  - Se rehacen `finish_match`, `room_data` (añade `size`, `host`, `team`, `p3`, `p4`), `channel_access` (p1..p4) y `action`.
  - `action` tiene dos comandos nuevos: `team` (cambiar de equipo en la sala privada 2v2 en espera) y `start` (solo el creador, con 4 jugadores y equipos 2-2). Además, `queue`/`create` aceptan `size`, la cola solo empareja salas del mismo tamaño y la respuesta incluye `version: 2`.
  - En 2v2, equipo izquierdo = p1+p3 y derecho = p2+p4. p1 es el anfitrión del partido en tiempo real. Cualquier miembro informa por su equipo (`report1` es el equipo izquierdo y `report2` el derecho).
  - Salir de un partido en juego hace perder a todo el equipo.
  - Si pasan 90 s sin noticias de todo el equipo rival, o del anfitrión (p1), ese equipo pierde.
  - ELO 2v2: se usa la media de cada equipo y los cuatro suben o bajan lo mismo.
  - La revancha necesita el voto de todos y conserva los equipos.
  - Torneo de 6: dos jugadores sorteados pasan directos a semifinales. Hojas `[bye1, NULL, a, b, bye2, NULL, c, d]`, así que los cuartos son la ronda 1, posiciones 2 y 4.
  - Rondas: con 4 jugadores, 1 = semis y 2 = final. Con 6 u 8, 1 = cuartos, 2 = semis y 3 = final.
  - Probado en un Postgres 16 local con un auth de Supabase simulado: pasan `online-test.sql`, `online-rematch-test.sql` y `online-teams-test.sql`, y la migración se puede ejecutar dos veces. Antes comprobé con consultas de solo lectura que las funciones de producción tienen el mismo md5 que las del repo.
- **Motor (`Game.js`):** modo `squad`, que solo existe en el online 2v2; el 1v1 no cambia.
  - Asientos en orden del anfitrión: 0 = p1, 1 = p3, 2 = p2, 3 = p4. `player` es tu asiento, `bot` el primer rival y `others` los otros dos.
  - Métodos nuevos: `setupSquad`, `placeSquadBody`, `updateSquad` (el anfitrión simula los 4 con `hooks.getSeatInput(seat)`, con dos pasadas de colisiones) y `replaySkipCount`.
  - El snapshot online lleva `seats` (los 4 cuerpos), y `replay.seats` con los asientos que han saltado.
  - `applyOnlineSnapshot` mapea por asiento. Solo invierte marcador y estadísticas si estás en el lado derecho.
  - En 2v2 la repetición acaba cuando saltan los cuatro (`setRemoteReplaySkip(seat)`) o a los 3 s.
  - El render y la repetición incluyen `others`. `Renderer.drawLocalMarker` dibuja un anillo bajo tu jugador cuando hay más de dos.
  - Cada equipo viste la equipación de su capitán (asiento 0 o 2).
- **Red (`OnlineMatch.js`):**
  - `connectAssigned(match, profile, opponent, squad)`.
  - Los mensajes llevan `seat`, y el anfitrión valida que el clientId corresponde al asiento declarado en el hello.
  - El anfitrión arranca cuando han saludado los 3 invitados, o a los 12 s con los que estén.
  - Entradas por asiento con `getSeatInput(seat)`.
  - Si un invitado se desconecta, su jugador se queda quieto. Si se va cualquiera (`leave`), el partido acaba para todos, porque en la base de datos su equipo ha perdido.
- **UI:**
  - Selectores `[data-format-picker]` / `[data-format-group]` (1v1/2v2 en Ranked y Rápido; 4/6/8 en Torneo). Se guardan en `localStorage` con la clave `field-online-formats`.
  - Los botones con `data-size-from` envían el `size` elegido.
  - IDs nuevos: `online-ranked-kicker`, `online-ranked-search`, `online-quick-kicker`, `online-tournament-kicker`, `online-tournament-copy` y `online-tournament-search`.
  - La sala 2v2 se pinta con `renderTeams()`: columnas `.room-team` y botones "Unirme al equipo A/B" y "Empezar partido" (`.room-start`). Los torneos de 6 y 8 usan la rejilla `.grid`, nombres de ronda (`roundName`) y el aviso de byes (`.room-byes`).
  - En `OnlineRules.js` hay helpers nuevos: `roomSize`, `isTeamRoom`, `matchSeats`, `matchPlayers`, `onLeftTeam`, `wonMatch`, `bracketRounds` y `roundName`. `assignedMatch` y `opponentId` ya contemplan p3/p4.
  - En `UI.startOnlineMatch`, para 2v2 se rellenan `options.squad`, `playerTeam`, `playerUsername` y `playerElo`, que usan la presentación, el HUD y el marcador final.
**Para el otro asistente:**
- **`supabase/online-teams.sql` YA ESTÁ APLICADO en producción.** Ale lo ejecutó en el SQL Editor el 2026-10-16. Claude lo verificó con consultas de solo lectura: las 7 funciones coinciden en md5 con la versión probada en local (ignorando los `\r` del pegado en Windows), y las columnas, restricciones y permisos son correctos. No hay que volver a ejecutarlo. El cliente muestra los selectores porque el RPC devuelve `version: 2`.
- Si tocas `field_private.action`, parte de `online-teams.sql`, que pasa a ser la versión vigente.
- Las invitaciones directas de amigos siguen siendo solo 1v1: el 2v2 privado se hace con código.
- No cambies el orden de asientos (p1, p3, p2, p4) ni que p1 sea el anfitrión.

## 2026-10-15 · Claude · Logo FA como marca e icono de la web
**Commit:** rama `logo-fa`
**Archivos:** `src/assets/logo.svg` (nuevo), `public/favicon.svg`, `public/favicon.png`, `public/apple-touch-icon.png` (nuevos), `index.html`, `src/styles.css`, `desktop/create-icon.cjs`
**Qué y por qué:** Ale pidió usar su logo "FA" (azul marino #02385e) en la página y como icono. En fondos oscuros se usa en blanco.
**Cómo:** El PNG original se vectorizó a `src/assets/logo.svg`. Los 16 `<span class="brand-mark">FA</span>` del HTML pasan a `<span class="brand-mark" aria-hidden="true"></span>`; `.brand-mark` ya no es un cuadrado verde con texto: pinta el logo con `mask: url(./assets/logo.svg)` y el color sale de `background` (blanco; `.blue-theme .brand-mark` también blanco). Para cambiar el color del logo basta con cambiar ese `background`. `public/favicon.svg` es azul marino y blanco cuando el navegador está en modo oscuro (`prefers-color-scheme`); `favicon.png` (48) y `apple-touch-icon.png` (180) son el logo azul sobre fondo blanco. `desktop/create-icon.cjs` genera ahora el icono de la Portable con el logo (PNG 256 en base64). Se crea la carpeta `public/` (Vite la copia a la raíz de `dist/` y de `desktop/game/`).
**Para el otro asistente:** Si añades cabeceras nuevas, usa el `<span class="brand-mark" aria-hidden="true"></span>` vacío, sin texto. No vuelvas a poner fondo de color en `.brand-mark`, porque es la máscara del logo. `desktop/startup.html` sigue mostrando solo el texto "FÚTBOL ARCADE".

## 2026-10-15 · Claude · Sala online mejorada
**Commit:** `23682a9` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 23682a9`.
**Archivos:** `src/ui/OnlineHub.js`, `index.html`, `src/styles.css`, `NOTAS_IA.md`
**Qué y por qué:** Ale pidió mejorar la interfaz de la sala online.
**Cómo:**
- `#online-room-panel` tiene una cabecera nueva, `.room-header` (`#online-room-mode`, `#online-room-state` con `data-state` y `#online-room-timer`, que cuenta el tiempo de espera de la sala actual).
- `OnlineHub.renderLobby()` reescrito. Muestra una tarjeta por plaza (`seatCard`: colores de la camiseta y abreviatura del equipo, @usuario, etiqueta TÚ, ELO, nivel y equipo, o "Ha salido") y huecos animados (`emptySeat`). En 1 contra 1 se ve "VS" entre las plazas (`.duel`); en torneo, una rejilla 2×2 (`.quad`). Los partidos usan tarjetas `.room-match`, con ganador, marcador y ±ELO en Ranked.
- **Clases nuevas `room-*`**. No reutilizar `.bracket-match` en el online: esa clase es ahora del cuadro de torneos offline.
- Se mantienen los IDs existentes (`online-status`, `online-room-code-wrap`, `online-lobby-roster`, `online-bracket` y `online-cancel`).
**Para el otro asistente:** los datos de cada plaza vienen de `room.players[*].profile` (`teamId`, `level`) del RPC; no hacen falta cambios de SQL.

## 2026-10-15 · Claude · Revancha online (partido rápido y Ranked)
**Commit:** `3016c22` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 3016c22`.
**Archivos:** `supabase/online-rematch.sql` (nuevo), `supabase/online-rematch-test.sql` (nuevo), `src/ui/OnlineHub.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/OnlineHub.test.js`, `NOTAS_IA.md`
**Qué y por qué:** Ale pidió la opción de revancha en la pantalla final de los partidos online. Decidió que valga para partidos rápidos y Ranked, y que en Ranked la revancha también cuente ELO.
**Cómo:**
- **SQL (`supabase/online-rematch.sql`):** añade las columnas `field_private.members.rematch` (boolean) y `field_private.lobbies.rematch_lobby` (uuid). `room_data()` devuelve `rematch: { votes: [userId…], next }`. `field_private.action` incorpora el comando `rematch`, solo para salas `quick` o `ranked` en estado `finished`, con los dos jugadores aún en la sala: el primer voto espera; el segundo crea una sala privada del mismo tipo con los mismos asientos y perfiles, y la arranca con `launch_room`. Además, `poll` sobre una sala terminada con revancha redirige a la sala nueva. El cambio es aditivo y compatible con los clientes antiguos. El archivo se generó a partir de `online.sql`, y comprobé que la función de producción coincidía con ese archivo antes de escribirlo.
- **Test SQL:** `supabase/online-rematch-test.sql`, en una transacción que se revierte. Cubre doble voto, redirección, voto repetido, persona ajena a la sala, ELO de la revancha Ranked y rival que se va.
- **Cliente:** `OnlineHub.updateRematch()` gestiona el botón `#result-rematch` y el texto `#result-rematch-status` (nuevo): pedir, esperar, aceptar o rival desconectado. **Solo se muestra si la sala trae `lobby.rematch`**, es decir, si la base de datos ya tiene la migración, así que el cliente es seguro de desplegar antes. `requestRematch()` llama al RPC `rematch`. `consume()` conecta un partido nuevo desde la pantalla de resultado si hay una revancha pedida (`rematchRequested`). `tick()` sondea cada 3 s mientras se ve el resultado online. `UI.requestOnlineRematch` usa la revancha de base de datos cuando hay sala del hub, y si no, la antigua por Realtime.
**Para el otro asistente:** `supabase/online-rematch.sql` **YA ESTÁ APLICADO en producción** (Ale lo ejecutó en el SQL Editor el 2026-10-15; verificado por Claude con consultas de solo lectura: columnas, función y permisos correctos). No hay que volver a ejecutarlo. Si tocas `field_private.action`, parte de la versión de `online-rematch.sql`, que es la vigente tras aplicarla, no de la de `online.sql`.

## 2026-10-15 · Claude · Cuadro de eliminatorias para torneos
**Commit:** `efa6626` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert efa6626`.
**Archivos:** `src/game/Competitions.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/Bracket.test.js` (nuevo), `NOTAS_IA.md`
**Qué y por qué:** Ale pidió una pantalla de clasificación para las competiciones de tipo torneo. Antes no existía un cuadro real: el rival de cada ronda se sorteaba del bloque correspondiente del sorteo.
**Cómo:**
- `Competitions.js`: `createBracket(teams)`, `playBracketRound(bracket, roundIndex, playerId, playerGoals, opponentGoals, random, goalTarget)`, `simulateRemainingBracket()`, `bracketOpponent()`, `bracketChampion()` y `simulateKnockoutMatch()` (probabilidad según las estrellas). Los cruces siguen el orden del sorteo: (0,1), (2,3)… Así el rival de la ronda r es el ganador del bloque [2^(r-1), 2^r), igual que hacía `pickChampionsOpponent`. El cuadro guarda solo IDs y se serializa en el guardado de competición (`tournament.bracket`).
- `UI.openTournamentSetup` crea `tournament.bracket`. `launchTournamentRound` toma el rival de `bracketOpponent` y, si un guardado antiguo no tiene cuadro, vuelve a `pickChampionsOpponent`. En `handleMatchEnd` se registra el resultado y se simula el resto de la ronda; si el jugador cae, se simula el resto del torneo y el título muestra al campeón.
- Vistas: `UI.renderBracket(container, cup, focusRound, fromRound)` dibuja columnas por ronda (`.bracket-round`) con tarjetas `.bracket-match`, y resalta tu camino. En el resultado (`#tournament-bracket-panel`, nuevo en `index.html`) se ve desde la ronda recién jugada; en la pantalla previa del torneo, `#tournament-roster` muestra ahora el cuadro completo del sorteo en lugar de la lista de equipos.
**Para el otro asistente:** no cambies el orden de `tournament.teams`, porque define los cruces. El modo liga no usa nada de esto.

## 2026-10-15 · Claude · Clasificación de liga mejorada entre jornadas
**Commit:** `7164785` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 7164785`.
**Archivos:** `src/game/Competitions.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/LeagueTable.test.js` (nuevo), `NOTAS_IA.md`
**Qué y por qué:** Ale pidió mejorar la tabla de clasificación que se ve entre partidos de liga.
**Cómo:**
- `updateLeagueStandings()` guarda ahora en cada fila `form`, un array con los últimos 5 resultados (`'W'`, `'D'` o `'L'`). Las temporadas guardadas sin `form` siguen funcionando: se rellena desde la siguiente jornada.
- `UI.renderLeagueStandings(season, previousRanks)`: chip con los colores de cada club, flecha ▲/▼ según la posición de la jornada anterior (se calcula en `handleMatchEnd` antes de actualizar), líder marcado en dorado, etiquetas **TÚ** y **PRÓX.** (rival de la siguiente jornada), columna FORMA con puntos de color y desplazamiento automático hasta tu fila. Se pinta después de fijar `season.status`, para saber el próximo rival.
- Cabecera de la tabla en `index.html`: POS, EQUIPO, PJ, G, E, P, DG, PTS, FORMA. Desaparece GF:GC y se añade FORMA. Las columnas tienen clases (`col-pos`, `col-team`, `col-wdl`, `col-pts`, `col-form`). En móvil se ocultan PJ, G, E y P.
**Para el otro asistente:** si añades columnas, hazlo a la vez en el `thead` de `index.html` y en `renderLeagueStandings`. El CSS usa clases, no `nth-child`, salvo PJ (columna 3) en móvil.

## 2026-10-15 · Claude · Marcador final con equipos y minutos de gol
**Commit:** `3455f66` (fusionado en `main` el 2026-10-15 con la aprobación de Ale). Para deshacerlo: `git revert 3455f66`.
**Archivos:** `index.html`, `src/ui/UI.js`, `src/styles.css`, `NOTAS_IA.md`
**Qué y por qué:** Ale pidió sustituir la pantalla de Victoria/Derrota por un marcador con los dos equipos, el resultado y los minutos de los goles.
**Cómo:**
- `#result-overlay`: nuevo bloque `#result-scoreboard`. Cada lado (`.score-side.home` y `.score-side.away`) tiene un emblema con la camiseta, el nombre y el dorsal (`paintPlayerPreview`), el equipo, el jugador y la lista de minutos de gol (`#result-home-goals` y `#result-away-goals`). En el centro van el resultado (`#result-score`), la etiqueta de resultado y la duración y los tiros. Debajo hay una línea temporal (`#result-timeline`) con un marcador por gol.
- `#result-title` **se mantiene**: ahora se muestra como etiqueta ("VICTORIA", "DERROTA", "¡Ganaste la copa!"…). `#result-copy` ya no repite el marcador, solo la XP y los mensajes.
- `UI.renderScoreboard(result, won)` se llama desde `handleMatchEnd`. Los minutos salen de `result.stats.goals` (`minute`, `elapsedSeconds`, `side`), que en online ya llegan mapeados para el invitado. `UI.matchEyebrow(mode)` da el texto superior para partido rápido, online o Leyendas; liga y torneo siguen poniendo el suyo.
- CSS: bloque nuevo al final; `.result-panel` es más ancho (640 px).
**Para el otro asistente:** si añades datos al resultado, hazlo dentro de `.result-scoreboard` o debajo de `#result-copy`. No vuelvas a meter el marcador en `#result-copy`.

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
