let storageScope = 'guest';
function storageKey() { return storageScope === 'guest' ? 'field-competition-save' : `field-competition-save:${storageScope}`; }
export function setCompetitionSaveScope(scope) {
  storageScope = scope && scope !== 'guest' ? String(scope).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'guest' : 'guest';
}

export function loadCompetitionSave() {
  try {
    const save = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (isCompetitionSave(save)) return save;
  } catch { /* Ignore stale or damaged saves. */ }
  return null;
}

export function storeCompetitionSave(save) {
  try { localStorage.setItem(storageKey(), JSON.stringify(save)); return true; }
  catch { return false; }
}

export function clearCompetitionSave() {
  try { localStorage.removeItem(storageKey()); } catch { /* Storage may be unavailable. */ }
}

function isCompetitionSave(save) {
  if (save?.version !== 1) return false;
  const mode = save.competition?.mode;
  if (!['league', 'tournament'].includes(mode) || save.match?.mode !== mode || save.game?.mode !== mode) return false;
  const season = save.competition[mode];
  if (!season || !['playing', 'next'].includes(season.status)) return false;
  if (mode === 'league' && (!Number.isInteger(season.jornada) || season.jornada < 1 || !Array.isArray(season.opponents) || !season.opponents.length)) return false;
  if (mode === 'tournament' && (!Number.isInteger(season.round) || season.round < 1 || !Array.isArray(season.teams) || !season.teams.length)) return false;
  for (const body of [save.game.player, save.game.bot, save.game.ball]) {
    if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return false;
    if (['vx', 'vy'].some(key => body[key] !== undefined && !Number.isFinite(body[key]))) return false;
  }
  return ['elapsed', 'scorePlayer', 'scoreBot'].every(key => Number.isFinite(save.game[key]) && save.game[key] >= 0);
}
