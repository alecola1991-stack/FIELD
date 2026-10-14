import { TEAM_COUNTRIES, TEAM_GROUPS, PROFILE_TEAMS, getTeamById } from '../config/teams.js';

export function selectionFor(teamId) {
  const team = getTeamById(teamId) || PROFILE_TEAMS[0];
  const country = TEAM_COUNTRIES.find(item => item.groups.includes(team.league));
  return { team, country, league: TEAM_GROUPS.find(item => item.id === team.league) };
}

export function cycleTeamSelection(teamId, kind, direction) {
  const { team, country } = selectionFor(teamId);
  const cycle = (list, index) => list[(index + direction + list.length) % list.length];
  if (kind === 'country') {
    const next = cycle(TEAM_COUNTRIES, TEAM_COUNTRIES.indexOf(country));
    return PROFILE_TEAMS.find(item => next.groups.includes(item.league)).id;
  }
  if (kind === 'league') {
    const next = cycle(country.groups, country.groups.indexOf(team.league));
    return PROFILE_TEAMS.find(item => item.league === next).id;
  }
  const teams = PROFILE_TEAMS.filter(item => item.league === team.league);
  return cycle(teams, teams.findIndex(item => item.id === team.id)).id;
}

export function teamAbbreviation(name) {
  const words = name.replace(/\s+(CF|FC)$/i, '').split(/\s+/).filter(word => !/^(de|del|la|the)$/i.test(word));
  return (words.length > 1 ? words.map(word => word[0]).join('').slice(0, 3) : words[0]?.slice(0, 3) || 'FA').toUpperCase();
}
