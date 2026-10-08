import { TEAM_LEAGUES, TEAMS, NATIONAL_TEAMS, getTeamById } from '../config/teams.js';

export const CHAMPIONS_CORE = [
  'laliga-barcelona', 'laliga-real-madrid', 'ligue-1-psg', 'ligue-1-monaco',
  'bundesliga-dortmund', 'bundesliga-bayern', 'serie-a-inter', 'serie-a-milan',
];

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pick(items, random) {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

export function createChampionsDraw(playerTeamId, random = Math.random) {
  const playerTeam = getTeamById(playerTeamId);
  if (!playerTeam) throw new Error('Selecciona un equipo para iniciar la copa.');

  const required = CHAMPIONS_CORE.map(getTeamById);
  const fixedRivals = required.filter(team => team.id !== playerTeam.id);
  const pickedIds = new Set([playerTeam.id, ...fixedRivals.map(team => team.id)]);
  const randomRivals = [];
  const slots = 15 - fixedRivals.length;

  // Include at least one randomly drawn club from every available league.
  for (const league of TEAM_LEAGUES) {
    if (randomRivals.length >= slots) break;
    const pool = TEAMS.filter(team => team.league === league.id && !pickedIds.has(team.id));
    if (!pool.length) continue;
    const team = pick(pool, random);
    randomRivals.push(team); pickedIds.add(team.id);
  }

  const remaining = TEAMS.filter(team => !pickedIds.has(team.id));
  while (randomRivals.length < slots) {
    const team = pick(remaining, random);
    randomRivals.push(team); pickedIds.add(team.id);
    remaining.splice(remaining.indexOf(team), 1);
  }

  return [playerTeam, ...shuffle([...fixedRivals, ...randomRivals], random)];
}

export const CUP_COMPETITIONS = [
  { id: 'champions', name: 'Champions', eyebrow: 'COPA DE CLUBES', description: '16 clubes. Cuatro rondas y un solo campeón.', type: 'club', fieldTheme: 'champions' },
  { id: 'league', name: 'Liga Nacional', eyebrow: 'TEMPORADA', description: 'Dieciséis jornadas en una de las ligas disponibles.', type: 'club', fieldTheme: 'league' },
  { id: 'world-cup', name: 'Mundial', eyebrow: 'TORNEO DE SELECCIONES', description: 'Las selecciones de Europa y América se cruzan por el título.', type: 'world', fieldTheme: 'world-cup' },
  { id: 'euro', name: 'Eurocopa', eyebrow: 'TORNEO DE SELECCIONES', description: '16 selecciones europeas. Eliminatorias hasta la final.', type: 'europe', fieldTheme: 'euro' },
  { id: 'copa-america', name: 'Copa América', eyebrow: 'TORNEO DE SELECCIONES', description: '16 selecciones americanas en busca de la copa.', type: 'america', fieldTheme: 'copa-america' },
];

export function createInternationalDraw(competitionId, playerTeamId, random = Math.random) {
  const playerTeam = getTeamById(playerTeamId);
  if (!playerTeam || playerTeam.type !== 'national') throw new Error('Elige una selección para jugar este torneo.');
  const pool = NATIONAL_TEAMS.filter(team => team.league === 'europe' || team.league === 'america');
  let selected;
  if (competitionId === 'euro') {
    if (playerTeam.league !== 'europe') throw new Error('La Eurocopa requiere una selección europea.');
    selected = [playerTeam, ...shuffle(pool.filter(team => team.league === 'europe' && team.id !== playerTeam.id), random).slice(0, 15)];
  } else if (competitionId === 'copa-america') {
    if (playerTeam.league !== 'america') throw new Error('La Copa América requiere una selección americana.');
    selected = [playerTeam, ...shuffle(pool.filter(team => team.league === 'america' && team.id !== playerTeam.id), random).slice(0, 15)];
  } else if (competitionId === 'world-cup') {
    const otherRegion = playerTeam.league === 'europe' ? 'america' : 'europe';
    const sameRegion = shuffle(pool.filter(team => team.league === playerTeam.league && team.id !== playerTeam.id), random).slice(0, 7);
    const crossRegion = shuffle(pool.filter(team => team.league === otherRegion), random).slice(0, 8);
    selected = [playerTeam, ...sameRegion, ...crossRegion];
  } else throw new Error('Competición internacional no reconocida.');
  return [selected[0], ...shuffle(selected.slice(1), random)];
}

export function createLeagueOpponents(leagueId, playerTeamId, random = Math.random) {
  return shuffle(TEAMS.filter(team => team.league === leagueId && team.id !== playerTeamId), random).slice(0, 16);
}

export function pickChampionsOpponent(draw, round, random = Math.random) {
  if (round === 1) return draw[1];
  const start = 2 ** (round - 1), end = 2 ** round;
  return pick(draw.slice(start, end), random);
}
