export const MISSION_DEFINITIONS = [
  { id: 'competition-wins', title: 'Racha competitiva', description: 'Gana 3 partidos en una liga o torneo.', goal: 3, coins: 100, xp: 120 },
  { id: 'champions-final-goal', title: 'Gol de leyenda', description: 'Marca en la final de la Champions.', goal: 1, coins: 150, xp: 180 },
  { id: 'world-cup-champion', title: 'Campeón del mundo', description: 'Gana el Mundial con una selección.', goal: 1, coins: 300, xp: 350 },
];

export function getLeagueMission(teamId) {
  return { id: `league-champion:${teamId}`, title: 'Rey de la liga', description: 'Termina la temporada con al menos el 60 % de los puntos posibles.', goal: 1, coins: 220, xp: 250 };
}
