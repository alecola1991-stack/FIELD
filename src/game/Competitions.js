import { TEAM_LEAGUES, TEAMS, NATIONAL_TEAMS, getTeamById } from '../config/teams.js';

export const CHAMPIONS_CORE = [
  'laliga-barcelona', 'laliga-real-madrid', 'laliga-atletico', 'ligue-1-psg', 'ligue-1-monaco',
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

function seedProgressively(player, rivals, random) {
  const tiers = new Map();
  for (const team of rivals) {
    const tier = tiers.get(team.stars || 3) || [];
    tier.push(team); tiers.set(team.stars || 3, tier);
  }
  const seeded = [];
  for (const stars of [...tiers.keys()].sort((a, b) => a - b)) seeded.push(...shuffle(tiers.get(stars), random));
  return [player, ...seeded];
}

export function createChampionsDraw(playerTeamId, random = Math.random) {
  const playerTeam = getTeamById(playerTeamId);
  if (!playerTeam || playerTeam.type === 'national') throw new Error('Selecciona un club para iniciar la copa.');

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

  return seedProgressively(playerTeam, [...fixedRivals, ...randomRivals], random);
}

export const CUP_COMPETITIONS = [
  { id: 'champions', name: 'Champions', eyebrow: 'COPA DE CLUBES', description: '16 clubes. Cuatro rondas y un solo campeón.', type: 'club', fieldTheme: 'champions' },
  { id: 'league', name: 'Liga Nacional', eyebrow: 'TEMPORADA', description: 'Una temporada completa en cualquiera de las divisiones disponibles.', type: 'club', fieldTheme: 'league' },
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
  return seedProgressively(selected[0], selected.slice(1), random);
}

export function createLeagueOpponents(leagueId, playerTeamId, random = Math.random) {
  return shuffle(TEAMS.filter(team => team.league === leagueId && team.id !== playerTeamId), random)
    .map(team => ({ team, seed: (team.stars || 3) + (random() - .5) * .9 }))
    .sort((a, b) => a.seed - b.seed).map(entry => entry.team);
}

export function createLeagueSchedule(leagueId, playerTeamId, random = Math.random, opponentOrder = null) {
  const playerTeam = getTeamById(playerTeamId);
  if (!playerTeam || playerTeam.league !== leagueId || playerTeam.type === 'national') {
    throw new Error('Elige un club que pertenezca a esta liga.');
  }
  const roster = TEAMS.filter(team => team.league === leagueId);
  const suppliedOrder = Array.isArray(opponentOrder)
    ? opponentOrder.map(team => roster.find(club => club.id === team?.id)).filter(Boolean)
    : [];
  const opponents = suppliedOrder.length === roster.length - 1
    ? suppliedOrder
    : createLeagueOpponents(leagueId, playerTeamId, random);
  let rotation = [playerTeam, ...opponents];
  if (rotation.length % 2) rotation.push(null);
  const rawRounds = [];
  const rounds = rotation.length - 1;
  for (let round = 0; round < rounds; round++) {
    const fixtures = [];
    for (let index = 0; index < rotation.length / 2; index++) {
      let home = rotation[index], away = rotation[rotation.length - 1 - index];
      if (!home || !away) continue;
      if ((round + index) % 2) [home, away] = [away, home];
      fixtures.push({ homeId: home.id, awayId: away.id });
    }
    rawRounds.push(fixtures);
    rotation = [rotation[0], rotation.at(-1), ...rotation.slice(1, -1)];
  }
  const playerRound = new Map(rawRounds.map((fixtures, index) => {
    const opponent = fixtures.find(fixture => fixture.homeId === playerTeamId || fixture.awayId === playerTeamId);
    return [opponent?.homeId === playerTeamId ? opponent.awayId : opponent?.homeId, index];
  }));
  return opponents.map(team => rawRounds[playerRound.get(team.id)]);
}

export function createLeagueStandings(leagueId) {
  return TEAMS.filter(team => team.league === leagueId).map(team => ({
    teamId: team.id, played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
  }));
}

export function updateLeagueStandings(standings, fixtures, playerTeamId, playerGoals, opponentGoals, random = Math.random) {
  const updated = standings.map(row => ({ ...row }));
  const rows = new Map(updated.map(row => [row.teamId, row]));
  for (const fixture of fixtures) {
    const home = getTeamById(fixture.homeId), away = getTeamById(fixture.awayId);
    if (!home || !away) continue;
    let homeGoals, awayGoals;
    if (home.id === playerTeamId) { homeGoals = playerGoals; awayGoals = opponentGoals; }
    else if (away.id === playerTeamId) { homeGoals = opponentGoals; awayGoals = playerGoals; }
    else {
      const homeStrength = ((home.stars || 3) - 3) * .24 + .12;
      const awayStrength = ((away.stars || 3) - 3) * .24;
      homeGoals = Math.max(0, Math.min(5, Math.round(1.1 + homeStrength + (random() - .5) * 2.8)));
      awayGoals = Math.max(0, Math.min(5, Math.round(1.1 + awayStrength + (random() - .5) * 2.8)));
    }
    const homeRow = rows.get(home.id), awayRow = rows.get(away.id);
    if (!homeRow || !awayRow) continue;
    homeRow.played++; awayRow.played++;
    homeRow.goalsFor += homeGoals; homeRow.goalsAgainst += awayGoals;
    awayRow.goalsFor += awayGoals; awayRow.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals) { homeRow.wins++; homeRow.points += 3; awayRow.losses++; }
    else if (awayGoals > homeGoals) { awayRow.wins++; awayRow.points += 3; homeRow.losses++; }
    else { homeRow.draws++; awayRow.draws++; homeRow.points++; awayRow.points++; }
    homeRow.goalDifference = homeRow.goalsFor - homeRow.goalsAgainst;
    awayRow.goalDifference = awayRow.goalsFor - awayRow.goalsAgainst;
  }
  return updated;
}

export function sortLeagueStandings(standings, playerTeamId) {
  return [...standings].sort((a, b) => b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || (a.teamId === playerTeamId ? -1 : b.teamId === playerTeamId ? 1 : a.teamId.localeCompare(b.teamId)));
}

export function pickChampionsOpponent(draw, round, random = Math.random) {
  if (round === 1) return draw[1];
  const start = 2 ** (round - 1), end = 2 ** round;
  return pick(draw.slice(start, end), random);
}
