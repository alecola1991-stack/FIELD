# Notas de cambios entre asistentes de IA

Registro compartido entre ChatGPT y Claude. Las entradas más recientes van arriba. El protocolo está en [`AGENTS.md`](AGENTS.md).

---

## 2026-10-18 · Claude · Táctico: balón que «atravesaba» al jugador y modo 3 contra 3 (portero, mediocentro y delantero)
**Commit:** rama `tactico-3v3` (pendiente de pasar a main)
**Archivos:** `src/game/Tactical.js`, `src/game/TacticalAI.js`, `src/game/Game.js`, `src/game/Renderer.js`, `src/config/modifiers.js`, `src/ui/UI.js`, `src/styles.css`, `tests/Tactical3v3.test.js` (nuevo)
**Qué y por qué:**
- Ale vio que, con la IA en posesión, a veces el balón pasaba por encima del jugador, y fallos parecidos al chutar.
  - Causa 1: el dibujo suaviza las posiciones del balón y del jugador por separado. Al girar rápido, el balón se dibujaba en línea recta a través del cuerpo.
  - Causa 2: quien chutaba no chocaba con el balón durante 0,3–0,45 s, y el que perdía el balón tampoco, así que los rebotes los atravesaban.
- Pidió un modo 3 contra 3 solo en Táctico:
  - Portero, mediocentro y delantero por equipo; el jugador siempre es el delantero y sale adelantado.
  - Campo un 30 % más grande, con porterías del mismo tamaño.
  - El mediocentro pasa y, si su equipo tiene muchas estrellas, con curva.
  - IA para el equipo rival y para los compañeros.
**Cómo:**
- Arreglos:
  - `Renderer.render` recibe `heldBy` (el poseedor). El balón en posesión se dibuja desde la posición suavizada del poseedor más el desfase real, así siempre gira alrededor del cuerpo. `smooth()` solo suaviza una vez por fotograma (`frameId`).
  - `Possession` separa `cooldowns` (no puede volver a coger el balón) de `ghosts` (no choca con él). Solo el que chuta deja de chocar, y solo 0,1 s.
- Campo:
  - `modifierWorld(mods, scale)`: con `scale = 1.3` el campo pasa a 1482×910, con los mismos márgenes y la misma portería (190) y el círculo central más grande.
  - El `Renderer` encuadra según `this.world` (`resize` y caché del campo al cambiar de tamaño).
  - `Game.start`: `this.trio` solo con Táctico, fuera del online, el entrenamiento y Leyendas. `fieldScale = 1.3`.
- Equipos:
  - `setupSquad(squad, teamSize)` ya admite 3 por equipo; las comprobaciones de equipo usan `leftSeat(seat)`.
  - `setupTrio`: asientos 0 delantero humano, 1 MC, 2 POR, 3 DEL, 4 MC y 5 POR.
  - `placeSquadBody` coloca al delantero a 0,41 del ancho, al MC a 0,27 y al portero en su línea.
- `TeamAI` (en `TacticalAI.js`):
  - Portero: cubre el ángulo en su línea, sale a por el balón que entra en su área y, con el balón, pasa al libre (MC o delantero) o despeja.
  - Mediocentro: presiona en su campo y apoya por detrás. Con el balón pasa al delantero (al hueco si está adelantado) usando `curvedPassAim` cuando su equipo tiene 4 estrellas o más, o tira si está cerca.
  - Delantero rival: ataca como en 2v2, presiona arriba y se desmarca para el pase.
- Se corrigió que, en 3v3, el reloj de reacción de la IA no avanzaba en la posesión (los MC no pasaban ni tiraban); ahora se descuenta en `TeamAI.update` (`noTick`).
- `curvedPassAim` simula el balón con los dos efectos y prefiere la curva más suave que llega a menos de 45 del objetivo.
- UI:
  - `soloFormat()` admite `'3v3'` solo con jugabilidad Táctico. Se añade un botón «3 contra 3 · Táctico» a cada selector de formato, oculto en las demás jugabilidades.
  - El partido rápido, la liga y las copas pasan `trio`. El Modo Carrera sigue con 1v1 y 2v2.
  - Etiqueta «3 CONTRA 3» y marcador «NOMBRE + 2 IA».
**Para el otro asistente:** las posiciones de salida están en `placeSquadBody`, los roles en `TeamAI.keeper/midfielder/forward` y el tamaño del campo en `fieldScale`.

---

## 2026-10-18 · Claude · IA adaptada a la jugabilidad Táctico (1v1 y 2v2, rivales y compañera)
**Commit:** fusionado en main (rama `ia-tactica`, merge 18f9d42). Para deshacerlo: `git revert -m 1 18f9d42`
**Archivos:** `src/game/TacticalAI.js` (nuevo), `src/game/Game.js`, `tests/TacticalAI.test.js` (nuevo)
**Qué y por qué:** Ale pidió que, en la jugabilidad Táctico, la IA:
- Avance con el balón hasta pasado el medio campo para tirar.
- Intente tocar el balón del jugador para robarlo.
- Tenga un comportamiento distinto por dificultad.
- En el 2v2, la compañera haga lo mismo: robar en su campo y marcar en el rival.
**Cómo:**
- `TacticalAI` sustituye a `BotAI` (1v1, `single()`) y a `SquadAI` (2v2, `update()` para los asientos 1-3) cuando `game.possession` existe, es decir, en Táctico. Lee `possession.holder`.
- Con el balón (`attack`):
  - Conduce hacia la portería rival y regatea en lateral al rival que tiene delante.
  - Protege el balón: si el rival está a menos de 75, se gira de espaldas a él y el balón pasa al otro lado.
  - Tira con `tacticalShot` (con error de puntería según el nivel) solo pasado el medio campo y dentro de `range`, o si le presionan cerca de la portería.
  - En 2v2 pasa a un compañero libre adelantado cuando le aprietan.
- Rival con el balón:
  - El más cercano presiona e intercepta, apuntando a donde estará el balón según la distancia.
  - Si el que lleva el balón está entre él y su portería, primero hace una carrera de recuperación al carril de tiro y luego entra al balón.
  - Si llega por detrás, rodea al jugador.
  - El otro defensor cubre entre el balón y su portería.
- Balón suelto: va el más cercano y el resto se desmarca por delante.
- La compañera sigue corriendo hacia los pases del humano (`expectPass`).
- `TACTICAL_AI_LEVELS` fija por dificultad: velocidad, reacción, distancia de tiro, error, presión, regate/protección, pase y curva. Las estrellas del equipo suman o restan un poco.
- Con un humano simulado que presiona sin parar y tira al llegar al área (90 s):

  | Dificultad | Goles humano–IA |
  |---|---|
  | Principiante | 26–1 |
  | Avanzado | 12–10 |
  | Experto | 5–22 |
  | Profesional | 3–26 |
  | Champions | 1–24 |

  La media de la posición de tiro siempre queda pasada la mitad del campo.
**Para el otro asistente:** para cambiar la dificultad, ajusta `TACTICAL_AI_LEVELS`. Arcade y Clásico siguen con `BotAI` y `SquadAI`, sin cambios.

---

## 2026-10-18 · Claude · Jugabilidad «Táctico» (estilo FIFA): posesión pegada, tiros a puerta, pases y pases filtrados
**Commit:** fusionado en main (rama `jugabilidad-tactica`, merge 9b13a6c). Para deshacerlo: `git revert -m 1 9b13a6c`
**Archivos:** `src/game/Tactical.js` (nuevo), `src/game/Game.js`, `src/game/Physics.js`, `src/game/Input.js`, `src/game/GamepadController.js`, `src/game/SquadAI.js`, `src/game/Renderer.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/TacticalGameplay.test.js` (nuevo)
**Qué y por qué:** Ale pidió una tercera jugabilidad, «Táctico», que imite los controles básicos de FIFA:
- El balón es un 10 % más pequeño que en Arcade.
- Se queda pegado al jugador en la última dirección a la que miró, girando a su alrededor, hasta que lo toca un rival. Esto vale también para la IA.
- Los tiros van siempre a puerta y son un 20 % más fuertes.
- Mando (adaptado a teclado):
  - ○ = tiro. Arriba o abajo eligen palo.
  - ✕ = pase al compañero en la dirección (±30°) o, si no hay nadie, empujar el balón.
  - △ = pase filtrado (por delante del compañero) o empujar.
  - L2 + ○ = tiro con curva, hacia dentro o hacia fuera.
- Teclado: Espacio tiro, Shift/C + Espacio curva, E pase y R pase filtrado.
- Un tiro potente del rival no se controla: rebota.
- El online siempre es Arcade.
**Cómo:**
- `Tactical.js`:
  - `Possession.step()` se llama en cada subpaso de física (1v1 y 2v2):
    - Captura el balón al tocarlo (salvo un tiro de más de 560 de un rival), el robo es inmediato cuando lo toca un rival y lleva el balón con `carry()`.
    - En `carry()` el ángulo gira hacia `faceX/faceY` a 13 rad/s; el balón va a la distancia de contacto y desliza por las bandas.
  - `Physics.kickBall` llama a `ball.onKicked(body)`, que libera la posesión. Quien acaba de chutar (o pierde el balón) no choca con él ni lo recupera durante 0,3–0,45 s (`ignores`).
  - `tacticalShot`: palo elegido o hueco libre, con potencia ×1,2. La curva se busca simulando el balón (`simulateCross`) y, si no hay ninguna posible, el tiro sale recto.
  - `tacticalPass`: receptor por ángulo (`passReceiver`); el filtrado apunta 110 por delante en ataque; sin receptor hace un empujón con potencia 0,5.
- `Game.kickParams()` solo se aplica a los tiros del humano (1v1 local y asiento local del 2v2).
  - El 20 % extra de potencia es solo para el humano: la IA chuta como siempre.
  - Con un pase al compañero se avisa a `SquadAI.expectPass()` y la IA compañera corre a recibirlo.
- `Input.setScheme('tactical')` (se ajusta en `Game.setupGameplay`): Espacio devuelve `shot: 'goal'`, E `'pass'` y R `'through'`.
  - El mando, con `game.gameplay === 'tactical'`, usa ○→Espacio, ✕→E, △→R y L2 para la curva.
  - La ayuda de disparo dibuja el tiro apuntado (`tacticalPreview`).
- UI: tercer botón «Táctico» en Ajustes › Juego.
  - El partido se etiqueta como «JUGABILIDAD TÁCTICA».
  - Las teclas del pie y del inicio cambian con `body.gameplay-tactical`; en partidos online se ve la ayuda arcade (`body.match-online`).
**Para el otro asistente:** los valores están en `TACTICAL` (`Tactical.js`): escala del balón, potencia, giro, tiempos de espera, tiro duro, cono de pase y empujón.

---

## 2026-10-18 · Claude · Jugabilidad «Clásico» (conducción pegada al pie, balón -5 %) en lugar de los controles clásicos
**Commit:** fusionado en main (rama `jugabilidad-clasica`, merge be48013). Para deshacerlo: `git revert -m 1 be48013`
**Archivos:** revierte el merge de `controles-clasico` (43e9f6f): se borran `ClassicAim.js` y su test, y se restauran `Input.js`, `GamepadController.js`, `Game.js`, `Renderer.js`, `OnlineMatch.js`, `SquadAI.js`, `index.html` y `styles.css`. Además: `src/game/Physics.js`, `src/game/Game.js`, `src/config/settings.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/ClassicGameplay.test.js` (nuevo)
**Qué y por qué:** Ale cambió la idea:
- Ya no son controles, sino una «Jugabilidad» en la pestaña Juego de Ajustes.
- Clásico: el balón se conduce más fácil y va más pegado al jugador al avanzar, y es un 5 % más pequeño.
- Se quitan los disparos dirigidos y curvados dirigidos (K/L/J y ○/✕/L2). Se dispara con Espacio, igual que en Arcade.
- El online siempre es Arcade.
**Cómo:**
- `git revert -m 1 43e9f6f` quita todo lo de los controles clásicos. La entrada de NOTAS de ese merge se queda como historial.
- `settings.gameplay` puede ser `'arcade'` (por defecto) o `'classic'`. En Ajustes › Juego hay un selector «Jugabilidad» (`UI.setGameplay` / `renderGameplay`).
- `Game.start` fija `this.gameplay`: si el modo es `online`, siempre `'arcade'`. Se guarda en la instantánea de las competiciones.
  - `applyModifiers`: en clásico, el radio del balón es `BALL_RADIUS * 0.95 * ballSize`.
  - La etiqueta del partido empieza por «JUGABILIDAD CLÁSICA».
- `Physics.dribbleAssist(player, ball, dt)`:
  - Si el jugador corre (más de 45 de velocidad) y el balón está delante y en contacto (a menos de 16 de holgura), lo lleva a un punto justo delante y le iguala la velocidad (parámetros en `DRIBBLE`).
  - No actúa justo después de un tiro (`shotCooldown`) ni con un balón que llega rápido.
  - `resolvePlayerBall(..., soft)` da toques más suaves (impulso `-rel*1.04+10` en lugar de `-rel*1.26+41`).
  - Solo se aplica al humano: en 1 contra 1 a `this.player`, y en el 2v2 sin conexión al asiento local. La IA no lo usa.
**Para el otro asistente:** para hacer la conducción más o menos pegada, ajusta `DRIBBLE` en `Physics.js`.

---

## 2026-10-18 · Claude · Controles «Clásico» (tiro a puerta, pase y curva con apuntado automático)
**Commit:** fusionado en main (rama `controles-clasico`, merge 43e9f6f). Para deshacerlo: `git revert -m 1 43e9f6f`
**Archivos:** `src/game/ClassicAim.js` (nuevo), `src/game/Input.js`, `src/game/GamepadController.js`, `src/game/Game.js`, `src/game/Renderer.js`, `src/game/OnlineMatch.js`, `src/game/SquadAI.js`, `src/config/settings.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/ClassicControls.test.js` (nuevo)
**Qué y por qué:** Ale pidió un modo de controles nuevo en Ajustes llamado «Clásico». El actual pasa a llamarse «Arcade».
- Teclado: flechas para mover, K para disparar a puerta (el juego elige la mejor dirección), L para pasar al compañero dejándosela delante y J + K para el disparo con curva a puerta.
- Mando: joystick derecho para mover, ○ para disparar, ✕ para pasar y L2 + ○ para el disparo con curva.
**Cómo:**
- `settings.controlScheme` puede ser `'arcade'` (por defecto) o `'classic'`. `UI.renderControlScheme()` llama a `input.setScheme()` y pone la clase `body.scheme-classic`, que cambia las ayudas de teclas del pie de partido, del inicio y de Ajustes.
- `Input.consumeKick()` en clásico devuelve `{ kick, curve, shot: 'goal' | 'pass' }`. Espacio ya no dispara, solo salta repeticiones.
- `GamepadController` en clásico:
  - Se mueve con el stick derecho (`classicPadAxes`); la cruceta y el stick izquierdo también valen.
  - ○ (botón 1) inyecta `KeyK` y ✕ (botón 0) inyecta `KeyL`.
  - L2 (botón 6) activa la curva.
- `Game.kickParams(body, command, axisY)` es el punto único de todos los disparos: jugador local, rival online, invitados del 2v2 y anfitrión.
  - Con `shot` usa `ClassicAim`; sin `shot`, el arcade de siempre.
  - Ayudantes: `attacksRight`, `mateOf` y `opponentsOf`.
  - Los pases no gastan el tiro de fuego ni cuentan como tiros.
- `ClassicAim`:
  - `goalTarget` elige la altura de la portería más libre de rivales.
  - `goalShotAim` compensa la velocidad del balón y del jugador.
  - `curvedShotAim` simula el balón (`simulateCross`) con los dos efectos y un abanico de ángulos, y elige el que entra más cerca del objetivo, de fuera hacia dentro. Si no hay curva posible, tira recto.
  - `passAim` apunta por delante del compañero, con la fuerza según la distancia. En 1 contra 1 es un toque suave hacia la portería rival.
- La ayuda de disparo en clásico dibuja la trayectoria apuntada (`classicPreview`, recalculada cada 120 ms).
- Online: el campo `shot` viaja en la entrada y el anfitrión apunta con su estado. Solo se envía si hay `shot`, así que es compatible con clientes antiguos.
- IA compañera (2v2): `SquadAI.expectPass(target)`. Tras un pase del humano, el compañero corre a la línea del balón en cualquier zona del campo durante 1,6 s, o hasta que lo toca él o un rival.
**Para el otro asistente:** los tiros nuevos deben pasar por `kickParams`. El botón «Configurar botones» del mando solo afecta al esquema arcade.

---

## 2026-10-18 · Claude · Dificultad automática según las estrellas del rival
**Commit:** fusionado en main (rama `dificultad-estrellas`, merge c97ba6c). Para deshacerlo: `git revert -m 1 c97ba6c`
**Archivos:** `src/config/settings.js`, `src/game/Game.js`, `src/game/Progression.js`, `src/ui/UI.js`, `src/styles.css`, `tests/StarDifficulty.test.js` (nuevo)
**Qué y por qué:** Ale pidió que la dificultad de los rivales solo se pueda elegir con un interruptor «Dificultad personalizada». Si está apagado, la IA usa la dificultad que marcan las estrellas del equipo rival. Además decidió:
- Sin límite por nivel: un 5★ juega en Champions aunque seas nivel 1.
- La tabla es 1★ Principiante, 2★ Avanzado, 3★ Experto, 4★ Profesional y 5★ Champions.
- El Modo Carrera también pasa a estrellas.
- Ganar da +10 % de XP por cada estrella del rival.
**Cómo:**
- `settings.js` añade `customDifficulty` (por defecto `false`), `difficultyForStars(stars)` y `starXpMultiplier(stars)`.
- `UI.rivalDifficulty(team, chosen)`: con el interruptor apagado usa las estrellas; encendido usa la dificultad elegida.
  - `start()` la aplica a los modos `bot`, `league`, `tournament` y `career` (salvo al restaurar una partida guardada).
  - La etiqueta del partido muestra «RIVAL ★★★★★ · IA CHAMPIONS».
- `renderDifficultyMode()` añade el interruptor y una nota junto a los 4 selectores: inicio, Jugar, partido rápido y Ajustes.
  - El selector se oculta con `body.auto-difficulty`.
  - En el partido rápido, la nota muestra la IA del rival elegido.
- `Game.start` ya no sobrescribe `settings.difficulty`: guarda `this.matchDifficulty`, y `updateSettings` respeta la del partido.
- `Progression.awardMatch(won, multiplier)` aplica el bonus solo a las victorias.
- Modo Carrera: `startCareerMatch` ya no usa `careerDifficulty` (sigue exportada en CareerMode, aunque ya no se usa).
- Leyendas, online y la IA compañera del 2v2 no cambian.
**Para el otro asistente:** para cambiar la tabla de estrellas, toca `STAR_DIFFICULTIES` en `settings.js`.

---

## 2026-10-18 · Claude · Web bloqueada en móviles y tablets con aviso de app en desarrollo
**Commit:** fusionado en main (rama `bloqueo-movil`, merge 0f07a59). Para deshacerlo: `git revert -m 1 0f07a59`
**Archivos:** `src/main.js` (ahora solo decide), `src/app.js` (el antiguo `main.js`, sin cambios), `src/mobileGate.js` (nuevo), `src/styles.css`, `tests/MobileGate.test.js` (nuevo)
**Qué y por qué:** Ale pidió desactivar la web en dispositivos móviles. En su lugar se muestra una pantalla propia que dice que estamos creando una app para teléfonos, para mejorar la experiencia de los jugadores.
**Cómo:**
- `main.js` llama a `isMobileDevice()`.
  - Si es un móvil o una tablet, `showMobileNotice()` quita `.app-shell`, pinta el aviso y oculta la pantalla de carga. El juego no se descarga ni se inicia.
  - Si no, hace `await import('./app.js')`, que arranca el juego como antes.
- Cuenta como móvil:
  - Un agente de usuario móvil: Android, iPhone, iPad, Mobile…
  - `userAgentData.mobile`.
  - iPadOS, que se presenta como Mac pero es táctil.
  - Un dispositivo con solo puntero táctil (`pointer: coarse` sin ningún `any-pointer: fine`).
  - Electron (app de escritorio) nunca se bloquea, y un portátil táctil con ratón tampoco.
- El aviso tiene: logo, un móvil animado con un minipartido, la etiqueta «EN DESARROLLO», el texto, una tarjeta «juega en tu ordenador» y un botón «Compartir el enlace» (comparte o copia https://futarcade.es/).
**Para el otro asistente:** para volver a abrir la web en móviles, haz que `main.js` importe `app.js` siempre, o revierte este merge. Los scripts de prueba que inyectaban código en `/src/main.js` deben apuntar ahora a `/src/app.js`.

---

## 2026-10-18 · Claude · Jugadores un 5 % más pequeños y balón un 10 % más pequeño
**Commit:** fusionado en main (rama `tamanos`, merge 3db286b). Para deshacerlo: `git revert -m 1 3db286b`
**Archivos:** `src/game/Player.js`, `src/game/Ball.js`, `src/game/Game.js`, `tests/Modifiers.test.js`, `tests/GameStats.test.js`
**Qué y por qué:** Ale pidió un cambio general en todo el juego: los jugadores, un 5 % más pequeños, y el balón, un 10 % más pequeño.
**Cómo:**
- Hay dos constantes nuevas: `PLAYER_RADIUS = 20.9` (antes 22) en `Player.js` y `BALL_RADIUS = 10.8` (antes 12) en `Ball.js`.
- `Game.applyModifiers` las multiplica por los modificadores de tamaño, así que el cambio se aplica a todos los modos: IA, liga, copas, carrera, leyendas, online y 2v2.
- La física, la IA, el dibujo de nombre y dorsal y el alcance de tiro leen `radius`, así que se ajustan solos.
- Los tests usan las constantes en vez de 12 y 22.
**Para el otro asistente:** si hay que tocar los tamaños base, cambia solo esas dos constantes.

---

## 2026-10-18 · Claude · Progreso: % del juego completado y recompensa dorada
**Commit:** fusionado en main (rama `progreso`, merge 498bdd6). Para deshacerlo: `git revert -m 1 498bdd6`
**Archivos:** `src/game/GameProgress.js` (nuevo), `src/ui/ProgressScreen.js` (nuevo), `src/ui/UI.js`, `src/ui/OnlineHub.js`, `src/ui/ProfileSocial.js`, `src/ui/CareerScreen.js`, `src/game/Game.js`, `src/game/Renderer.js`, `src/config/settings.js`, `index.html`, `src/styles.css`, `tests/GameProgress.test.js` (nuevo)
**Qué y por qué:** Ale pidió un submenú de progreso con el % completado y lo que queda por hacer:
- En una página nueva de paneles del inicio, a la que se pasa con una flecha.
- Ligas: solo las primeras divisiones.
- Recompensa al 100 %: nombre dorado animado en el online y en el perfil, y dorsal y nombre dorados en la equipación con cualquier equipo.
**Cómo:**
- `GameProgress.computeProgress({ trophyIds, level })` reparte el 100 % en 8 categorías con estos pesos:

  | Categoría | Peso |
  |---|---|
  | Copas | 20 |
  | Ligas de primera | 20 |
  | Modo Carrera | 15 |
  | Nivel | 15 |
  | Dificultades | 10 |
  | Leyendas | 10 |
  | Logros | 5 |
  | Online | 5 |

  Devuelve `percent` (no redondea a 100 hasta completarlo todo), el título y `nearest` (objetivos más cercanos, sin los bloqueados por nivel).
- Los hitos nuevos se guardan como trofeos del perfil con id `progress-<categoría>-<id>`, así que se sincronizan con la cuenta. `UI.unlockProgress` los crea:
  - Dificultad: al ganar contra la IA.
  - Leyenda: al ganar ese partido.
  - Rango: con `trackOnlineRank` al cargar la identidad online.
  - Carrera: con `trackCareer`.
  - `backfillProgress` recupera los hitos de carrera a partir del récord guardado.
  - La lista de trofeos de la cuenta oculta los `progress-`.
- Inicio:
  - Los paneles están en `.hub-page` dentro de `#hub-pager`.
  - La página 2 tiene Progreso (anillo y barras), Siguiente objetivo y Te queda poco.
  - Se cambia de página con las flechas laterales, las teclas ← y →, o deslizando en móvil.
- `ProgressScreen` pinta `#progress-root`:
  - Cabecera con anillo, título y siguiente objetivo.
  - 8 tarjetas; al pulsar una se ve el detalle.
  - Te queda poco y la recompensa, con el interruptor `settings.goldKit`.
- Dorado:
  - Clase CSS `.gold-name` en el perfil, la identidad online, los puestos de la sala, la ficha pública y el marcador online.
  - `onlinePlayer()` envía `gold` y `goldKit` en el perfil de sala. No hace falta cambiar el servidor, porque el JSON pasa tal cual. Lo marca el cliente, así que es cosmético y se podría falsear.
  - `Renderer.drawPlayer` pinta nombre y dorsal con un degradado dorado móvil si `player.goldKit`.
**Para el otro asistente:** para añadir una categoría, toca `PROGRESS_CATEGORIES` y `computeProgress`, y mantén que los pesos sumen 100 (hay un test que lo comprueba).

---

## 2026-10-18 · Claude · Modo Carrera (10 temporadas)
**Commit:** fusionado en main (rama `modo-carrera`, merge 35dcf97). Para deshacerlo: `git revert -m 1 35dcf97`
**Archivos:** `src/game/CareerMode.js` (nuevo), `src/ui/CareerScreen.js` (nuevo), `src/ui/TrophyArt.js` (nuevo), `src/ui/UI.js`, `src/game/Game.js`, `index.html`, `src/styles.css`, `tests/CareerMode.test.js` (nuevo)
**Qué y por qué:** Ale pidió un modo carrera con estas reglas:
- 10 temporadas. Eliges país y te ofrecen 5 clubes al azar, con más probabilidad cuanto más baja es la división.
- Cada temporada se juegan 2 partidos por competición:
  - Liga: 2 victorias, campeón. 1 victoria con diferencia de goles positiva, ascenso. Diferencia 0, promoción al 50 %. Sin descensos.
  - Copas: semifinal y final.
- Ganar la liga en primera clasifica para la Champions (Europa) o la Libertadores (Sudamérica). México, EE. UU. y Arabia van directos al Mundial de Clubes.
- Ganar la copa continental mete al club en el Mundial de Clubes esa misma temporada.
- Desde que llegas a primera, juegas con la selección de tu país:
  - Temporadas 2, 6 y 10: Mundial.
  - Temporadas 4 y 8: Eurocopa o Copa América.
- Ofertas de fichaje cada temporada.
- Puntos: liga 100, ascenso 50, Champions/Libertadores 250, Eurocopa/Copa América 250, Mundial de Clubes 300, Mundial 500, y +100 si acabas en tu primer club.
- El modo sustituye a la casilla «Champions» del inicio, en dorado y con la etiqueta NUEVO. La casilla «Liga Nacional» pasa a ser «Copas y ligas» y abre la pantalla de competiciones, donde siguen la Champions, la Liga y las demás.
**Cómo:**
- `CareerMode.js` (sin DOM):
  - Funciones: `createStartingOffers`, `createCareer`, `createSeasonPlan` (etapas `league`, `continental`, `club-world-cup`, `national` con 2 partidos cada una), `nextCareerMatch`, `recordCareerMatch`, `finishSeason` (resultado, tabla simulada, trofeos y ofertas), `startNextSeason` y `finishCareer`.
  - Los clubes ascendidos se guardan en `state.leagueOverrides`; usa `careerLeagueOf`.
  - Se guarda en localStorage `field-career-mode-v1` (con ámbito por usuario, como CompetitionSave) y el récord en `…:best`.
- `CareerScreen.js` pinta las vistas `landing`, `country`, `club`, `hub`, `summary` y `final` dentro de `#career-root`. Espacio pulsa el botón marcado con `data-career-space`.
- `UI.js`:
  - `startCareerMatch()` lanza `start('career', { playerTeamId, playerTeam, … })`.
  - `handleMatchEnd` registra el resultado (`result.mode === 'career'`) y pone el botón «Siguiente».
  - `advanceCompetition`, `finishToMenu` y `saveAndQuit` vuelven a la carrera con `leaveCareerMatch`. Un partido abandonado a medias no cuenta.
- `Game.start` acepta `options.playerTeamId` (equipación del club o de la selección de la carrera) y `goalTarget` para el modo `career` (a 3 goles).
- La dificultad de cada partido sube con la división y la ronda, con un tope en lo que el nivel del jugador tiene desbloqueado (`careerDifficulty`).
**Para el otro asistente:** las reglas de puntos y el baremo están en `CAREER_POINTS` y `leagueOutcome`. Los dibujos de trofeos ahora salen de `TrophyArt.js`, compartido con el selector de competiciones.

---

## 2026-10-18 · Claude · Balón distinto según la competición
**Commit:** fusionado en main (rama `balones-competicion`, merge 2c15bb6). Para deshacerlo: `git revert -m 1 2c15bb6`
**Archivos:** `src/game/BallStyles.js` (nuevo), `src/game/Renderer.js`, `src/game/Game.js`, `tests/BallStyles.test.js`
**Qué y por qué:** Ale pidió un balón distinto por competición:
- Liga: el amarillo actual con 2 franjas de la bandera del país.
- Champions: blanco con estrellas azules.
- Libertadores: naranja con 2 franjas negras.
- Mundial: blanco con tres franjas, azul, verde y roja.
- Partido rápido: el actual.
- Online: blanco con el símbolo 🌐.
**Cómo:**
- `BallStyles.js`:
  - `ballStyleFor(fieldTheme, mode)` devuelve `{ type, base, stripes?, color? }`. Primero mira si el modo es `online`; después los temas `champions`, `copa-libertadores`, `world-cup` y `league-*`. Para una liga busca su país en `TEAM_COUNTRIES` y usa `FLAG_STRIPES`. En cualquier otro caso, amarillo liso.
  - `drawBallBody(c, r, style, spin)` dibuja el cuerpo plano con el contorno negro. Las franjas, las estrellas y el globo (dibujado con líneas, no con el emoji) giran con `ball.spin`.
- `Game` pasa `mode: this.state.mode` al render, tanto en el normal como en la repetición. `Renderer.render` calcula `this.ballStyle` y `drawBall` llama a `drawBallBody`.
- Las Leyendas usan el tema `champions`, así que también llevan el balón de estrellas. La Eurocopa, la Copa América, el Mundial de Clubes y el entrenamiento llevan el amarillo.
- El balón del fondo de los menús no cambia (amarillo).
**Para el otro asistente:** para cambiar o añadir un balón, toca `ballStyleFor`.

---

## 2026-10-18 · Claude · Tercer color de equipación y 3 patrones nuevos
**Commit:** fusionado en main (rama `tercer-color`, merge b2228f1). Para deshacerlo: `git revert -m 1 b2228f1`
**Archivos:** `src/config/teams.js`, `src/game/Renderer.js`, `src/game/Player.js`, `src/game/Game.js`, `tests/TeamKits.test.js`
**Qué y por qué:** Ale pidió un tercer color para los equipos grandes que lo necesitan (como Alemania o España) y tres patrones de equipación nuevos.
**Cómo:**
- `teams.js`, tabla `KIT_TERTIARY` con 45 equipos. Cada entrada es `[tertiary, pattern?, bands?]`, y al aplicarla el equipo recibe `team.tertiary`, `team.kitPattern` y `team.kitBands`.
- Patrones nuevos (`THREE_COLOUR_PATTERNS`):
  - `tricolor-vertical`: Francia, Bélgica, Italia, México, Rumanía, Irlanda, Senegal, Malí, Camerún, Costa de Marfil y Ajax.
  - `tricolor-horizontal`: Alemania, Colombia, Rusia, Hungría, Bulgaria, Armenia, Ghana y Boca.
  - `sash` (banda diagonal): River, Perú, Rayo y Vasco.
  - Los tricolores pintan `bands` (tres colores). `sash` pinta `[base, banda, ribete]`.
- Con un patrón clásico, el tercer color se dibuja como aro de cuello: España, Portugal, Países Bajos, Inglaterra, Croacia, Brasil, Argentina, EE. UU., Japón, Barça, Atlético, Madrid, Man United, Arsenal, Milan, Inter, Roma, PSG, Bayern y otros.
- Dónde se aplica:
  - `getKitBackground` (CSS): `kitPatternBackground` y, si hay aro, una capa `radial-gradient`.
  - `Renderer.drawKitPattern` (canvas): los tres patrones y el aro.
- `Player` tiene `tertiaryColor` y `kitBands`. `Game` los pasa en todos los sitios donde ya pasaba `kitPattern` (1v1, rival, ajustes, squad offline y online).
- Los patrones nuevos no entran en el reparto aleatorio (`RANDOM_KIT_PATTERNS`), porque necesitan tres colores.
**Para el otro asistente:** para dar un tercer color a otro equipo basta con añadir una entrada a `KIT_TERTIARY`.

---

## 2026-10-18 · Claude · El borde del dorsal y del nombre nunca es del mismo color que el texto
**Commit:** fusionado en main (rama `dorsal-contraste`, merge a6dbc3e). Para deshacerlo: `git revert -m 1 a6dbc3e`
**Archivos:** `src/config/teams.js`, `src/game/Renderer.js`, `src/ui/UI.js`, `src/styles.css`, `tests/TeamKits.test.js`
**Qué y por qué:** Ale pidió que el texto del dorsal y del nombre y su borde no puedan ser del mismo color. Pasaba en dos sitios:
- En el campo, con camisetas blancas el borde se forzaba a negro aunque el dorsal fuera oscuro.
- En las vistas previas CSS, el borde era siempre `#07100c`.
**Cómo:**
- Nuevo `dorsalStyle(numberColor)` en `teams.js`. Devuelve `{ light, outline }` según la luminancia del color del texto: si el texto es claro, borde negro (`#000000`); si es oscuro, borde blanco (`#FFFFFF`).
- `Renderer.drawPlayer` lo usa en lugar de mirar la camiseta. `light` mantiene el borde grueso de antes cuando el texto es claro.
- `UI.paintPlayerPreview` pone `--dorsal-outline` y la clase `white-dorsal` (texto claro). El CSS de `.circle-preview-name` y `.circle-preview-number` usa `var(--dorsal-outline)`.
- Los equipos con `numberOutline: false` (Real Madrid, Castilla, Real Madrid C) siguen sin borde.
- Test nuevo: en los 1.078 equipos, el borde es distinto del texto y contrasta con él.
**Para el otro asistente:** cualquier sitio nuevo que dibuje un dorsal debe sacar el color del borde de `dorsalStyle`.

---

## 2026-10-17 · Claude · Las 211 selecciones de la FIFA
**Commit:** fusionado en main (rama `todas-selecciones`, merge 09bcfbe). Para deshacerlo: `git revert -m 1 09bcfbe`
**Archivos:** `src/config/teams-nations.js` (nuevo), `src/config/teams.js`, `src/game/Competitions.js`, `tests/MoreLeagues.test.js`
**Qué y por qué:** Ale pidió añadir todas las selecciones. Antes había 42, de Europa y América.
**Cómo:**
- `teams-nations.js` añade 169 selecciones con nombre en español, colores y estrellas (de 1 a 4) en `MORE_NATIONAL_ROWS`. También define los grupos nuevos `africa`, `asia` y `oceania` (`MORE_NATIONAL_GROUPS`).
- Reparto por grupo:
  - `europe` = UEFA, 55.
  - `america` = CONMEBOL + CONCACAF, 45.
  - `africa` = CAF, 54.
  - `asia` = AFC, 46.
  - `oceania` = OFC, 11.
  - Total: 211, todas las federaciones miembro de la FIFA.
- `teams.js`: el país «Selecciones» tiene ahora 5 grupos. Las estrellas de las selecciones nuevas salen de su fila; las 42 antiguas no cambian.
- `createInternationalDraw`:
  - Usa `strongestPick`, que elige por estrellas más un factor aleatorio, para que las fuertes clasifiquen más a menudo sin dejar fuera las sorpresas.
  - Eurocopa: 15 rivales europeos. Copa América: 15 rivales americanos.
  - Mundial: 16 selecciones con cupos por continente (`WORLD_CUP_QUOTAS`: Europa 5, América 4, África 3, Asia 3, Oceanía 1), proporcionales al Mundial de 48. La selección del jugador ocupa una plaza del cupo de su grupo.
- Nueva descripción del Mundial: «16 selecciones de los cinco continentes».
**Para el otro asistente:** los ids de las selecciones nuevas son `<grupo>-<país>`, por ejemplo `africa-morocco` o `asia-japan`.

---

## 2026-10-17 · Claude · Más ligas: segundas y terceras divisiones y 8 países nuevos
**Commit:** fusionado en main (rama `mas-ligas`, merge 6a275b0). Para deshacerlo: `git revert -m 1 6a275b0`
**Archivos:** `src/config/teams-more.js` (nuevo), `src/config/teams.js`, `src/game/Competitions.js`, `src/game/Renderer.js`, `src/ui/UI.js`, `src/styles.css`, `tests/MoreLeagues.test.js` (nuevo)
**Qué y por qué:** Ale pidió más ligas: las segundas y terceras divisiones de los países que no las tenían, y países nuevos con su primera división.
**Cómo:**
- `teams-more.js` contiene `MORE_LEAGUES` (con `country` y `tier`), `MORE_COUNTRIES`, `MORE_TEAM_ROWS` y `MORE_FOUR_STAR`. Las plantillas se tomaron de Wikipedia y de las federaciones (composición 2026/27 o 2026).
  - Divisiones nuevas en países que ya estaban:
    - Inglaterra: League One (24).
    - Italia: Serie C, grupos A, B y C (20 cada uno).
    - Francia: Ligue 3 (18).
    - Alemania: 3. Liga (20).
    - Argentina: Primera Nacional, zonas A y B (18 cada una).
    - Brasil: Série B (20) y Série C (20).
    - Estados Unidos: USL Championship (25).
    - Portugal: Liga Portugal 2 (18).
    - Turquía: 1. Lig (20).
  - Países nuevos con su primera división: Países Bajos (18), Escocia (12), Arabia Saudí (18), Colombia (20), Chile (16), Uruguay (16), Austria (12) y Suiza (12).
  - En total hay 865 clubes.
- `teams.js`:
  - Importa el módulo nuevo y añade las ligas al final de `TEAM_LEAGUES`.
  - Todas las ligas tienen ahora `tier`: segundas = 2, Primera RFEF = 3, Segunda RFEF = 4, el resto = 1.
  - Los países nuevos se insertan antes de «Selecciones».
  - Estrellas de las ligas nuevas: 3 en primera, 2 en segunda y 1 en tercera; 4 para los clubes de `MORE_FOUR_STAR`.
- Champions (`createChampionsDraw`): los rivales salen solo de ligas con `tier` 1, visitadas en orden aleatorio, porque ya hay más primeras divisiones que plazas. Antes también entraban las segundas divisiones.
- Césped: `pitchGreen` usa `TIER_GREEN` según el `tier` de la liga, en lugar de la lista fija de ids.
- UI:
  - `leagueTierLabel` usa el `tier` («Nª CATEGORÍA»).
  - En PC, la cuadrícula de países de la Liga Nacional pasa a 5 columnas compactas, para que quepan los 20 países sin scroll.
  - Banderas CSS para los 8 países nuevos.
**Para el otro asistente:**
- No se añadieron la Challenger Pro League belga (la composición 2026/27 no estaba publicada), la Liga de Expansión MX (las fuentes se contradecían) ni la Liga 3 portuguesa.
- Para añadir más ligas basta con añadir filas a `teams-more.js`.

---

## 2026-10-17 · Claude · Fondos animados en el inicio y en los submenús
**Commit:** fusionado en main (rama `fondos-animados`, merge 8bfd45d). Para deshacerlo: `git revert -m 1 8bfd45d`
**Archivos:** `src/ui/MenuBackdrop.js` (reescrito), `src/ui/UI.js`, `src/styles.css`
**Qué y por qué:** Ale pidió mejorar el fondo animado del menú principal y añadir animaciones de fondo en Jugar, Online, Ajustes, Champions y Liga.
**Cómo:**
- `MenuBackdrop` usa un solo canvas con escenas:
  - `setScene(scene, host)` mueve el canvas a la pantalla visible (lo pone como primer hijo con `prepend`) y prepara la escena.
  - `setActive()` funciona igual que antes: 30 fps y un frame quieto si el usuario tiene `prefers-reduced-motion`.
- Escenas:
  - `home`: jugadores que se pasan el balón amarillo en arco con estela; uno de cada cuatro pases es un tiro, y la portería tenue se ilumina con chispas. También líneas de campo y haces de luz.
  - `play`: líneas de velocidad, jugadores con estela y tiros con trayectoria discontinua.
  - `online`: red de nodos, conexiones por proximidad y paquetes de luz que viajan entre ellos.
  - `settings`: engranajes girando y deslizadores en movimiento.
  - `champions`: estrellas titilando, confeti dorado, focos y una copa grande y tenue. Se usa en la pantalla `tournament`, así que vale para todas las copas.
  - `league`: barras de clasificación que cambian, líneas de campo, jugadores y balones.
- `UI.show(view)`: el mapa `{ home, play, online, settings, tournament → champions, league }` decide la escena. En el resto de vistas el fondo se detiene.
- CSS: en los submenús el canvas va con `z-index: -1` dentro de la pantalla (`isolation: isolate`), detrás del contenido, al 55 % de opacidad; en la portada, al 50 %.
- Arreglo de paso en los anuncios: la etiqueta «PUBLICIDAD» solo se ve cuando el hueco tiene un anuncio servido (`data-ad-status="filled"`).
**Para el otro asistente:** para añadir una escena, añade un `case` en `build`, `update` y `draw` y una entrada en el mapa de `UI.show`.

---

## 2026-10-17 · Claude · AdSense (fase 2): banner en la portada y laterales en los partidos
**Commit:** fusionado en main (rama `anuncios`, merge 42f420f). Para deshacerlo: `git revert -m 1 42f420f`
**Archivos:** `src/ui/Ads.js` (nuevo), `src/ui/UI.js`, `src/styles.css`
**Qué y por qué:** Ale creó los bloques «Portada» (`1179611412`) y «Laterales partido» (`2319187280`) y quiere los anuncios en la portada y a los lados del campo durante los partidos.
**Cómo:**
- Nuevo `src/ui/Ads.js`, con la clase `Ads`. `UI.show(view)` la crea y llama a `ads.update(view, game.renderer)` en cada cambio de vista.
  - Solo se activa si existe el `<script adsbygoogle.js>` (que inyecta Vite en la web), no estamos en modo `desktop` y el navegador no es Electron.
- Cada hueco es un `<aside class="ad-slot">` con la etiqueta «PUBLICIDAD» y un `<ins class="adsbygoogle" data-full-width-responsive="false">`.
  - `push({})` se hace una sola vez, la primera vez que el hueco es visible y tiene tamaño.
  - Si AdSense lo deja vacío (`data-ad-status="unfilled"`), por ejemplo antes de la aprobación o con un bloqueador, el hueco se oculta.
- Portada (`.home-ad`, formato horizontal):
  - Va bajo el menú: 728×90 en PC, 728×60 en pantallas de menos de 860 px de alto y 320×100 en móvil.
  - Mientras está visible, las baldosas del menú se compactan un poco.
  - En PC, si con el banner la portada tuviera scroll, el banner no se muestra.
- Partido (`.match-rail.left/.right`, formato vertical):
  - Va dentro de `.field-wrap`, en el margen libre entre el borde del canvas y el campo (`renderer.ox / dpr`). Ancho entre 120 y 300 px, alto hasta 600 px.
  - Solo se muestra si caben al menos 120 px, en horizontal y sin pantalla táctil. El campo no se encoge.
  - Resultado: hay laterales en 1920×1000 (153 px) y 2560 (210 px), pero no en 1366×768, porque solo quedan 100 px.
  - Los overlays de pausa y resultado quedan por encima.
**Para el otro asistente:** no metas anuncios sobre el canvas ni junto a los controles, porque AdSense penaliza los clics accidentales. Los ID de bloque están en `AD_SLOTS`.

---

## 2026-10-17 · Claude · AdSense (fase 1): script, ads.txt y política de privacidad
**Commit:** fusionado en main (rama `adsense`, merge 34752f1). Para deshacerlo: `git revert -m 1 34752f1`
**Archivos:** `vite.config.js`, `public/ads.txt`, `public/privacidad.html`, `index.html`, `src/styles.css`
**Qué y por qué:** Ale quiere anuncios de AdSense en la portada y en los laterales durante los partidos, en futarcade.es (cliente `ca-pub-8681886004807247`). Esta primera fase deja el sitio listo para que Google lo verifique y lo apruebe.
**Cómo:**
- `vite.config.js`: el plugin `field-adsense` inyecta el script `adsbygoogle.js?client=ca-pub-…` antes de `</head>` solo cuando el modo no es `desktop`. La Portable de Windows (`--mode desktop`) no lo lleva, porque AdSense no permite anuncios en aplicaciones.
- `public/ads.txt`: `google.com, pub-8681886004807247, DIRECT, f08c47fec0942fa0`.
- `public/privacidad.html`: página estática con la política de privacidad. Cubre el almacenamiento local, la cuenta en Supabase y el inicio de sesión con Google, las cookies de AdSense, el aviso de consentimiento, los derechos RGPD y la AEPD.
- `index.html`: enlace «PRIVACIDAD» en el pie de la portada (`.footer-link`).
**Para el otro asistente:**
- El correo de contacto de la política es el que dio Ale.
- Fase 2, pendiente: los huecos `<ins class="adsbygoogle">` de la portada y de los laterales del partido. Necesitan los `data-ad-slot` que Ale creará en AdSense.

---

## 2026-10-17 · Claude · Contorno negro fino en el balón
**Commit:** fusionado en main (rama `balon-contorno`, merge 6981af3). Para deshacerlo: `git revert -m 1 6981af3`
**Archivos:** `src/game/Renderer.js`, `src/ui/MenuBackdrop.js`
**Qué y por qué:** Ale pidió un contorno negro fino en el balón amarillo.
**Cómo:**
- En `drawBall`, después del relleno `BALL_COLOR` se dibuja un trazo `#000000` de 1.2 px sobre el mismo círculo. El radio sigue siendo `ball.radius`, que es lo que comprueba el test de `GameStats`.
- El balón del fondo de los menús lleva el mismo contorno.
**Para el otro asistente:** —

---

## 2026-10-17 · Claude · Balón amarillo plano
**Commit:** fusionado en main (rama `balon-plano`, merge b62fa7c). Para deshacerlo: `git revert -m 1 b62fa7c`
**Archivos:** `src/game/Renderer.js`, `src/ui/MenuBackdrop.js`
**Qué y por qué:** Ale pidió que el balón fuera de un amarillo fuerte y plano, sin brillo ni detalles.
**Cómo:**
- `drawBall` dibuja un círculo relleno con el color `BALL_COLOR` (`#ffd400`, constante exportada de `Renderer.js`).
- Se quitan el gradiente, las costuras, el brillo, el borde y el halo.
- Se mantienen la sombra en el césped y el estirado al chutar (`kickScale`).
- El balón del fondo de los menús usa el mismo color.
**Para el otro asistente:** con el balón liso ya no se ve el giro (`spin`), pero `spin` se sigue calculando.

---

## 2026-10-17 · Claude · Balón amarillo y red que se deforma con el gol
**Commit:** fusionado en main (rama `balon-amarillo-red`, merge 496d873). Para deshacerlo: `git revert -m 1 496d873`
**Archivos:** `src/game/Renderer.js`, `src/game/Physics.js`, `src/game/Game.js`, `src/ui/MenuBackdrop.js`, `tests/CurveShot.test.js`
**Qué y por qué:** Ale pidió un balón amarillo y que, cuando el balón entre en la portería, la red se deforme como una real. Pidió que el cambio fuera reversible.
**Cómo:**
- Balón amarillo, con el mismo relieve de antes en tonos amarillos:
  - En `Renderer.drawBall`, gradiente `#fff9cf` → `#ffe34d` → `#f0bf19` → `#c4930c`, con costuras y borde ocres.
  - En `MenuBackdrop.drawBall`, el mismo color.
- Física, solo durante la celebración del gol (`goalTimer`):
  - Antes el balón se quedaba congelado en la línea. Ahora `Game.update` lo sigue moviendo (3 subpasos) con `resolveBallNet`.
  - `recordGoal` ya no frena el balón a ×0.25, sino a ×0.8.
- `Physics.js`:
  - `netPressDepth(ball, world)` devuelve `{ side, depth }`: cuánto se hunde el balón en la red del fondo.
  - `resolveBallNet(ball, dt, world)` aplica a la red del fondo un muelle con amortiguación fuerte al volver, para que la red se trague el balón; el tope es `NET_MAX_DEPTH = 26`. Además mantiene el balón entre las redes laterales y le aplica rozamiento dentro de la portería.
  - Un tiro fuerte se hunde unos 20 px y uno flojo unos 10 px. El balón se queda dentro de la portería.
  - Esto no afecta al juego normal: el gol se marca en cuanto el balón cruza la línea, antes de llegar a la red.
- Render:
  - La malla y el marco de la red salen de la caché del campo. `drawNets(c, ball, dt)` las dibuja en cada fotograma, con un abombamiento hacia fuera calculado a partir de la posición del balón (`netPressDepth`). Así funciona también en los invitados online y en las repeticiones.
  - El abombamiento es gaussiano en vertical (σ 42 px) y crece hacia el fondo de la portería.
  - Cuando el balón se separa, la red vuelve con un muelle amortiguado (un pequeño rebote).
  - Los postes y la línea de gol se dibujan encima de la malla.
**Para el otro asistente:** para deshacerlo, revierte el merge. El color del balón está solo en `drawBall`, en los dos archivos.

---

## 2026-10-17 · Claude · Balón blanco con relieve, sin manchas negras
**Commit:** fusionado en main (rama `balon-relieve`, merge 578b7e8). Para deshacerlo: `git revert -m 1 578b7e8`
**Archivos:** `src/game/Renderer.js`, `src/ui/MenuBackdrop.js`
**Qué y por qué:** Ale pidió darle un poco de relieve al balón y quitarle las manchas negras.
**Cómo:**
- `Renderer.drawBall`:
  - Se eliminan los 6 parches oscuros.
  - El cuerpo es un gradiente radial blanco que pasa a gris, con la luz fija arriba a la izquierda (no gira con el balón).
  - Lleva un brillo especular y un borde fino.
  - Dos costuras gris claro muy sutiles sí giran con `ball.spin`, para que se siga viendo el giro.
  - La sombra en el suelo y el estirado de `kickScale` se mantienen.
- `MenuBackdrop.drawBall` (el balón del fondo de los menús): el mismo aspecto, sin manchas.
**Para el otro asistente:** —

---

## 2026-10-17 · Claude · Césped: tonos menos intensos
**Commit:** fusionado en main (rama `cesped-suave`, merge ba58b39). Para deshacerlo: `git revert -m 1 ba58b39`
**Archivos:** `src/game/Renderer.js`
**Qué y por qué:** Ale pidió bajar un poco la intensidad de los verdes del campo.
**Cómo:**
- En `pitchGreen()`, la saturación pasa de `min(.58, .44 + (l - .26) * 1.1)` a `min(.47, .35 + (l - .26) * .9)`, unos 10 puntos menos.
- La luminosidad por competición no cambia, así que se mantiene la gradación de la Champions (más clara) a la Segunda RFEF (más oscura).
**Para el otro asistente:** la intensidad del césped se ajusta solo con esa línea.

---

## 2026-10-17 · Claude · Campo con textura de césped, verde según la competición y líneas y porterías blancas
**Commit:** fusionado en main (rama `cesped-vivo`, merge 9749178). Para deshacerlo: `git revert -m 1 9749178`
**Archivos:** `src/game/Renderer.js`
**Qué y por qué:** Ale pidió una textura de césped para el campo, tonos más claros y vivos, y las líneas y las porterías en blanco. Pidió además que el cambio fuera reversible. Después pidió que todos los campos fueran verdes, más claros cuanto más importante fuera la competición (Primera RFEF más clara que Segunda RFEF).
**Cómo:**
- Todo el cambio está en `Renderer.drawField`, que se dibuja una sola vez en la caché `fieldCache`, así que no cuesta nada por fotograma.
- Todos los campos son verdes (tono 132°). La luminosidad depende del nivel de la competición, en la tabla `PITCH_GREEN` de `pitchGreen(themeName)`, de más clara a más oscura:
  - Champions, Mundial y Mundial de Clubes: 0.45.
  - Eurocopa, Copa América y Libertadores: 0.425.
  - Las cinco grandes ligas (LaLiga, Premier, Serie A, Ligue 1 y Bundesliga): 0.40.
  - Partido rápido y online (`arcade`): 0.385.
  - Otras primeras divisiones: 0.37.
  - Entrenamiento: 0.35.
  - Segundas divisiones: 0.33.
  - Primera RFEF: 0.295.
  - Segunda RFEF: 0.26.
  - La saturación baja un poco en los campos más oscuros.
- `FIELD_THEMES.grass` ya no se usa para el césped. El fondo exterior (`net`) y los adornos de copa (`accent`) sí se usan.
- Textura:
  - 12 franjas de corte alternas, más claras y más oscuras.
  - 70 manchas suaves con gradiente radial.
  - Unas 16.800 briznas cortas en cuatro tonos.
  - Usa un aleatorio con semilla (`seeded`) para que el resultado sea siempre idéntico.
- Líneas: `PITCH_LINE`, blanco al 88 %, con grosor 2.5. El punto central y los de penalti también son blancos.
- Porterías: postes y línea de gol en blanco, marco de la red en blanco al 75 % y malla blanca detrás de cada portería.
- Los adornos de copa (`theme.accent`) y las etiquetas HOME/AWAY se mantienen.
**Para el otro asistente:** para volver al aspecto anterior, revierte el merge, que solo toca `Renderer.js`. `theme.line` y `theme.stripe` ya no se usan, pero siguen en los temas.

---

## 2026-10-17 · Claude · Curva: sin dirección no curva y sentido invertido
**Commit:** fusionado en main (rama `curva-invertida`, merge a6899c6). Para deshacerlo: `git revert -m 1 a6899c6`
**Archivos:** `src/game/Physics.js`, `src/game/Game.js`, `src/game/Renderer.js`, `index.html`, `tests/CurveShot.test.js`
**Qué y por qué:** Ale pidió que, si no se pulsa ninguna dirección, el tiro sea normal aunque se mantenga Shift o C, y que el sentido de la curva sea el contrario al que se pulsa.
**Cómo:**
- Nuevo `curveSide(curveHeld, axisY)`, que devuelve +1, -1 o 0. Usa la entrada vertical del que dispara (con un umbral de 0.3), no su velocidad, porque la inercia mantenía la curva después de soltar la tecla. Abajo da -1 (curva hacia arriba), arriba da +1 (curva hacia abajo), y sin arriba ni abajo da 0.
- `curveFor(side, velocity)`: la firma ha cambiado; antes era `(player, ball, velocity)`.
- `kickBall(..., curve = 0)`: el sexto parámetro ahora es el lado de la curva (un número), no un booleano.
- `Game` lo calcula en los cuatro caminos (1v1, rival online, predicción del invitado y squad) a partir del eje `y` de esa entrada. `curveAim` del render ya es el lado.
- Por la red sigue viajando el booleano `curve` junto con `y`.
- Textos de ayuda y protip actualizados.
**Para el otro asistente:** la dirección lateral sola (izquierda o derecha) no curva.

---

## 2026-10-17 · Claude · Curva: solo con Shift/C mantenido + ESPACIO, y más pronunciada
**Commit:** fusionado en main (rama `curva-con-espacio`, merge 886add9). Para deshacerlo: `git revert -m 1 886add9`
**Archivos:** `src/game/Input.js`, `src/game/Ball.js`, `src/game/GamepadController.js`, `index.html`, `tests/CurveShot.test.js`
**Qué y por qué:** Ale pidió que Shift o C no disparen por sí solas. El disparo es siempre con ESPACIO y solo sale curvo si se está pulsando Shift o C en ese momento. Mantener la tecla sigue mostrando la trayectoria curva. También pidió una curva más pronunciada.
**Cómo:**
- `Input.consumeKick()` ahora devuelve `{ kick: space, curve: space && curveHeld() }`.
- Mando: LB/LT ya no disparan; solo activan `padCurve` y se combinan con el botón de disparo.
- El botón táctil CURVA se mantiene pulsado mientras se toca DISPARAR (las pulsaciones son multitáctiles).
- `Ball.CURL_RATE` sube de 1.1 a 1.9 y `CURL_DECAY` baja de 1.6 a 1.3. Desde 420 px, el desvío pasa de unos 112 px a unos 250 px.
- Textos actualizados: ayuda de teclado, pie de la portada, protip y mensaje del mando.
**Para el otro asistente:** para ajustar la intensidad, toca solo esas dos constantes de `Ball`.

---

## 2026-10-17 · Claude · Disparo con curva (Shift / C) y ayuda de disparo curvada
**Commit:** fusionado en main (rama `disparo-curva`, merge 513468d). Para deshacerlo: `git revert -m 1 513468d`
**Archivos:** `src/game/Ball.js`, `src/game/Physics.js`, `src/game/Input.js`, `src/game/Game.js`, `src/game/OnlineMatch.js`, `src/game/Renderer.js`, `src/game/GamepadController.js`, `index.html`, `src/styles.css`, `tests/CurveShot.test.js`, `tests/OnlineMatch.test.js`
**Qué y por qué:** Ale pidió disparos con curva con Shift o C. El efecto va hacia arriba o hacia abajo según la dirección en la que corre el jugador, y la ayuda de disparo debe mostrar la curva.
**Cómo:**
- Física:
  - `Ball.curl` (rad/s) gira la velocidad en cada `update` y decae con `Ball.CURL_DECAY` (1.6). Se anula por debajo de 60 px/s.
  - `Ball.CURL_RATE` = 1.1 es la fuerza de la curva: es el valor que hay que tocar para afinarla.
  - En `resolveBallWalls`, cada rebote en banda o poste hace `curl *= -.5`. En `resolvePlayerBall`, un contacto anula la curva.
- Disparo:
  - `kickBall(..., curve = false)`, con el sexto parámetro nuevo. Las patadas normales y la IA ponen `curl = 0`.
  - `curveFor(player, ball, velocity)` decide el sentido: si `vy > 25` hacia abajo, si `vy < -25` hacia arriba, si no por `faceY`, y si no hacia el centro del campo.
- Controles:
  - `Input.consumeKick()` → `{kick, curve}` y `Input.curveHeld()`, con `CURVE_KEYS` = ShiftLeft, ShiftRight, KeyC.
  - Shift o C sueltos disparan con curva. Mantenidos mientras se pulsa ESPACIO, también curvan.
  - Mando: LB/L1 o LT/L2 (botones 4 y 6), con `input.padCurve` para la vista previa.
  - Táctil: botón `.touch-curve` (`data-touch-code="KeyC"`) junto a DISPARAR.
- `Game.readKick()` sustituye a `consume('Space')` en los tres caminos (1v1, invitado online y squad). Si el input no tiene `consumeKick`, como los mocks de los tests, dispara recto.
- Online: el campo `curve` viaja con `kick` en `sendInput`, `latestInput`, `seatInputs`, `getSeatInput`, `setRemoteInput` y `onOnlineInput`. Un cliente antiguo simplemente no curva.
- Ayuda de disparo: el render recibe `curveAim` (`curveHeld`) y `drawShotPreview` simula la bola fantasma con `curl`, con trazo de puntos azul/dorado. `drawTrajectory` simula el recorrido cuando la bola lleva curva.
- Textos: ayuda de teclado en Ajustes → Controles, pie de la portada, un protip nuevo y el mensaje de restablecer el mando.
**Para el otro asistente:** cualquier patada nueva debe pasar por `kickBall`, que resetea `curl`. Si se crea una bola a mano para predecir trayectorias, copia `curl`. Para deshacer la función entera basta con revertir el merge.

---

## 2026-10-17 · Claude · Pantalla entre partidos de torneo sin scroll y ESPACIO para seguir
**Commit:** fusionado en main (rama `cuadro-sin-scroll`, merge ede7299). Para deshacerlo: `git revert -m 1 ede7299`
**Archivos:** `src/ui/UI.js`, `src/styles.css`
**Qué y por qué:** Ale pidió que entre partidos de la Champions se vea el cuadro completo sin hacer scroll, y poder pasar al siguiente partido pulsando espacio.
**Cómo:**
- `renderBracketPanel` usa el cuadro en espejo (`mirror`, el mismo del setup de torneo) cuando la pantalla mide 1024 px de ancho o más: las dos mitades se juntan en la final, así que ocupa la mitad de alto.
- CSS a partir de 1024 px, aplicado con `:has(.tournament-bracket-panel:not(.hidden))`:
  - El overlay de resultado pasa a `position:fixed` a pantalla completa y el panel se ensancha a `min(1120px, 94vw)`.
  - Marcador y escudos más compactos, columnas del cuadro de igual ancho, y los botones Jugar y Abandonar en una sola fila.
- Probado sin scroll a 1280×720, 1366×768 y 1900×900. En móvil no cambia nada.
- ESPACIO: un listener `keydown` en `window` pulsa `#result-next` si está visible y el overlay lleva al menos 800 ms abierto (`this.resultShownAt`). Así no se salta la pantalla con el espacio del último disparo. Ignora las repeticiones de tecla y los campos de texto.
- El botón muestra la pista `<kbd class="next-key">ESPACIO</kbd>`, oculta en pantallas táctiles. Funciona también en liga.
**Para el otro asistente:** `result_next` ahora se rellena con `innerHTML` (un `span` y el `kbd`), no con `textContent`.

---

## 2026-10-17 · Claude · Misiones por dificultad que se renuevan al completarlas
**Commit:** fusionado en main (rama `misiones-dificultad`, merge 9e0b2b1). Para deshacerlo: `git revert -m 1 9e0b2b1`
**Archivos:** `src/game/Missions.js`, `src/game/CareerProfile.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`, `tests/CareerProfile.test.js`
**Qué y por qué:** Ale pidió que, al completar una misión, se añada una nueva, que las misiones se clasifiquen por dificultad y que las difíciles den más recompensa.
**Cómo:**
- `Missions.js` se ha rehecho:
  - `MISSION_TIERS` (Fácil 60 XP, Media 150, Difícil 300, Élite 600) y `MISSION_TEMPLATES` (20 plantillas, de 5 en 5 por nivel). Cada una es `count` (suma por partido) o `streak` (racha: cualquier partido que no sea victoria la reinicia).
  - `createMission`, `advanceMission`, `describeMission`, `missionStats`. El objetivo crece con `grow` cada 2 misiones completadas en ese nivel, hasta `max`. El XP sube un 10 % por cada completada, hasta +100 %.
  - Las plantillas con `minLevel` (Experto 5, Profesional 10, Champions 15) solo salen si el jugador ya tiene esa dificultad desbloqueada.
- Se han eliminado `MISSION_DEFINITIONS` y `getLeagueMission`.
- `CareerProfile`:
  - Nuevo `missionBoard` = `{ seq, done: {tier: n}, active: [{uid, tier, template, goal, xp, progress}] }`, guardado en `toJSON()` y en la nube.
  - `activeMissions(level)` rellena los niveles que faltan.
  - `processMissionEvent(event, level)` devuelve el array de completadas con `.added`, las nuevas que las sustituyen. La sustituta nunca repite la plantilla recién completada.
  - `missionsCompleted()`.
  - En `merge()` gana el tablero con más misiones completadas; si empatan, se queda el progreso máximo de cada misión.
  - Se conserva el mapa antiguo `missions`, pero ya no se muestra.
- `UI.handleMatchEnd`: ahora cuenta en todos los modos menos el entrenamiento. Envía `{ mode, won, goalsFor, goalsAgainst, difficulty (botAI; vacío online), duo, competitionMode, competitionId, isFinal, isChampion, isLeagueChampion }`. En el resultado aparecen la misión completada y la nueva.
- Pantalla de misiones: 4 tarjetas (una por nivel) con una etiqueta de color, estrellas de 1 a 4 y la recompensa. El resumen muestra el total de misiones completadas y el XP que hay en juego.
**Para el otro asistente:** para añadir misiones basta con añadir plantillas a `MISSION_TEMPLATES`. El `id` de plantilla se guarda en el perfil, así que no lo renombres. Las misiones antiguas (racha competitiva, gol en la final de la Champions, Mundial, liga) siguen dentro como plantillas, pero el progreso que hubiera en ellas no se traslada al tablero nuevo.

---

## 2026-10-17 · Claude · Logo nuevo FA (con balón) en todas partes
**Commit:** fusionado en main (rama `logo-nuevo`, merge f58e41b). Para deshacerlo: `git revert -m 1 f58e41b`
**Archivos:** `src/assets/logo.svg`, `index.html`, `public/favicon.svg`, `public/favicon.png`, `public/apple-touch-icon.png`, `desktop/create-icon.cjs`
**Qué y por qué:** Ale pasó un logo nuevo («FA» con el rayo y medio balón debajo), en PNG blanco con transparencia, y pidió que sustituya al anterior en todas partes.
**Cómo:**
- Vectoricé el canal alfa del PNG con potrace (escalado ×4 antes de trazar). Es un único `path` con `fill-rule="evenodd"` y `viewBox="0 0 293 267"`.
- `src/assets/logo.svg`: lo usa la máscara CSS `.brand-mark` de todas las cabeceras.
- `index.html`: el SVG en línea de la pantalla de carga (`.boot-logo`, en `currentColor`).
- `public/favicon.svg`: azul `#02385e`, y blanco en modo oscuro, como antes.
- `favicon.png` (48 px) e icono de la Portable (256 px, base64 en `desktop/create-icon.cjs`): logo azul sobre una baldosa blanca redondeada, como el anterior. `apple-touch-icon.png` (180 px): logo sobre fondo blanco.
**Para el otro asistente:** para cambiar el color o el tamaño, toca el `path` de `src/assets/logo.svg` y no rehagas el trazado. El mismo `d` está en `index.html` y en `public/favicon.svg`. Los PNG se generaron con cairosvg a partir de ese `path`.

---

## 2026-10-17 · Claude · IA compañera: remate preciso tras el pase del jugador
**Commit:** fusionado en main (rama `companera-precisa`, merge bc58719). Para deshacerlo: `git revert -m 1 bc58719`
**Archivos:** `src/game/SquadAI.js`, `tests/Duo.test.js`
**Qué y por qué:** Ale vio que la IA compañera fallaba muchas ocasiones después de un pase suyo. Al depurarlo aparecieron cuatro causas: el pase rebotaba en su cuerpo porque se metía en la trayectoria; el tiro salía desviado porque no descontaba la velocidad que ya traía el balón; el defensa rival estaba en el centro y lo tapaba; y los tiros eran flojos porque golpeaba al límite del alcance.
**Cómo:**
- Nuevo `compensateAim(body, ball, aim, power)`, que resuelve `v_balón + fuerza·dir = k·objetivo` para que la velocidad final vaya justo donde apunta. `update()` lo aplica a todo disparo de la compañera, salvo a los que ya llevan `compensated: true`.
- `shotLine(ball, rivals, world, minMargin = -6, shotSpeed = 820)` se ha reescrito. Recorre puntos de la portería, separados de los postes, y le da a cada rival un alcance (su velocidad de dificultad ×0.85 × el tiempo que tarda el balón en llegar a él). Devuelve el punto con más margen, o `null` si el margen no supera `minMargin`. Tras un pase del jugador usa -30, para que «tire siempre que haya tiro».
- Recepción: mientras viaja el pase del jugador hacia campo rival, la compañera se coloca al lado de la línea del balón, en el lado contrario a la portería. Así el balón pasa junto a su cuerpo y no choca contra él. Al llegar, se queda quieta y golpea justo antes del contacto o cuando el balón le pasa por delante. Si el balón va a darle en el cuerpo, se aparta de la trayectoria.
- El error de puntería se aplica en la boca de gol, limitado a dentro de los postes. La potencia es 1.45 tras un pase y 1.35 en los tiros propios. Si no hay tiro propio claro, conserva el balón y abre ángulo.
- La ventana de `fromHuman` tras su primer toque pasa de 1.2 s a 2 s.
- Banco (scratchpad, 400 pases del jugador en campo rival, con el defensa rival en posición aleatoria): con rival en difícil, de 52 a 133 goles; en normal, de 68 a 155; en champions, de 26 a 93. En partido completo, el marcador sigue equilibrado.
**Para el otro asistente:** en el test 2 de `tests/Duo.test.js` ahora se comprueba el desplazamiento máximo durante los 3 s y no la posición final. El defensa rival podía volver casualmente a su punto de salida. Para tocar la puntería de la compañera, usa `compensateAim` y `shotLine` y no apuntes directamente al centro.

---

## 2026-10-17 · Claude · Rivales del 2v2: defensa que corta la línea de pase y delantero que espera arriba
**Commit:** fusionado en main (rama `roles-rivales`, merge ab3def0). Para deshacerlo: `git revert -m 1 ab3def0`
**Archivos:** `src/game/SquadAI.js`, `tests/Duo.test.js`
**Qué y por qué:** Ale pidió dos roles fijos para las IA rivales: una que defienda y otra que espere el balón en el campo contrario para rematar. La que defiende, en su campo, debe intentar cortar la línea de pase entre el jugador y la IA compañera.
**Cómo:**
- Defensa (`rivalKeeper`):
  - Si tenemos el balón en su campo, se coloca sobre la línea entre quien lo lleva y su compañero, al 60 % del camino hacia el que recibe.
  - Si quien lleva el balón está cerca de la portería, deja la línea y se pone a tapar el tiro, entre el balón y la portería. Esa distancia depende de la dificultad: 220 + defensa × 140 px.
  - Si el balón queda suelto en su campo, va a por él; cuando lo gana, se lo pasa al delantero.
  - Si el balón está en el otro campo, espera a 0,7 del ancho del campo, alineado con el balón.
- Delantero: espera en nuestro campo (entre 0,22 y 0,42 del ancho), en el carril más alejado de nuestros jugadores y con línea de pase libre. Va a por el balón suelto que le quede cerca, intenta robar si lo tenemos a menos de 110 px de él y, con el balón, busca el tiro (su alcance de tiro es un 15 % mayor que el resto).
- Compañera: si persigue un balón suelto lejos de ella, corre a por él entrando por detrás. Antes, en ese caso el BotAI en espejo la dejaba quieta en la portería y el balón se quedaba parado.
- Test de roles reescrito: la defensa queda a menos de 40 px de la línea de pase y en su campo, y el delantero espera en nuestro campo, en las 5 dificultades.
**Para el otro asistente:** sin SQL.


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
