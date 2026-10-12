import { getTeamById } from './teams.js';

export const LEGENDS_UNLOCK_LEVEL = 7;
export const LEGEND_MATCHES = [
  { id: 'sevilla-2022', name: 'El Gran Derbi', edition: 'Copa del Rey · 2022', teams: ['laliga-sevilla', 'laliga-betis'], history: 'El Betis ganó 2–1 el derbi de octavos de Copa en enero de 2022. Ahora puedes reescribir el resultado con cualquiera de los dos equipos.', source: 'https://www.laliga.com/partido/temporada-2021-2022-copa-del-rey-real-betis-sevilla-fc-4' },
  { id: 'clasico-2014', name: 'El Clásico de Mestalla', edition: 'Final de Copa del Rey · 2014', teams: ['laliga-real-madrid', 'laliga-barcelona'], history: 'La final de 2014 terminó 2–1 para el Madrid, con el recordado gol de Bale. Elige tu lado y escribe otra final.', source: 'https://www.realmadrid.com/es-ES/noticias/club/actualidad/decimo-aniversario-de-la-19-copa-del-rey-16-04-2024' },
  { id: 'lisboa-2025', name: 'Derbi de Lisboa en el Jamor', edition: 'Final de Taça de Portugal · 2025', teams: ['liga-portugal-sporting', 'liga-portugal-benfica'], history: 'Sporting remontó y venció 3–1 al Benfica tras la prórroga en la final de 2025. Revive la rivalidad de Lisboa.', source: 'https://www.sporting.pt/en/news/football/main-team/2025-05-25/epic-turnaround-sees-sporting-cp-win-taca-de-portugal' },
  { id: 'wembley-2013', name: 'Der Klassiker en Wembley', edition: 'Final de Champions · 2013', teams: ['bundesliga-bayern', 'bundesliga-dortmund'], history: 'Bayern y Dortmund se encontraron en la final europea de 2013. Un gol tardío de Robben decidió el 2–1. Aquí decides tú quién gana.', source: 'https://www.uefa.com/uefachampionsleague/news/0250-0c50ff9a7f18-7e59ddb15025-1000/' },
  { id: 'paris-2018', name: 'La noche del Parc', edition: 'Ligue 1 · 2018', teams: ['ligue-1-psg', 'ligue-1-monaco'], history: 'El PSG recuperó el título francés con un histórico 7–1 frente al Monaco en 2018. Puedes defender París o buscar la revancha monegasca.', source: 'https://en.psg.fr/teams/club/content/qsi-in-paris-10-years-of-big-games-psg-history-retro' },
  { id: 'manchester-2012', name: 'El derbi que acercó el título', edition: 'Premier League · 2012', teams: ['premier-man-united', 'premier-man-city'], history: 'El City venció 1–0 al United con un cabezazo de Kompany en abril de 2012, en plena lucha por la liga. Elige rojo o azul.', source: 'https://www.mancity.com/citytv/mens/highlights-city-1-0-manchester-united-2012-63723833' },
];

export function resolveLegendMatch(matchId, playerTeamId, level) {
  if (!Number.isFinite(Number(level)) || Number(level) < LEGENDS_UNLOCK_LEVEL) throw new Error('Leyendas se desbloquea al nivel 7.');
  const match = LEGEND_MATCHES.find(item => item.id === matchId);
  if (!match || !match.teams.includes(playerTeamId)) throw new Error('Elige uno de los dos equipos de este partido.');
  return { match, playerTeam: getTeamById(playerTeamId), opponentTeam: getTeamById(match.teams.find(id => id !== playerTeamId)), difficulty: 'legend' };
}
