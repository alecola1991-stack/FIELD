import { TEAM_LEAGUES, TEAMS, NATIONAL_TEAMS, FEDERATION_LEAGUE_IDS, getTeamById } from '../config/teams.js';

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
  // Federation (RFEF) groups are not drawn as Champions rivals.
  for (const league of TEAM_LEAGUES.filter(item => !FEDERATION_LEAGUE_IDS.has(item.id))) {
    if (randomRivals.length >= slots) break;
    const pool = TEAMS.filter(team => team.league === league.id && !pickedIds.has(team.id));
    if (!pool.length) continue;
    const team = pick(pool, random);
    randomRivals.push(team); pickedIds.add(team.id);
  }

  const remaining = TEAMS.filter(team => !pickedIds.has(team.id) && !FEDERATION_LEAGUE_IDS.has(team.league));
  while (randomRivals.length < slots) {
    const team = pick(remaining, random);
    randomRivals.push(team); pickedIds.add(team.id);
    remaining.splice(remaining.indexOf(team), 1);
  }

  return seedProgressively(playerTeam, [...fixedRivals, ...randomRivals], random);
}

export const CUP_COMPETITIONS = [
  { id: 'champions', name: 'Champions', eyebrow: 'COPA DE CLUBES', description: '16 clubes. Cuatro rondas y un solo campeón.', type: 'club', fieldTheme: 'champions' },
  { id: 'copa-libertadores', name: 'Copa Libertadores', eyebrow: 'TORNEO DE CLUBES · CONMEBOL', description: '32 clubes clasificados en la edición 2026; competición en modo arcade.', type: 'club', fieldTheme: 'copa-libertadores', teamPool: 'libertadores' },
  { id: 'club-world-cup', name: 'Mundial de Clubes', eyebrow: 'TORNEO MUNDIAL · FIFA', description: 'Los 32 clubes de la edición FIFA 2025, en formato arcade.', type: 'club', fieldTheme: 'club-world-cup', teamPool: 'club-world-cup' },
  { id: 'league', name: 'Liga Nacional', eyebrow: 'TEMPORADA', description: 'Una temporada completa en cualquiera de las divisiones disponibles.', type: 'club', fieldTheme: 'league' },
  { id: 'world-cup', name: 'Mundial', eyebrow: 'TORNEO DE SELECCIONES', description: 'Las selecciones de Europa y América se cruzan por el título.', type: 'world', fieldTheme: 'world-cup' },
  { id: 'euro', name: 'Eurocopa', eyebrow: 'TORNEO DE SELECCIONES', description: '16 selecciones europeas. Eliminatorias hasta la final.', type: 'europe', fieldTheme: 'euro' },
  { id: 'copa-america', name: 'Copa América', eyebrow: 'TORNEO DE SELECCIONES', description: '16 selecciones americanas en busca de la copa.', type: 'america', fieldTheme: 'copa-america' },
];

const cupClub = (id, name, country, primary, secondary, stars = 3) => ({
  id: `cup-${id}`, name, league: `cup-${country}`, country, primary, secondary, stars,
  kitPattern: 'vertical-stripes', numberColor: primary.match(/[0-9a-f]{6}/i) ? (Number.parseInt(primary.slice(1), 16) > 0x888888 ? '#172027' : '#ffffff') : '#ffffff', type: 'club',
});

// Official 2026 Libertadores group-stage field. Club identities and colors are
// included for teams outside the leagues currently selectable in the game.
const LIBERTADORES_TEAMS = [
  ['argentina-boca','Boca Juniors','argentina','#153E7E','#F4D21F',5],['argentina-estudiantes','Estudiantes de La Plata','argentina','#D71920','#FFFFFF',4],['argentina-independiente-rivadavia','Independiente Rivadavia','argentina','#1766AA','#171717',3],['argentina-lanus','Lanús','argentina','#8A2438','#FFFFFF',4],['argentina-rosario-central','Rosario Central','argentina','#F5D21B','#1766AA',4],['argentina-platense','Platense','argentina','#171717','#FFFFFF',3],
  ['brasileirao-corinthians','Corinthians','brazil','#FFFFFF','#171717',5],['brasileirao-cruzeiro','Cruzeiro','brazil','#1766AA','#FFFFFF',4],['brasileirao-flamengo','Flamengo','brazil','#D71920','#171717',5],['brasileirao-fluminense','Fluminense','brazil','#7A2139','#167A48',4],['brasileirao-mirassol','Mirassol','brazil','#F5D21B','#167A48',3],['brasileirao-palmeiras','Palmeiras','brazil','#167A48','#FFFFFF',5],
  ['cup-peñarol','Peñarol','uruguay','#F5D21B','#171717',5],['cup-nacional','Nacional','uruguay','#1766AA','#FFFFFF',5],['cup-coquimbo','Coquimbo Unido','chile','#F5D21B','#171717',3],['cup-universidad-catolica','Universidad Católica','chile','#FFFFFF','#1766AA',4],['cup-tolima','Deportes Tolima','colombia','#D71920','#F5D21B',3],['cup-medellin','Independiente Medellín','colombia','#D71920','#171717',4],['cup-junior','Junior','colombia','#D71920','#FFFFFF',4],['cup-santa-fe','Santa Fe','colombia','#D71920','#FFFFFF',4],['cup-barcelona-ecuador','Barcelona SC','ecuador','#F5D21B','#171717',4],['cup-independiente-valle','Independiente del Valle','ecuador','#171717','#1766AA',4],['cup-liga-quito','Liga de Quito','ecuador','#FFFFFF','#D71920',4],['cup-cerro','Cerro Porteño','paraguay','#1766AA','#D71920',4],['cup-libertad','Libertad','paraguay','#F5D21B','#171717',4],['cup-cusco','Cusco FC','peru','#6B3FA0','#D71920',3],['cup-sporting-cristal','Sporting Cristal','peru','#79BCE8','#FFFFFF',4],['cup-universitario','Universitario','peru','#8A2438','#F5D21B',4],['cup-always-ready','Always Ready','bolivia','#D71920','#FFFFFF',3],['cup-bolivar','Bolívar','bolivia','#1766AA','#FFFFFF',4],['cup-la-guaira','Deportivo La Guaira','venezuela','#F07825','#171717',3],['cup-universidad-central','Universidad Central','venezuela','#D71920','#FFFFFF',3],
].map(([id,name,country,primary,secondary,stars]) => getTeamById(id) || cupClub(id.replace('cup-',''),name,country,primary,secondary,stars));

// The confirmed 32-club 2025 FIFA Club World Cup field.
const CLUB_WORLD_CUP_IDS = [
  'cup-ahly','cup-al-ain','cup-al-hilal','laliga-atletico','cup-auckland','bundesliga-bayern','argentina-boca','brasileirao-botafogo',
  'bundesliga-dortmund','liga-mx-monterrey','liga-mx-pachuca','premier-chelsea','mls-lafc','cup-es-tunis','liga-portugal-porto','cup-salzburg',
  'brasileirao-flamengo','brasileirao-fluminense','serie-a-inter','serie-a-juventus','premier-man-city','cup-sundowns','brasileirao-palmeiras','ligue-1-psg',
  'laliga-real-madrid','argentina-river','mls-seattle','liga-portugal-benfica','cup-ulsan','cup-urawa','cup-wydad','mls-inter-miami',
];
const CLUB_WORLD_CUP_EXTRA = {
  'cup-ahly': ['Al Ahly','egypt','#D71920','#FFFFFF',5], 'cup-al-ain':['Al Ain','uae','#6B3FA0','#FFFFFF',4], 'cup-al-hilal':['Al Hilal','saudi-arabia','#1766AA','#FFFFFF',5], 'cup-auckland':['Auckland City','new-zealand','#1766AA','#FFFFFF',2], 'cup-botafogo':['Botafogo','brazil','#171717','#FFFFFF',4], 'cup-es-tunis':['ES Tunis','tunisia','#D71920','#F5D21B',4], 'cup-salzburg':['FC Salzburg','austria','#FFFFFF','#D71920',4], 'cup-sundowns':['Mamelodi Sundowns','south-africa','#F5D21B','#1766AA',4], 'cup-ulsan':['Ulsan HD','south-korea','#1766AA','#F5D21B',4], 'cup-urawa':['Urawa Red Diamonds','japan','#D71920','#FFFFFF',4], 'cup-wydad':['Wydad AC','morocco','#D71920','#FFFFFF',4],
};
const CLUB_WORLD_CUP_TEAMS = CLUB_WORLD_CUP_IDS.map(id => getTeamById(id) || cupClub(id.replace('cup-',''), ...CLUB_WORLD_CUP_EXTRA[id]));

function createClubCupDraw(playerTeamId, pool, random) {
  const player = getTeamById(playerTeamId);
  if (!player || player.type === 'national') throw new Error('Selecciona un club para iniciar la copa.');
  const teams = pool.filter(team => team.id !== player.id);
  if (!pool.some(team => team.id === player.id)) throw new Error('El club elegido no está en los participantes de esta edición.');
  return seedProgressively(player, teams, random);
}

export function createLibertadoresDraw(playerTeamId, random = Math.random) {
  const player = getTeamById(playerTeamId);
  if (!player || !LIBERTADORES_TEAMS.some(team => team.id === player.id)) throw new Error('Este club no está clasificado para la Copa Libertadores 2026.');
  return createClubCupDraw(playerTeamId, LIBERTADORES_TEAMS, random);
}

export function isLibertadoresEligibleTeam(teamId) {
  return LIBERTADORES_TEAMS.some(team => team.id === teamId);
}

export function createClubWorldCupDraw(playerTeamId, random = Math.random) {
  if (!CLUB_WORLD_CUP_TEAMS.some(team => team.id === playerTeamId)) throw new Error('El club elegido no está clasificado para el Mundial de Clubes 2025.');
  return createClubCupDraw(playerTeamId, CLUB_WORLD_CUP_TEAMS, random);
}

export function isClubWorldCupEligibleTeam(teamId) {
  return CLUB_WORLD_CUP_TEAMS.some(team => team.id === teamId);
}

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
    // Recent form (last five results) for the standings table: W / D / L.
    const outcome = homeGoals > awayGoals ? ['W', 'L'] : awayGoals > homeGoals ? ['L', 'W'] : ['D', 'D'];
    homeRow.form = [...(homeRow.form || []), outcome[0]].slice(-5);
    awayRow.form = [...(awayRow.form || []), outcome[1]].slice(-5);
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
