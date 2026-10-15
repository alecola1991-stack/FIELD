# Notas de cambios entre asistentes de IA

Registro compartido entre ChatGPT y Claude. Las entradas más recientes van arriba. El protocolo está en [`AGENTS.md`](AGENTS.md).

---

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
