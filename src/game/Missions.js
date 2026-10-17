// Mission board: one active mission per difficulty tier. Completing one replaces it with a new mission of the same
// tier (a different one when possible) whose goal grows with the missions already completed in that tier.
export const MISSION_TIERS = [
  { id: 'easy', label: 'Fácil', xp: 60 },
  { id: 'medium', label: 'Media', xp: 150 },
  { id: 'hard', label: 'Difícil', xp: 300 },
  { id: 'elite', label: 'Élite', xp: 600 },
];

const RANK = { easy: 0, normal: 1, hard: 2, pro: 3, champions: 4, legend: 5 };
const rank = event => (event.mode === 'online' || !(event.difficulty in RANK)) ? -1 : RANK[event.difficulty];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// count: progress += count(event). streak: a qualifying win adds one, any other match resets it.
export const MISSION_TEMPLATES = [
  { id: 'play', tier: 'easy', title: 'En el campo', text: n => `Juega ${plural(n, 'partido', 'partidos')}.`, base: 3, grow: 1, max: 8, count: () => 1 },
  { id: 'win', tier: 'easy', title: 'Primeras victorias', text: n => `Gana ${plural(n, 'partido', 'partidos')}.`, base: 2, grow: 1, max: 6, count: e => e.won ? 1 : 0 },
  { id: 'goals', tier: 'easy', title: 'Olfato de gol', text: n => `Marca ${plural(n, 'gol', 'goles')}.`, base: 6, grow: 2, max: 20, count: e => e.goalsFor },
  { id: 'duo-win', tier: 'easy', title: 'Juego en equipo', text: n => `Gana ${plural(n, 'partido', 'partidos')} de 2 contra 2.`, base: 1, grow: 1, max: 4, count: e => e.won && e.duo ? 1 : 0 },
  { id: 'competition-play', tier: 'easy', title: 'Competidor', text: n => `Juega ${plural(n, 'partido', 'partidos')} de liga o torneo.`, base: 2, grow: 1, max: 6, count: e => e.competitionMode ? 1 : 0 },

  { id: 'streak-3', tier: 'medium', title: 'En racha', text: n => `Gana ${n} partidos seguidos.`, base: 3, grow: 1, max: 5, streak: () => true },
  { id: 'clean-sheet', tier: 'medium', title: 'Portería a cero', text: n => `Gana ${plural(n, 'partido', 'partidos')} sin encajar gol.`, base: 1, grow: 1, max: 4, count: e => e.won && e.goalsAgainst === 0 ? 1 : 0 },
  { id: 'thrashing', tier: 'medium', title: 'Goleada', text: n => `Gana ${plural(n, 'partido', 'partidos')} por 3 o más goles de diferencia.`, base: 1, grow: 1, max: 3, count: e => e.won && e.goalsFor - e.goalsAgainst >= 3 ? 1 : 0 },
  { id: 'competition-wins', tier: 'medium', title: 'Racha competitiva', text: n => `Gana ${plural(n, 'partido', 'partidos')} de liga o torneo.`, base: 3, grow: 1, max: 8, count: e => e.won && e.competitionMode ? 1 : 0 },
  { id: 'expert-wins', tier: 'medium', title: 'Nivel Experto', text: n => `Gana ${plural(n, 'partido', 'partidos')} contra la IA en Experto o superior.`, base: 2, grow: 1, max: 6, minLevel: 5, count: e => e.won && rank(e) >= 2 ? 1 : 0 },

  { id: 'streak-5', tier: 'hard', title: 'Imparable', text: n => `Gana ${n} partidos seguidos.`, base: 5, grow: 1, max: 8, streak: () => true },
  { id: 'final-goal', tier: 'hard', title: 'Gol en la final', text: n => n === 1 ? 'Marca en la final de un torneo.' : `Marca en ${n} finales de torneo.`, base: 1, grow: 1, max: 3, count: e => e.isFinal && e.goalsFor > 0 ? 1 : 0 },
  { id: 'competition-season', tier: 'hard', title: 'Temporada de éxito', text: n => `Gana ${n} partidos de liga o torneo.`, base: 8, grow: 2, max: 16, count: e => e.won && e.competitionMode ? 1 : 0 },
  { id: 'expert-clean', tier: 'hard', title: 'Muro', text: n => `Gana ${plural(n, 'partido', 'partidos')} sin encajar en Experto o superior.`, base: 1, grow: 1, max: 3, minLevel: 5, count: e => e.won && e.goalsAgainst === 0 && rank(e) >= 2 ? 1 : 0 },
  { id: 'pro-wins', tier: 'hard', title: 'Profesional', text: n => `Gana ${plural(n, 'partido', 'partidos')} contra la IA en Profesional o superior.`, base: 2, grow: 1, max: 6, minLevel: 10, count: e => e.won && rank(e) >= 3 ? 1 : 0 },

  { id: 'cup-champion', tier: 'elite', title: 'Levanta la copa', text: n => n === 1 ? 'Gana un torneo.' : `Gana ${n} torneos.`, base: 1, grow: 1, max: 3, count: e => e.isChampion ? 1 : 0 },
  { id: 'league-champion', tier: 'elite', title: 'Rey de la liga', text: n => n === 1 ? 'Gana una liga nacional.' : `Gana ${n} ligas nacionales.`, base: 1, grow: 1, max: 2, count: e => e.isLeagueChampion ? 1 : 0 },
  { id: 'world-cup', tier: 'elite', title: 'Campeón del mundo', text: () => 'Gana el Mundial con una selección.', base: 1, grow: 0, max: 1, count: e => e.isChampion && e.competitionId === 'world-cup' ? 1 : 0 },
  { id: 'streak-8', tier: 'elite', title: 'Invencible', text: n => `Gana ${n} partidos seguidos.`, base: 8, grow: 2, max: 12, streak: () => true },
  { id: 'champions-wins', tier: 'elite', title: 'Leyenda viva', text: n => `Gana ${plural(n, 'partido', 'partidos')} contra la IA en Champions o Leyenda.`, base: 3, grow: 1, max: 6, minLevel: 15, count: e => e.won && rank(e) >= 4 ? 1 : 0 },
];

const TEMPLATE = Object.fromEntries(MISSION_TEMPLATES.map(item => [item.id, item]));
export const tierOf = id => MISSION_TIERS.find(tier => tier.id === id) || MISSION_TIERS[0];
export const templateOf = id => TEMPLATE[id] || null;

// Goal and reward for the n-th mission of a tier (n = missions already completed in it).
export function missionStats(template, completedInTier = 0) {
  const tier = tierOf(template.tier), n = Math.max(0, completedInTier | 0);
  return { goal: Math.min(template.max, template.base + template.grow * Math.floor(n / 2)), xp: Math.round(tier.xp * (1 + .1 * Math.min(n, 10))) };
}

export function createMission(tierId, { level = 1, completed = 0, exclude = [], seq = 0, random = Math.random } = {}) {
  const pool = MISSION_TEMPLATES.filter(item => item.tier === tierId && (item.minLevel || 1) <= level);
  const fresh = pool.filter(item => !exclude.includes(item.id));
  const choices = fresh.length ? fresh : pool;
  const template = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  const { goal, xp } = missionStats(template, completed);
  return { uid: `${tierId}-${seq}`, tier: tierId, template: template.id, goal, xp, progress: 0 };
}

// Display data for an active mission.
export function describeMission(mission) {
  const template = templateOf(mission.template);
  return { ...mission, title: template?.title || 'Misión', description: template ? template.text(mission.goal) : '', tierLabel: tierOf(mission.tier).label };
}

// Applies one match to a mission; returns true when it completes.
export function advanceMission(mission, event) {
  const template = templateOf(mission.template);
  if (!template) return false;
  if (template.streak) mission.progress = event.won && template.streak(event) ? mission.progress + 1 : 0;
  else mission.progress += Math.max(0, Math.floor(Number(template.count(event)) || 0));
  mission.progress = Math.min(mission.goal, mission.progress);
  return mission.progress >= mission.goal;
}
