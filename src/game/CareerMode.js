import { TEAM_LEAGUES, TEAM_COUNTRIES, TEAMS, NATIONAL_TEAMS, getTeamById } from '../config/teams.js';

// Career mode: ten simulated seasons. Each season the player plays one match per competition
// their team is in (the league's decisive match and the final of the continental cup, Club World
// Cup and national team tournament), first to 2 goals; those results decide promotions, titles and
// the trophy cabinet. Careers saved with the earlier format (two matches per competition) still
// play out with it. Pure logic, no DOM: the UI lives in CareerScreen.
export const CAREER_SEASONS = 10;
export const CAREER_GOAL_TARGET = 2;
export const CAREER_POINTS = Object.freeze({
  league: 100, promotion: 50, champions: 250, 'copa-libertadores': 250, 'club-world-cup': 300,
  euro: 250, 'copa-america': 250, 'world-cup': 500, loyalty: 100,
});
export const CAREER_TITLES = Object.freeze([
  { min: 1500, id: 'legend', label: 'Leyenda' },
  { min: 800, id: 'star', label: 'Estrella' },
  { min: 300, id: 'pro', label: 'Profesional' },
  { min: 0, id: 'rookie', label: 'Promesa' },
]);
export const COMPETITION_NAMES = Object.freeze({
  champions: 'Champions', 'copa-libertadores': 'Copa Libertadores', 'club-world-cup': 'Mundial de Clubes',
  'world-cup': 'Mundial', euro: 'Eurocopa', 'copa-america': 'Copa América',
});
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'pro', 'champions'];
const UNLOCK = { easy: 1, normal: 1, hard: 5, pro: 10, champions: 15 };

const NATIONAL_BY_COUNTRY = {
  spain: 'europe-spain', england: 'europe-england', italy: 'europe-italy', france: 'europe-france', germany: 'europe-germany',
  argentina: 'america-argentina', mexico: 'america-mexico', brazil: 'america-brazil', 'north-america': 'america-usa',
  portugal: 'europe-portugal', belgium: 'europe-belgium', turkey: 'europe-turkiye', netherlands: 'europe-netherlands',
  scotland: 'europe-scotland', 'saudi-arabia': 'asia-saudi-arabia', colombia: 'america-colombia', chile: 'america-chile',
  uruguay: 'america-uruguay', austria: 'europe-austria', switzerland: 'europe-switzerland',
};
const EUROPE = new Set(['spain', 'england', 'italy', 'france', 'germany', 'portugal', 'belgium', 'turkey', 'netherlands', 'scotland', 'austria', 'switzerland']);
const SOUTH_AMERICA = new Set(['argentina', 'brazil', 'colombia', 'chile', 'uruguay']);

const leagueById = id => TEAM_LEAGUES.find(league => league.id === id) || null;
export const leagueTier = id => leagueById(id)?.tier ?? 1;
export const leagueName = id => (leagueById(id)?.label || id || '').split(' · ')[0];
export const countryOfLeague = id => TEAM_COUNTRIES.find(country => country.groups.includes(id))?.id || null;
export const nationalTeamFor = countryId => NATIONAL_BY_COUNTRY[countryId] || null;
export function leaguesOf(countryId) {
  const country = TEAM_COUNTRIES.find(item => item.id === countryId);
  return country ? TEAM_LEAGUES.filter(league => country.groups.includes(league.id)) : [];
}
// Countries with club leagues and a national team.
export function careerCountries() {
  return TEAM_COUNTRIES.filter(country => NATIONAL_BY_COUNTRY[country.id] && leaguesOf(country.id).length)
    .map(country => ({ id: country.id, label: country.label, nationalId: NATIONAL_BY_COUNTRY[country.id], tiers: [...new Set(leaguesOf(country.id).map(league => league.tier ?? 1))].sort() }));
}
export function continentalFor(countryId) {
  if (EUROPE.has(countryId)) return 'champions';
  if (SOUTH_AMERICA.has(countryId)) return 'copa-libertadores';
  return null;
}
// National team tournaments: World Cup in seasons 2, 6 and 10; continental cup in 4 and 8.
export function nationalTournamentFor(countryId, season) {
  if ([2, 6, 10].includes(season)) return 'world-cup';
  if (![4, 8].includes(season)) return null;
  const group = getTeamById(NATIONAL_BY_COUNTRY[countryId])?.league;
  return group === 'europe' ? 'euro' : group === 'america' ? 'copa-america' : null;
}
export function careerTitle(score) { return CAREER_TITLES.find(title => score >= title.min) || CAREER_TITLES.at(-1); }

function pickOne(items, random) { return items[Math.min(items.length - 1, Math.floor(random() * items.length))]; }
function weightedPick(items, weight, random) {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = random() * total;
  for (const item of items) { roll -= weight(item); if (roll <= 0) return item; }
  return items.at(-1);
}
const clubsOf = leagueId => TEAMS.filter(team => team.league === leagueId);

// Five starting clubs from the chosen country. Lower divisions are more likely (each step down
// doubles the chance) and, inside a division, weaker clubs are more likely too.
export function createStartingOffers(countryId, random = Math.random, count = 5) {
  const leagues = leaguesOf(countryId);
  const tiers = [...new Set(leagues.map(league => league.tier ?? 1))];
  const picked = new Set();
  const available = () => tiers.filter(tier => leagues.some(league => (league.tier ?? 1) === tier && clubsOf(league.id).some(team => !picked.has(team.id))));
  const total = leagues.reduce((sum, league) => sum + clubsOf(league.id).length, 0);
  while (picked.size < Math.min(count, total)) {
    const tierOptions = available(); if (!tierOptions.length) break;
    const tier = weightedPick(tierOptions, item => 2 ** (item - 1), random);
    const pool = leagues.filter(league => (league.tier ?? 1) === tier).flatMap(league => clubsOf(league.id)).filter(team => !picked.has(team.id));
    const team = weightedPick(pool, item => 6 - Math.min(5, item.stars || 3), random);
    picked.add(team.id);
  }
  return [...picked].sort((a, b) => leagueTier(getTeamById(b).league) - leagueTier(getTeamById(a).league) || (getTeamById(a).stars || 3) - (getTeamById(b).stars || 3));
}

export function createCareer({ countryId, clubId, format = '1v1', random = Math.random, now = Date.now() } = {}) {
  const club = getTeamById(clubId);
  if (!NATIONAL_BY_COUNTRY[countryId] || !club || club.type === 'national') throw new Error('Elige un país y un club para empezar.');
  const state = {
    v: 1, id: `career-${now}`, startedAt: now, country: countryId, nationalId: NATIONAL_BY_COUNTRY[countryId],
    format: format === '2v2' ? '2v2' : '1v1', startClubId: club.id, clubId: club.id, season: 1, phase: 'season',
    reachedTopFlight: leagueTier(club.league) === 1, qualified: { continental: null, clubWorldCup: false },
    plan: null, history: [], trophies: [], offers: [], finalScore: null,
  };
  state.plan = createSeasonPlan(state, random);
  return state;
}

// ---- Opponents -----------------------------------------------------------
const topFlightClubs = countries => TEAMS.filter(team => leagueTier(team.league) === 1 && countries.has(countryOfLeague(team.league)));
function strongest(pool, exclude, random, minStars) {
  const free = pool.filter(team => !exclude.has(team.id));
  if (!free.length) return null;
  const best = Math.max(...free.map(team => team.stars || 3));
  const floor = Math.min(best, minStars ?? best);
  return pickOne(free.filter(team => (team.stars || 3) >= floor), random);
}
function leagueOpponents(clubId, leagueId, random) {
  const pool = clubsOf(leagueId).filter(team => team.id !== clubId);
  const exclude = new Set();
  const first = pickOne(pool, random); exclude.add(first.id);
  // The second key match is against one of the strongest clubs of the division.
  const second = strongest(pool, exclude, random, Math.max(...pool.map(team => team.stars || 3)) - 1) || pickOne(pool.filter(team => !exclude.has(team.id)), random);
  return [first, second];
}
function cupOpponents(competitionId, ownId, countryId, random) {
  // countryId: where the club plays (decides the Club World Cup semi-final rival).
  const exclude = new Set([ownId]);
  let semiPool, finalPool;
  if (competitionId === 'champions') { semiPool = finalPool = topFlightClubs(EUROPE); }
  else if (competitionId === 'copa-libertadores') { semiPool = finalPool = topFlightClubs(SOUTH_AMERICA); }
  else if (competitionId === 'club-world-cup') {
    semiPool = EUROPE.has(countryId) ? topFlightClubs(SOUTH_AMERICA) : topFlightClubs(new Set([...SOUTH_AMERICA, 'mexico', 'north-america', 'saudi-arabia']));
    finalPool = topFlightClubs(EUROPE);
  } else {
    const region = competitionId === 'euro' ? 'europe' : competitionId === 'copa-america' ? 'america' : null;
    semiPool = finalPool = NATIONAL_TEAMS.filter(team => !region || team.league === region);
  }
  const semi = strongest(semiPool, exclude, random, 4) || pickOne(semiPool.filter(team => !exclude.has(team.id)), random);
  exclude.add(semi.id);
  const final = strongest(finalPool, exclude, random);
  return [semi, final];
}

// ---- Season plan ---------------------------------------------------------
function match(opponent, label, difficulty) { return { opponentId: opponent.id, label, difficulty, result: null }; }
function leagueDifficulty(tier) { return tier >= 4 ? 'easy' : tier === 3 ? 'normal' : tier === 2 ? 'normal' : 'hard'; }
export function cupStage(competitionId, state, random = Math.random) {
  const national = ['world-cup', 'euro', 'copa-america'].includes(competitionId);
  const teamId = national ? state.nationalId : state.clubId;
  const [, final] = cupOpponents(competitionId, teamId, national ? state.country : countryOfLeague(careerLeagueOf(state, state.clubId)), random);
  const hard = competitionId === 'world-cup' || competitionId === 'club-world-cup';
  return {
    id: national ? 'national' : competitionId === 'club-world-cup' ? 'club-world-cup' : 'continental', kind: 'cup', competitionId, teamId,
    name: COMPETITION_NAMES[competitionId], status: 'pending', outcome: null,
    matches: [match(final, 'Final', hard ? 'champions' : 'pro')],
  };
}
export function createSeasonPlan(state, random = Math.random) {
  const club = getTeamById(state.clubId), leagueId = careerLeagueOf(state, club.id), tier = leagueTier(leagueId);
  const [, rival] = leagueOpponents(club.id, leagueId, random);
  const difficulty = leagueDifficulty(tier);
  const stages = [{
    id: 'league', kind: 'league', competitionId: leagueId, teamId: club.id, name: leagueName(leagueId), status: 'pending', outcome: null,
    matches: [match(rival, 'Partido decisivo', difficulty)],
  }];
  if (state.qualified?.continental) stages.push(cupStage(state.qualified.continental, state, random));
  if (state.qualified?.clubWorldCup) stages.push(cupStage('club-world-cup', state, random));
  const national = (state.reachedTopFlight || tier === 1) ? nationalTournamentFor(state.country, state.season) : null;
  if (national) stages.push(cupStage(national, state, random));
  return { season: state.season, clubId: club.id, leagueId, tier, stages };
}

// The next match to play: { stage, match, stageIndex, matchIndex } or null when the season is over.
export function nextCareerMatch(state) {
  const stages = state?.plan?.stages || [];
  for (let s = 0; s < stages.length; s++) {
    if (stages[s].status === 'done') continue;
    const m = stages[s].matches.findIndex(item => !item.result);
    if (m >= 0) return { stage: stages[s], match: stages[s].matches[m], stageIndex: s, matchIndex: m };
  }
  return null;
}
// Difficulty actually used: the match's own level, capped by what the player's level has unlocked.
export function careerDifficulty(difficulty, level = 1) {
  let index = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));
  while (index > 0 && level < UNLOCK[DIFFICULTY_ORDER[index]]) index--;
  return DIFFICULTY_ORDER[index];
}

function award(state, kind, competitionId, label, teamId) {
  const trophy = { kind, competitionId, label, teamId, season: state.season, points: CAREER_POINTS[kind] ?? CAREER_POINTS[competitionId] ?? 0 };
  state.trophies.push(trophy); return trophy;
}

// Records the result of the current match. Returns what happened, for the result screen.
export function recordCareerMatch(state, goalsFor, goalsAgainst, random = Math.random) {
  const current = nextCareerMatch(state); if (!current) return null;
  const { stage, match: played } = current, won = goalsFor > goalsAgainst;
  played.result = { goalsFor, goalsAgainst, won };
  stage.status = 'playing';
  const event = { stage, won, trophy: null, eliminated: false, stageDone: false, seasonDone: false };
  if (stage.kind === 'cup') {
    if (!won) { stage.status = 'done'; stage.outcome = played.label === 'Final' ? 'runner-up' : 'eliminated'; event.eliminated = true; }
    else if (played.label === 'Final') {
      stage.status = 'done'; stage.outcome = 'champion';
      event.trophy = award(state, stage.competitionId, stage.competitionId, COMPETITION_NAMES[stage.competitionId], stage.teamId);
      // Continental champions play the Club World Cup in the same season.
      if (stage.id === 'continental' && !state.plan.stages.some(item => item.competitionId === 'club-world-cup')) {
        const at = state.plan.stages.indexOf(stage) + 1;
        state.plan.stages.splice(at, 0, cupStage('club-world-cup', state, random));
        event.clubWorldCup = true;
      }
    }
  } else if (stage.matches.every(item => item.result)) { stage.status = 'done'; }
  event.stageDone = stage.status === 'done';
  if (!nextCareerMatch(state)) { event.seasonDone = true; event.summary = finishSeason(state, random); }
  return event;
}

// League outcome (no draws: every match has a winner). One decisive match (current format):
// win: champion; lose by one goal: promotion play-off at 50 %; lose by more: lower half.
// Two key matches (careers saved before): 2 wins: champion. 1 win: goal difference decides
// (positive: runner-up and promotion; level: play-off; negative: mid-table). 0 wins: lower half.
// No relegation.
export function leagueOutcome(matches, random = Math.random) {
  const wins = matches.filter(item => item.result?.won).length;
  const difference = matches.reduce((sum, item) => sum + (item.result ? item.result.goalsFor - item.result.goalsAgainst : 0), 0);
  if (matches.length === 1) {
    if (wins) return { id: 'champion', wins, difference, points: 3 };
    if (difference === -1) return { id: random() < .5 ? 'playoff-won' : 'playoff-lost', wins, difference, points: 0 };
    return { id: 'low', wins, difference, points: 0 };
  }
  if (wins >= 2) return { id: 'champion', wins, difference, points: 6 };
  if (wins === 1 && difference > 0) return { id: 'runner-up', wins, difference, points: 4 };
  if (wins === 1 && difference === 0) return { id: random() < .5 ? 'playoff-won' : 'playoff-lost', wins, difference, points: 3 };
  if (wins === 1) return { id: 'mid', wins, difference, points: 3 };
  return { id: 'low', wins, difference, points: 0 };
}
export function higherLeague(leagueId, random = Math.random) {
  const tier = leagueTier(leagueId), leagues = leaguesOf(countryOfLeague(leagueId)).filter(league => (league.tier ?? 1) < tier);
  if (!leagues.length) return null;
  const target = Math.max(...leagues.map(league => league.tier ?? 1));
  return pickOne(leagues.filter(league => (league.tier ?? 1) === target), random).id;
}

// Simulated final table: every club gets points from its strength plus luck; the player's club
// takes the position its outcome gives.
export function simulateLeagueTable(leagueId, clubId, position, random = Math.random) {
  const others = clubsOf(leagueId).filter(team => team.id !== clubId);
  const rounds = Math.max(2, others.length * 2);
  const rows = others.map(team => ({ teamId: team.id, points: Math.round(rounds * (.55 + (team.stars || 3) * .22 + random() * .7)) }))
    .sort((a, b) => b.points - a.points);
  const at = Math.max(0, Math.min(rows.length, position - 1));
  const points = at === 0 ? (rows[0]?.points || 0) + 1 + Math.floor(random() * 5) : Math.max(rows[at]?.points ?? 0, rows[at - 1].points - 1);
  rows.splice(at, 0, { teamId: clubId, points, player: true });
  return rows;
}
function positionFor(outcome, size, random) {
  if (outcome === 'champion') return 1;
  if (outcome === 'runner-up') return 2;
  if (outcome.startsWith('playoff')) return 3 + Math.floor(random() * 2);
  const mid = Math.floor(size / 2);
  if (outcome === 'mid') return 5 + Math.floor(random() * Math.max(1, mid - 4));
  return mid + 1 + Math.floor(random() * Math.max(1, size - mid - 1));
}

export function finishSeason(state, random = Math.random) {
  const plan = state.plan, league = plan.stages.find(stage => stage.id === 'league');
  const outcome = leagueOutcome(league.matches, random);
  league.outcome = outcome.id;
  const size = clubsOf(plan.leagueId).filter(team => team.id !== plan.clubId).length + 1, position = positionFor(outcome.id, size, random);
  const trophies = [];
  if (outcome.id === 'champion') trophies.push(award(state, 'league', plan.leagueId, leagueName(plan.leagueId), plan.clubId));
  const promoted = plan.tier > 1 && ['champion', 'runner-up', 'playoff-won'].includes(outcome.id);
  const nextLeague = promoted ? higherLeague(plan.leagueId, random) : null;
  if (promoted && nextLeague) trophies.push(award(state, 'promotion', nextLeague, `Ascenso a ${leagueName(nextLeague)}`, plan.clubId));
  // Qualification for next season: league champions of a top flight go to their continental cup
  // (or straight to the Club World Cup where the game has no continental cup).
  const continental = continentalFor(countryOfLeague(plan.leagueId));
  const topChampion = plan.tier === 1 && outcome.id === 'champion';
  state.qualified = { continental: topChampion && continental ? continental : null, clubWorldCup: topChampion && !continental };
  const cupTrophies = state.trophies.filter(item => item.season === state.season && !trophies.includes(item));
  const summary = {
    season: state.season, clubId: plan.clubId, leagueId: plan.leagueId, tier: plan.tier, outcome: outcome.id, wins: outcome.wins,
    difference: outcome.difference, position, size, promoted: !!(promoted && nextLeague), nextLeague,
    table: simulateLeagueTable(plan.leagueId, plan.clubId, position, random),
    stages: plan.stages.map(stage => ({ id: stage.id, competitionId: stage.competitionId, name: stage.name, outcome: stage.outcome, teamId: stage.teamId, results: stage.matches.map(item => item.result && { ...item.result, opponentId: item.opponentId, label: item.label }) })),
    trophies: [...cupTrophies, ...trophies],
    points: [...cupTrophies, ...trophies].reduce((sum, item) => sum + item.points, 0),
  };
  state.history.push(summary);
  state.nextLeagueId = nextLeague || plan.leagueId;
  state.offers = state.season < CAREER_SEASONS ? createTransferOffers(state, outcome.id, random) : [];
  state.phase = 'summary';
  return summary;
}

// Transfer offers after every season: better seasons bring offers from bigger clubs.
export function createTransferOffers(state, outcomeId, random = Math.random) {
  const current = getTeamById(state.clubId), nextLeague = state.nextLeagueId || careerLeagueOf(state, current.id), tier = leagueTier(nextLeague);
  const country = countryOfLeague(nextLeague), leagues = leaguesOf(country);
  const exclude = new Set([current.id]), offers = [];
  const add = (pool, reason, minStars) => {
    const team = minStars ? strongest(pool, exclude, random, minStars) : (pool.filter(item => !exclude.has(item.id)).length ? pickOne(pool.filter(item => !exclude.has(item.id)), random) : null);
    if (team) { exclude.add(team.id); offers.push({ teamId: team.id, reason }); }
  };
  const inTier = target => leagues.filter(league => (league.tier ?? 1) === target).flatMap(league => clubsOf(league.id));
  const good = ['champion', 'runner-up', 'playoff-won'].includes(outcomeId);
  if (good) {
    if (tier > 1) add(inTier(tier - 1), 'Un club de una división superior quiere ficharte');
    add(inTier(tier), 'Un club más fuerte de tu nueva división', (current.stars || 3) + 1);
    if (tier === 1 && outcomeId === 'champion') {
      const abroad = TEAMS.filter(team => leagueTier(team.league) === 1 && countryOfLeague(team.league) !== country && EUROPE.has(countryOfLeague(team.league)));
      add(abroad, 'Un grande del extranjero llama a tu puerta', 5);
    }
  } else if (outcomeId === 'mid' || outcomeId === 'playoff-lost') {
    add(inTier(tier), 'Un club de tu división confía en ti');
    if (tier > 1 && random() < .5) add(inTier(tier - 1), 'Un club modesto de la división superior');
  } else {
    add(inTier(tier), 'Un club de tu división te ofrece un cambio de aires');
    if (inTier(tier + 1).length) add(inTier(tier + 1), 'Un club de una división inferior te quiere de líder');
  }
  if (!offers.length) add(inTier(tier), 'Un club de tu división confía en ti');
  return offers.slice(0, 3);
}

// Moves to the next season: staying (teamId null or the same club) or accepting an offer.
export function startNextSeason(state, teamId = null, random = Math.random) {
  if (state.phase !== 'summary') return state;
  if (state.season >= CAREER_SEASONS) return finishCareer(state);
  const currentLeague = careerLeagueOf(state, state.clubId);
  const accepted = teamId && teamId !== state.clubId && state.offers.some(offer => offer.teamId === teamId) ? getTeamById(teamId) : null;
  if (accepted) {
    state.clubId = accepted.id; state.qualified = { continental: null, clubWorldCup: false };
  } else if (state.nextLeagueId && state.nextLeagueId !== currentLeague) {
    // The club keeps its identity; for the career it now plays in the higher division.
    state.leagueOverrides ||= {}; state.leagueOverrides[state.clubId] = state.nextLeagueId;
  }
  state.season++; state.offers = []; state.nextLeagueId = null;
  state.reachedTopFlight ||= leagueTier(careerLeagueOf(state, state.clubId)) === 1;
  state.plan = createSeasonPlan(state, random);
  state.phase = 'season';
  return state;
}
// League a club plays in during this career (promoted clubs move up).
export function careerLeagueOf(state, clubId) { return state?.leagueOverrides?.[clubId] || getTeamById(clubId)?.league; }

export function careerScore(state) {
  const trophies = (state?.trophies || []).reduce((sum, item) => sum + (item.points || 0), 0);
  return trophies + (state?.loyalty ? CAREER_POINTS.loyalty : 0);
}
export function finishCareer(state) {
  state.loyalty = state.clubId === state.startClubId;
  state.finalScore = careerScore(state); state.phase = 'finished'; state.plan = null; state.offers = [];
  return state;
}

// Persistence ---------------------------------------------------------------
const SAVE_KEY = 'field-career-mode-v1';
let scope = 'guest';
export function setCareerScope(value) { scope = String(value || 'guest'); }
const key = () => scope === 'guest' ? SAVE_KEY : `${SAVE_KEY}:${scope}`;
export function loadCareer() {
  try { const state = JSON.parse(localStorage.getItem(key()) || 'null'); return isValidCareer(state) ? state : null; } catch { return null; }
}
export function saveCareer(state) { try { localStorage.setItem(key(), JSON.stringify(state)); } catch { /* Storage full or blocked. */ } }
export function loadCareerBest() { try { return JSON.parse(localStorage.getItem(`${key()}:best`) || 'null'); } catch { return null; } }
// Stores the score if it beats the record; returns true for a new record.
export function saveCareerBest(score, title) {
  const best = loadCareerBest(); if (best && best.score >= score) return false;
  try { localStorage.setItem(`${key()}:best`, JSON.stringify({ score, title, at: Date.now() })); } catch { /* ignore */ }
  return true;
}
export function clearCareer() { try { localStorage.removeItem(key()); } catch { /* ignore */ } }
export function isValidCareer(state) {
  return !!state && state.v === 1 && !!getTeamById(state.clubId) && !!getTeamById(state.nationalId) && Number.isInteger(state.season)
    && state.season >= 1 && state.season <= CAREER_SEASONS && ['season', 'summary', 'finished'].includes(state.phase)
    && Array.isArray(state.history) && Array.isArray(state.trophies) && (state.phase !== 'season' || Array.isArray(state.plan?.stages));
}
