// Current first-division club selector. Only names and color palettes are used;
// there are no crests, kit images, or copied league graphics.
export const TEAM_LEAGUES = [
  { id: 'laliga', label: 'LaLiga · España 26/27' },
  { id: 'premier', label: 'Premier League · Inglaterra 26/27' },
  { id: 'serie-a', label: 'Serie A · Italia 26/27' },
  { id: 'ligue-1', label: 'Ligue 1 · Francia 26/27' },
  { id: 'bundesliga', label: 'Bundesliga · Alemania 26/27' },
];

export const NATIONAL_GROUPS = [
  { id: 'europe', label: 'Europa · Selecciones', type: 'national' },
  { id: 'america', label: 'América · Selecciones', type: 'national' },
];

const define = (league, rows) => rows.map(([id, name, primary, secondary]) => ({ league, id: `${league}-${id}`, name: `${name} CF`, primary, secondary }));

export const TEAMS = [
  ...define('laliga', [
    ['athletic', 'Athletic Club', '#E32636', '#FFFFFF'], ['atletico', 'Atlético de Madrid', '#D71920', '#FFFFFF'],
    ['osasuna', 'Osasuna', '#D71920', '#13294B'], ['celta', 'Celta de Vigo', '#8CC7E8', '#FFFFFF'],
    ['alaves', 'Deportivo Alavés', '#1473B8', '#FFFFFF'], ['elche', 'Elche', '#178B55', '#FFFFFF'],
    ['barcelona', 'Barcelona', '#A50044', '#004D98'], ['getafe', 'Getafe', '#0053A0', '#FFFFFF'],
    ['levante', 'Levante', '#D71920', '#142D4E'], ['malaga', 'Málaga', '#5AADE0', '#FFFFFF'],
    ['racing', 'Racing Santander', '#147347', '#FFFFFF'], ['rayo', 'Rayo Vallecano', '#FFFFFF', '#D71920'],
    ['deportivo', 'Deportivo La Coruña', '#0875BC', '#FFFFFF'], ['espanyol', 'Espanyol', '#007FC8', '#FFFFFF'],
    ['betis', 'Real Betis', '#16834A', '#FFFFFF'], ['real-madrid', 'Real Madrid', '#F7F7F7', '#7B58A5'],
    ['sociedad', 'Real Sociedad', '#1766AA', '#FFFFFF'], ['sevilla', 'Sevilla', '#D71920', '#FFFFFF'],
    ['valencia', 'Valencia', '#171717', '#FFFFFF'], ['villarreal', 'Villarreal', '#FFE500', '#0755A4'],
  ]),
  ...define('premier', [
    ['arsenal', 'Arsenal', '#EF0107', '#FFFFFF'], ['aston-villa', 'Aston Villa', '#670E36', '#95BFE5'],
    ['bournemouth', 'Bournemouth', '#DA291C', '#171717'], ['brentford', 'Brentford', '#D71920', '#FFFFFF'],
    ['brighton', 'Brighton & Hove Albion', '#0057B8', '#FFFFFF'], ['chelsea', 'Chelsea', '#034694', '#FFFFFF'],
    ['coventry', 'Coventry City', '#73C3EA', '#FFFFFF'], ['crystal-palace', 'Crystal Palace', '#1B458F', '#C4122E'],
    ['everton', 'Everton', '#003399', '#FFFFFF'], ['fulham', 'Fulham', '#FFFFFF', '#171717'],
    ['hull', 'Hull City', '#F5A623', '#171717'], ['ipswich', 'Ipswich Town', '#0054A6', '#FFFFFF'],
    ['leeds', 'Leeds United', '#FFFFFF', '#1D428A'], ['liverpool', 'Liverpool', '#C8102E', '#FFFFFF'],
    ['man-city', 'Manchester City', '#6CABDD', '#FFFFFF'], ['man-united', 'Manchester United', '#DA291C', '#FBE122'],
    ['newcastle', 'Newcastle United', '#171717', '#FFFFFF'], ['nottingham', 'Nottingham Forest', '#DD0000', '#FFFFFF'],
    ['sunderland', 'Sunderland', '#EB172B', '#FFFFFF'], ['tottenham', 'Tottenham Hotspur', '#FFFFFF', '#132257'],
  ]),
  ...define('serie-a', [
    ['atalanta', 'Atalanta', '#142D4E', '#171717'], ['bologna', 'Bologna', '#D71920', '#142D4E'],
    ['cagliari', 'Cagliari', '#C8102E', '#003B7A'], ['como', 'Como', '#1766AA', '#FFFFFF'],
    ['fiorentina', 'Fiorentina', '#542583', '#FFFFFF'], ['frosinone', 'Frosinone', '#F5D61D', '#13294B'],
    ['genoa', 'Genoa', '#D71920', '#142D4E'], ['inter', 'Inter', '#0068A8', '#171717'],
    ['juventus', 'Juventus', '#171717', '#FFFFFF'], ['lazio', 'Lazio', '#87CEEB', '#142D4E'],
    ['lecce', 'Lecce', '#D71920', '#F5D61D'], ['milan', 'AC Milan', '#D71920', '#171717'],
    ['monza', 'Monza', '#D71920', '#FFFFFF'], ['napoli', 'Napoli', '#1687C9', '#FFFFFF'],
    ['parma', 'Parma', '#FFFFFF', '#173A70'], ['roma', 'Roma', '#8E1B32', '#E6B64C'],
    ['sassuolo', 'Sassuolo', '#167A48', '#171717'], ['torino', 'Torino', '#7C263A', '#FFFFFF'],
    ['udinese', 'Udinese', '#171717', '#FFFFFF'], ['venezia', 'Venezia', '#171717', '#D99A3D'],
  ]),
  ...define('ligue-1', [
    ['angers', 'Angers', '#171717', '#FFFFFF'], ['auxerre', 'Auxerre', '#1766AA', '#FFFFFF'],
    ['brest', 'Brest', '#D71920', '#FFFFFF'], ['le-havre', 'Le Havre', '#7CCBEF', '#142D4E'],
    ['le-mans', 'Le Mans', '#D71920', '#F2C230'], ['lens', 'Lens', '#D71920', '#F2C230'],
    ['lille', 'Lille', '#D71920', '#142D4E'], ['lorient', 'Lorient', '#F27A21', '#171717'],
    ['lyon', 'Olympique Lyonnais', '#D71920', '#1766AA'], ['marseille', 'Marseille', '#55B8E8', '#FFFFFF'],
    ['monaco', 'Monaco', '#D71920', '#FFFFFF'], ['nice', 'Nice', '#D71920', '#171717'],
    ['paris-fc', 'Paris FC', '#142D4E', '#8CC7E8'], ['psg', 'Paris Saint-Germain', '#142D4E', '#D71920'],
    ['rennes', 'Rennes', '#D71920', '#171717'], ['strasbourg', 'Strasbourg', '#1766AA', '#FFFFFF'],
    ['toulouse', 'Toulouse', '#6B3FA0', '#FFFFFF'], ['troyes', 'Troyes', '#1766AA', '#FFFFFF'],
  ]),
  ...define('bundesliga', [
    ['augsburg', 'Augsburg', '#167A48', '#FFFFFF'], ['union-berlin', 'Union Berlin', '#D71920', '#FFFFFF'],
    ['werder', 'Werder Bremen', '#167A48', '#FFFFFF'], ['dortmund', 'Borussia Dortmund', '#FDE100', '#171717'],
    ['elversberg', 'Elversberg', '#171717', '#FFFFFF'], ['frankfurt', 'Eintracht Frankfurt', '#D71920', '#171717'],
    ['freiburg', 'SC Freiburg', '#D71920', '#171717'], ['hamburg', 'Hamburger SV', '#1766AA', '#FFFFFF'],
    ['hoffenheim', 'Hoffenheim', '#1766AA', '#FFFFFF'], ['koln', 'FC Köln', '#D71920', '#FFFFFF'],
    ['leipzig', 'RB Leipzig', '#D71920', '#FFFFFF'], ['leverkusen', 'Bayer Leverkusen', '#D71920', '#171717'],
    ['mainz', 'Mainz 05', '#D71920', '#FFFFFF'], ['gladbach', 'Borussia Mönchengladbach', '#171717', '#FFFFFF'],
    ['bayern', 'Bayern München', '#D71920', '#1766AA'], ['paderborn', 'SC Paderborn 07', '#1766AA', '#171717'],
    ['schalke', 'Schalke 04', '#1766AA', '#FFFFFF'], ['stuttgart', 'VfB Stuttgart', '#FFFFFF', '#D71920'],
  ]),
];

const national = (group, rows) => rows.map(([id, name, primary, secondary]) => ({
  id: `${group}-${id}`, league: group, name, primary, secondary, type: 'national',
}));

export const NATIONAL_TEAMS = [
  ...national('europe', [
    ['spain', 'España', '#D92932', '#F6C945'], ['france', 'Francia', '#123B82', '#E84B55'],
    ['germany', 'Alemania', '#191919', '#D9B747'], ['italy', 'Italia', '#178B62', '#F4F2E9'],
    ['england', 'Inglaterra', '#F4F3EE', '#D83A43'], ['portugal', 'Portugal', '#137447', '#D6383E'],
    ['netherlands', 'Países Bajos', '#EE7623', '#183C73'], ['belgium', 'Bélgica', '#171717', '#D83B45'],
    ['croatia', 'Croacia', '#D83B45', '#F5F2E9'], ['denmark', 'Dinamarca', '#D83B45', '#F5F2E9'],
    ['sweden', 'Suecia', '#1765A8', '#F2D34E'], ['norway', 'Noruega', '#D83B45', '#173F75'],
    ['poland', 'Polonia', '#F4F3EE', '#D83B45'], ['switzerland', 'Suiza', '#D83B45', '#F4F3EE'],
    ['austria', 'Austria', '#D83B45', '#F4F3EE'], ['turkiye', 'Turquía', '#D83B45', '#F4F3EE'],
    ['serbia', 'Serbia', '#D83B45', '#173F75'], ['ukraine', 'Ucrania', '#1765A8', '#F2D34E'],
    ['scotland', 'Escocia', '#1765A8', '#F4F3EE'], ['wales', 'Gales', '#D83B45', '#F4F3EE'],
    ['greece', 'Grecia', '#1765A8', '#F4F3EE'], ['czechia', 'Chequia', '#D83B45', '#1765A8'],
    ['romania', 'Rumanía', '#D83B45', '#F2D34E'], ['hungary', 'Hungría', '#D83B45', '#16824E'],
  ]),
  ...national('america', [
    ['argentina', 'Argentina', '#79BCE8', '#F4F2E9'], ['brazil', 'Brasil', '#16874E', '#F3D344'],
    ['uruguay', 'Uruguay', '#79BCE8', '#F4F2E9'], ['colombia', 'Colombia', '#F0C72E', '#1765A8'],
    ['chile', 'Chile', '#D83B45', '#F4F2E9'], ['ecuador', 'Ecuador', '#F0C72E', '#1765A8'],
    ['paraguay', 'Paraguay', '#D83B45', '#1765A8'], ['peru', 'Perú', '#D83B45', '#F4F2E9'],
    ['venezuela', 'Venezuela', '#F0C72E', '#D83B45'], ['bolivia', 'Bolivia', '#D83B45', '#16824E'],
    ['mexico', 'México', '#16824E', '#F4F2E9'], ['usa', 'Estados Unidos', '#D83B45', '#1765A8'],
    ['canada', 'Canadá', '#D83B45', '#F4F2E9'], ['costa-rica', 'Costa Rica', '#D83B45', '#1765A8'],
    ['jamaica', 'Jamaica', '#16824E', '#F0C72E'], ['panama', 'Panamá', '#D83B45', '#1765A8'],
    ['honduras', 'Honduras', '#1765A8', '#F4F2E9'], ['guatemala', 'Guatemala', '#79BCE8', '#F4F2E9'],
  ]),
];

export const TEAM_GROUPS = [...TEAM_LEAGUES, ...NATIONAL_GROUPS];
export const PROFILE_TEAMS = [...TEAMS, ...NATIONAL_TEAMS];
const TEAM_MAP = new Map(PROFILE_TEAMS.map(team => [team.id, team]));
export function getTeamById(id) { return TEAM_MAP.get(id) || null; }
