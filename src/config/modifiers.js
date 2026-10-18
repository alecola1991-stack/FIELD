import { WORLD } from './settings.js';

export const MODIFIER_OPTIONS = Object.freeze([
  { key: 'ballSize', label: 'Tamaño del balón', description: 'Cambia el círculo completo y sus colisiones.', min: .5, max: 2, step: .1, default: 1 },
  { key: 'playerSize', label: 'Tamaño de los jugadores', description: 'Se aplica a los dos jugadores.', min: .6, max: 1.6, step: .1, default: 1 },
  { key: 'goalSize', label: 'Longitud de las porterías', description: 'Amplía o reduce la abertura de ambas porterías.', min: .7, max: 1.7, step: .1, default: 1 },
  { key: 'playerSpeed', label: 'Velocidad de los jugadores', description: 'Ajusta el ritmo de movimiento de ambos equipos.', min: .5, max: 1.8, step: .1, default: 1 },
  { key: 'shotPower', label: 'Fuerza de los disparos', description: 'Modifica tiros normales, tiros de fuego y la ayuda de tiro.', min: .5, max: 1.8, step: .1, default: 1 },
  { key: 'powerCooldown', label: 'Espera del tiro de fuego', description: 'Segundos entre dos tiros fuertes.', min: 3, max: 60, step: 1, default: 20, unit: 's' },
  { key: 'goalTarget', label: 'Goles para ganar', description: '0 conserva la regla del modo. En entrenamiento no hay límite.', min: 0, max: 10, step: 1, default: 0, unit: 'goals' },
]);
export const DEFAULT_MODIFIERS = Object.freeze(Object.fromEntries(MODIFIER_OPTIONS.map(option => [option.key, option.default])));
export function normalizeModifiers(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(MODIFIER_OPTIONS.map(option => {
    const raw = input[option.key];
    const number = typeof raw === 'number' || typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    const clamped = Number.isFinite(number) ? Math.max(option.min, Math.min(option.max, number)) : option.default;
    return [option.key, Number((Math.round(clamped / option.step) * option.step).toFixed(2))];
  }));
}
export function modifiersAreDefault(value) {
  const rules = normalizeModifiers(value);
  return MODIFIER_OPTIONS.every(option => rules[option.key] === option.default);
}
// `scale` enlarges the pitch (3 contra 3 in Táctico: 1.3) keeping the goals and the margins the same size.
export function modifierWorld(value, scale = 1) {
  const rules = normalizeModifiers(value);
  const base = scale === 1 ? WORLD : {
    ...WORLD, width: Math.round(WORLD.width * scale), height: Math.round(WORLD.height * scale),
    right: Math.round(WORLD.width * scale) - (WORLD.width - WORLD.right), bottom: Math.round(WORLD.height * scale) - (WORLD.height - WORLD.bottom),
    centerCircleRadius: Math.round(WORLD.centerCircleRadius * scale),
  };
  const center = base.height / 2;
  const half = (WORLD.goalBottom - WORLD.goalTop) * rules.goalSize / 2;
  const depth = Math.max(WORLD.left - WORLD.goalBack, 24 * rules.ballSize + 5);
  return Object.freeze({ ...base, goalTop: center - half, goalBottom: center + half, goalBack: base.left - depth });
}
export function formatModifier(option, value) {
  if (option.unit === 's') return `${value} s`;
  if (option.unit === 'goals') return value === 0 ? 'Según el modo' : `${value} ${value === 1 ? 'gol' : 'goles'}`;
  return `${Math.round(value * 100)}%`;
}
