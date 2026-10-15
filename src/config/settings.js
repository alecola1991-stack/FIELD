// The pitch keeps its playing dimensions while the wider canvas leaves room
// for players to step half a center-circle radius beyond each touchline.
export const WORLD = Object.freeze({ width: 1140, height: 700, left: 66, right: 1074, top: 70, bottom: 630, goalTop: 255, goalBottom: 445, goalBack: 37, centerCircleRadius: 75, goalPostRadius: 6 });
export const BOT_LEVELS = Object.freeze({
  easy: { speed: 165, reaction: .49, accuracy: .385, defense: .266 },
  normal: { speed: 196, reaction: .286, accuracy: .553, defense: .455 },
  hard: { speed: 221, reaction: .156, accuracy: .658, defense: .616 },
  legend: { speed: 295, reaction: .055, accuracy: .96, defense: .93 },
});
const defaults = { name: 'JUGADOR', number: 10, teamId: '', profileReady: false, leagueCompetition: 'laliga', leagueGoalTarget: 2, difficulty: 'easy', sound: true, volume: 45, musicEnabled: true, musicVolume: 35, ambienceEnabled: true, ambienceVolume: 50, effectsVolume: 100, controllerVibration: true, controllerMap: {}, trajectory: false, shotPreview: false, goalReplays: true, verticalField: true, modifiers: {} };
let storageScope = 'guest';
function storageKey() { return storageScope === 'guest' ? 'field-settings' : `field-settings:${storageScope}`; }
export function setSettingsScope(scope) {
  storageScope = scope && scope !== 'guest' ? String(scope).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'guest' : 'guest';
}
export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    delete stored.color; delete stored.cosmetics;
    return { ...defaults, ...stored };
  } catch { return { ...defaults }; }
}
export function saveSettings(value) {
  try { const { color, cosmetics, ...profile } = value; localStorage.setItem(storageKey(), JSON.stringify(profile)); } catch { /* storage can be unavailable in private contexts */ }
}
