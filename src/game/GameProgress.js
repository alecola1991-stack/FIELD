import { TEAM_LEAGUES, FEDERATION_LEAGUE_IDS } from '../config/teams.js';
import { ACHIEVEMENTS } from './Achievements.js';
import { LEGEND_MATCHES } from '../config/legends.js';
import { DIFFICULTIES } from '../config/settings.js';
import { RANKS } from '../config/ranks.js';

// Game completion: eight weighted categories add up to 100 %. Every milestone that is not
// already a profile trophy is stored as a trophy with a `progress-` id, so it syncs with the account.
export const PROGRESS_PREFIX = 'progress-';
export const MAX_LEVEL = 100;
export const CUP_IDS = ['champions', 'copa-libertadores', 'club-world-cup', 'world-cup', 'euro', 'copa-america'];
const CUP_NAMES = { champions: 'Champions', 'copa-libertadores': 'Copa Libertadores', 'club-world-cup': 'Mundial de Clubes', 'world-cup': 'Mundial', euro: 'Eurocopa', 'copa-america': 'Copa América' };
export const TOP_LEAGUES = TEAM_LEAGUES.filter(league => (league.tier ?? 1) === 1 && !FEDERATION_LEAGUE_IDS.has(league.id));
export const CAREER_MILESTONES = [
  { id: 'finish', label: 'Termina una carrera', hint: 'Juega las 10 temporadas del Modo Carrera.' },
  { id: 'pro', label: 'Carrera de Profesional', hint: 'Termina una carrera con 300 puntos o más.' },
  { id: 'star', label: 'Carrera de Estrella', hint: 'Termina una carrera con 800 puntos o más.' },
  { id: 'legend', label: 'Carrera de Leyenda', hint: 'Termina una carrera con 1.500 puntos o más.' },
  { id: 'world-cup', label: 'Campeón del mundo en carrera', hint: 'Gana el Mundial con tu selección en el Modo Carrera.' },
  { id: 'climb', label: 'De 4ª a 1ª', hint: 'Empieza en la 4ª división y llega a primera en una carrera.' },
];
export const progressId = (category, id) => `${PROGRESS_PREFIX}${category}-${id}`;

export const PROGRESS_CATEGORIES = [
  { id: 'cups', label: 'Copas', weight: 20, icon: 'cup', action: 'competitions' },
  { id: 'leagues', label: 'Ligas', weight: 20, icon: 'league', action: 'competitions' },
  { id: 'career', label: 'Modo Carrera', weight: 15, icon: 'career', action: 'career' },
  { id: 'level', label: 'Nivel', weight: 15, icon: 'level', action: 'bot' },
  { id: 'difficulty', label: 'Dificultades', weight: 10, icon: 'difficulty', action: 'bot' },
  { id: 'legends', label: 'Leyendas', weight: 10, icon: 'legends', action: 'legends' },
  { id: 'achievements', label: 'Logros', weight: 5, icon: 'achievements', action: 'bot' },
  { id: 'online', label: 'Online', weight: 5, icon: 'online', action: 'online' },
];

export const PROGRESS_TITLES = [
  { min: 100, label: 'Completista' }, { min: 75, label: 'Maestro' }, { min: 50, label: 'Veterano' }, { min: 25, label: 'Aficionado' }, { min: 0, label: 'Novato' },
];
export const progressTitle = percent => PROGRESS_TITLES.find(title => percent >= title.min) || PROGRESS_TITLES.at(-1);

// trophyIds: ids of every unlocked profile trophy (including `progress-` ones); level: player level.
export function computeProgress({ trophyIds = [], level = 1 } = {}) {
  const has = new Set(trophyIds);
  const lists = {
    cups: CUP_IDS.map(id => ({ id, label: CUP_NAMES[id], hint: `Gana la final de ${CUP_NAMES[id]}.`, done: has.has(id) })),
    leagues: TOP_LEAGUES.map(league => ({ id: league.id, label: league.label.split(' · ')[0], group: league.label.split(' · ')[1]?.replace(/\s+\d.*$/, '') || '', hint: `Gana una temporada de Liga Nacional en ${league.label.split(' · ')[0]}.`, done: has.has(`league-${league.id}`) })),
    career: CAREER_MILESTONES.map(item => ({ ...item, done: has.has(progressId('career', item.id)) })),
    difficulty: DIFFICULTIES.map(item => ({ id: item.id, label: `Gana en ${item.label}`, hint: item.unlock > 1 ? `Gana un partido contra la IA en ${item.label} (se desbloquea en el nivel ${item.unlock}).` : `Gana un partido contra la IA en ${item.label}.`, locked: (Number(level) || 1) < item.unlock, done: has.has(progressId('difficulty', item.id)) })),
    legends: LEGEND_MATCHES.map(item => ({ id: item.id, label: item.name, hint: `${item.edition}. Gana el partido en Leyendas.`, done: has.has(progressId('legend', item.id)) })),
    achievements: ACHIEVEMENTS.map(item => ({ id: item.id, label: item.name, hint: item.requirement, done: has.has(item.id) })),
    online: RANKS.map(rank => ({ id: rank.id, label: `Rango ${rank.name}`, hint: rank.min ? `Llega a ${rank.min} ELO en Ranked.` : 'Juega tu primera partida Ranked.', done: has.has(progressId('rank', rank.id)) })),
  };
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  const categories = PROGRESS_CATEGORIES.map(category => {
    if (category.id === 'level') {
      const marks = [5, 10, 15, 25, 50, 75, 100].map(mark => ({ id: `level-${mark}`, label: `Nivel ${mark}`, hint: mark === 5 || mark === 10 || mark === 15 ? 'Desbloquea una dificultad nueva.' : 'Gana experiencia jugando y con misiones.', done: safeLevel >= mark }));
      return { ...category, done: safeLevel, total: MAX_LEVEL, ratio: safeLevel / MAX_LEVEL, items: marks, countLabel: `Nivel ${safeLevel}/${MAX_LEVEL}` };
    }
    const items = lists[category.id], done = items.filter(item => item.done).length;
    return { ...category, done, total: items.length, ratio: items.length ? done / items.length : 0, items, countLabel: `${done}/${items.length}` };
  });
  const raw = categories.reduce((sum, category) => sum + category.weight * category.ratio, 0);
  // Never round up to 100 until everything is done.
  const percent = raw >= 100 - 1e-9 ? 100 : Math.min(99, Math.floor(raw));
  return { percent, exact: raw, complete: percent === 100, title: progressTitle(percent), categories, nearest: nearestGoals(categories) };
}

// Pending goals sorted by how close their category is to completion (closest first).
export function nearestGoals(categories, limit = 3) {
  const goals = [];
  for (const category of categories) {
    if (category.ratio >= 1) continue;
    // Goals that can be played now go first; locked ones only when nothing else is left.
    const next = category.items.find(item => !item.done && !item.locked); if (!next) continue;
    const left = category.id === 'level' ? MAX_LEVEL - category.done : category.total - category.done;
    goals.push({ category, item: next, left, score: category.ratio + 1 / (left + 1) });
  }
  return goals.sort((a, b) => b.score - a.score).slice(0, limit);
}
