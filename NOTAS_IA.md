# Notas de cambios entre asistentes de IA

Registro compartido entre ChatGPT y Claude. Las entradas más recientes van arriba. El protocolo está en [`AGENTS.md`](AGENTS.md).

---

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
