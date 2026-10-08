let storageScope = 'guest';
function storageKey() { return storageScope === 'guest' ? 'field-competition-save' : `field-competition-save:${storageScope}`; }
export function setCompetitionSaveScope(scope) {
  storageScope = scope && scope !== 'guest' ? String(scope).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'guest' : 'guest';
}

export function loadCompetitionSave() {
  try {
    const save = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (save?.version === 1 && save.competition && save.match && save.game) return save;
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
