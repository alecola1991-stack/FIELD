# Pruebas end-to-end del online

Varios navegadores aislados (uno por jugador) juegan entre sí con el código real del juego. La base de datos es un Postgres local con las migraciones de `supabase/`. Un servidor local (`fakesupa.cjs`) sustituye a Supabase: ejecuta el RPC `field_online` como el usuario de la sesión, implementa Realtime (protocolo Phoenix v2: broadcast, presence y autorización de canales privados con `field_private.channel_access`) y responde a lo mínimo de Auth.

No forma parte de `npm test`: necesita Postgres, Chromium y unos minutos.

## Preparación

1. Postgres local en `/tmp:5499` (o variables `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`) con una base `field` y, en este orden: `shim.sql`, `supabase/online.sql`, `supabase/online-rematch.sql`, `supabase/online-teams.sql`, `supabase/online-swap.sql`, `supabase/online-profiles.sql`, `supabase/online-bots.sql` y `supabase/online-bots-2.sql`.
2. `npm install` dentro de esta carpeta.
3. Servidor de desarrollo del juego apuntando al Supabase falso:
   `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=test npx vite --port 5180` (desde la raíz del repo). En modo desarrollo, `src/main.js` expone `window.__field` para que las pruebas puedan forzar goles.

## Ejecución

`node e2e.cjs all` o escenarios sueltos:
- `quick1v1`, `private1v1` (código e invitación de amigo), `ranked1v1` (ELO y revancha);
- `duoQuickPublic`, `duoQuickPrivate` (intercambio de equipo y Empezar), `duoRanked`: repetición que saltan los cuatro, marcador por equipo, ELO 2v2, revancha y abandono;
- `tour4`, `tour6`, `tour8`: torneos completos hasta el campeón;
- `reconnect`, `duoReconnect`: corte de socket y recarga del anfitrión y del invitado a mitad de partido;
- `serverForfeit`: el servidor da el partido por abandono mientras se juega;
- `comeback`: un jugador cierra el juego y vuelve en otra pestaña;
- `staleRoom`: expulsión de una sala en espera por inactividad.
- `bots1v1`, `botsQuit` (el bot abandona tras un gol), `botsDuo`, `botsDuoMixed`, `botsTournament`: salas públicas que se completan con bots a los 16 s (Ranked 1v1 con ELO y revancha, 2v2 con una y con dos personas, y torneo de 4 con una persona). Conviene ejecutarlos con la base recién creada: una sala pública en espera de otra prueba se usaría como rival.

El dibujado del campo se desactiva en las pestañas de prueba (`game.renderEnabled = false`). Aun así, en máquinas sin GPU el reloj del juego avanza más despacio, y por eso las pruebas fuerzan la cuenta atrás y los goles desde el anfitrión.
