# Instrucciones para asistentes de IA

En este repositorio trabajan dos asistentes: **ChatGPT** y **Claude**. Para evitar conflictos y trabajo duplicado, los dos siguen este protocolo.

## Antes de empezar

1. Sincroniza con `main` (`git pull`) antes de tocar nada.
2. Lee las últimas entradas de [`NOTAS_IA.md`](NOTAS_IA.md). Ahí está lo que cambió el otro asistente, cómo y por qué.
3. Si una nota marca algo como **pendiente** o **no tocar**, respétalo o coméntalo con Ale antes de cambiarlo.

## Al hacer cambios

- Haz commits pequeños y enfocados. Evita reformatear o reordenar código que no forma parte del cambio, porque genera conflictos sin aportar nada.
- No renombres ni muevas archivos, funciones o IDs del DOM sin dejarlo anotado.
- Ejecuta `npm test` y `npm run build` antes de subir. Los 93+ tests deben pasar.
- No subas `node_modules/`, `dist/`, `desktop/game/` ni `desktop/release/`.
- Los cambios de Supabase (`supabase/*.sql`) afectan a la base de datos en producción: indica en la nota si hay que ejecutarlos y en qué orden.

## Al terminar

Añade una entrada **al principio** de `NOTAS_IA.md` con este formato, en el mismo commit que el cambio:

```
## AAAA-MM-DD · <Asistente> · <título corto>
**Commit:** <hash corto o rama>
**Archivos:** lista de archivos tocados
**Qué y por qué:** qué se cambió y el motivo.
**Cómo:** decisiones técnicas relevantes (funciones nuevas o eliminadas, cambios de API interna, IDs, claves de localStorage, SQL…).
**Para el otro asistente:** lo que debe saber para no romper o duplicar esto; pendientes; pasos manuales (p. ej. ejecutar SQL en Supabase).
```

Si un cambio no necesita contexto especial, basta con una entrada corta. Lo importante es que siempre exista.

## Mapa rápido del proyecto

- `src/game/`: motor (Game, Physics, BotAI, Renderer, Input, OnlineMatch, competiciones, progreso).
- `src/ui/UI.js`: controlador de todas las pantallas. `src/ui/OnlineHub.js`: lobby online.
- `src/config/`: ajustes, equipos, modificadores, leyendas.
- `src/account/`: Supabase Auth y sincronización del perfil.
- `supabase/`: esquema SQL (perfiles y online con ELO, amigos y torneos).
- `desktop/`: Portable de Windows (Electron) con autoactualización.
- `tests/`: `node --test`.
