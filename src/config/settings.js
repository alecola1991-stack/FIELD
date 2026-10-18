// The pitch keeps its playing dimensions while the wider canvas leaves room
// for players to step half a center-circle radius beyond each touchline.
export const WORLD = Object.freeze({ width: 1140, height: 700, left: 66, right: 1074, top: 70, bottom: 630, goalTop: 255, goalBottom: 445, goalBack: 37, centerCircleRadius: 75, goalPostRadius: 6 });
// `skills` (Profesional and Champions): carry the ball close, feint and use the walls.
export const BOT_LEVELS = Object.freeze({
  easy: { speed: 165, reaction: .49, accuracy: .385, defense: .266 },
  normal: { speed: 196, reaction: .286, accuracy: .553, defense: .455 },
  hard: { speed: 221, reaction: .156, accuracy: .658, defense: .616 },
  pro: { speed: 240, reaction: .11, accuracy: .74, defense: .72,
    skills: { shootRange: 380, feintChance: .55, feintShow: .24, feintCut: .42, feintCooldown: 2.2, wallChance: .45, wallCooldown: 2.6 } },
  champions: { speed: 262, reaction: .075, accuracy: .84, defense: .82,
    skills: { shootRange: 430, feintChance: .82, feintShow: .2, feintCut: .45, feintCooldown: 1.4, wallChance: .7, wallCooldown: 1.8 } },
  legend: { speed: 295, reaction: .055, accuracy: .96, defense: .93 },
});
// Selectable difficulties (ids are stored in saves; labels are what players see).
export const DIFFICULTIES = Object.freeze([
  { id: 'easy', label: 'Principiante', unlock: 1 },
  { id: 'normal', label: 'Avanzado', unlock: 1 },
  { id: 'hard', label: 'Experto', unlock: 5 },
  { id: 'pro', label: 'Profesional', unlock: 10 },
  { id: 'champions', label: 'Champions', unlock: 15 },
]);
// Automatic difficulty: the rival's stars pick the AI level (1★ Principiante … 5★ Champions).
export const STAR_DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard', 'pro', 'champions']);
export function difficultyForStars(stars = 3) { return STAR_DIFFICULTIES[Math.max(1, Math.min(5, Math.round(Number(stars) || 3))) - 1]; }
// XP multiplier for a win against a rival with these stars (+10 % per star).
export function starXpMultiplier(stars = 0) { return 1 + Math.max(0, Math.min(5, Math.round(Number(stars) || 0))) * .1; }
export function difficultyLabel(id) { return id === 'legend' ? 'Leyenda' : DIFFICULTIES.find(item => item.id === id)?.label || 'Principiante'; }
const defaults = { name: 'JUGADOR', number: 10, teamId: '', profileReady: false, leagueCompetition: 'laliga', leagueGoalTarget: 2, difficulty: 'easy', sound: true, volume: 45, musicEnabled: true, musicVolume: 35, ambienceEnabled: true, ambienceVolume: 50, effectsVolume: 100, controllerVibration: true, controllerMap: {}, trajectory: false, shotPreview: false, goalReplays: true, verticalField: true, modifiers: {}, soloFormat: '1v1', mateDifficulty: 'normal', goldKit: false, customDifficulty: false, gameplay: 'arcade' };
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
