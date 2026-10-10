import { CUP_COMPETITIONS } from './Competitions.js';
import { TEAM_LEAGUES } from '../config/teams.js';

export const ACHIEVEMENTS = [
  { id: 'first-match', name: 'Debutante', icon: '⚽', description: 'Juega tu primer partido.', requirement: 'Juega 1 partido.', test: ({ stats }) => stats.matches >= 1 },
  { id: 'first-win', name: 'Primera victoria', icon: '✦', description: 'Consigue tu primera victoria.', requirement: 'Gana 1 partido.', test: ({ stats }) => stats.wins >= 1 },
  { id: 'five-wins', name: 'En racha', icon: '↗', description: 'Suma cinco victorias en tu carrera.', requirement: 'Gana 5 partidos.', test: ({ stats }) => stats.wins >= 5 },
  { id: 'ten-matches', name: 'Fijo en el campo', icon: '◉', description: 'Completa diez partidos.', requirement: 'Juega 10 partidos.', test: ({ stats }) => stats.matches >= 10 },
  { id: 'ten-goals', name: 'Puntería', icon: '◎', description: 'Marca diez goles en partidos.', requirement: 'Marca 10 goles en partidos.', test: ({ stats }) => stats.goalsFor >= 10 },
  { id: 'training-ten', name: 'Entrenamiento constante', icon: '⌁', description: 'Marca diez goles entrenando.', requirement: 'Marca 10 goles en entrenamiento.', test: ({ stats }) => stats.trainingGoals >= 10 },
  { id: 'season-complete', name: 'Temporada completa', icon: '▤', description: 'Termina una temporada de liga.', requirement: 'Completa las 16 jornadas de una liga.', test: ({ stats }) => stats.leagueSeasons >= 1 },
  { id: 'level-five', name: 'Nivel 5', icon: '⬆', description: 'Alcanza el nivel 5.', requirement: 'Alcanza el nivel 5 de experiencia.', test: ({ progression }) => progression.level >= 5 },
];

export const TROPHY_CATALOG = [
  ...ACHIEVEMENTS,
  ...CUP_COMPETITIONS.map(cup => ({ id: cup.id, name: cup.name, icon: '♜', description: 'Conquista la ' + cup.name + '.', requirement: 'Gana la final de ' + cup.name + '.', test: ({ trophies }) => trophies.has(cup.id) })),
  ...TEAM_LEAGUES.map(league => ({ id: 'league-' + league.id, name: 'Campeón · ' + league.label.split(' · ')[0], icon: '♛', description: 'Termina primero en ' + league.label.split(' · ')[0] + '.', requirement: 'Completa la liga con al menos 30 puntos.', test: ({ trophies }) => trophies.has('league-' + league.id) })),
];

export function formatPlayTime(seconds = 0) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return hours ? hours + ' h ' + minutes + ' min' : minutes + ' min';
}
