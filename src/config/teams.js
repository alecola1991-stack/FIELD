// Current first-division club selector. Only names and color palettes are used;
// there are no crests, kit images, or copied league graphics.
export const TEAM_LEAGUES = [
  { id: 'laliga', label: 'LaLiga · España 26/27' },
  { id: 'laliga2', label: 'LaLiga Hypermotion · España 26/27' },
  { id: 'premier', label: 'Premier League · Inglaterra 26/27' },
  { id: 'championship', label: 'Championship · Inglaterra 26/27' },
  { id: 'serie-a', label: 'Serie A · Italia 26/27' },
  { id: 'serie-b', label: 'Serie B · Italia 26/27' },
  { id: 'ligue-1', label: 'Ligue 1 · Francia 26/27' },
  { id: 'ligue-2', label: 'Ligue 2 · Francia 26/27' },
  { id: 'bundesliga', label: 'Bundesliga · Alemania 26/27' },
  { id: 'bundesliga-2', label: '2. Bundesliga · Alemania 26/27' },
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
  ...define('laliga2', [
    ['almeria', 'Almería', '#D71920', '#FFFFFF'], ['andorra', 'FC Andorra', '#E32636', '#171717'],
    ['burgos', 'Burgos CF', '#171717', '#FFFFFF'], ['cadiz', 'Cádiz', '#F3D21A', '#1766AA'],
    ['castellon', 'Castellón', '#171717', '#FFFFFF'], ['cordoba', 'Córdoba', '#16834A', '#FFFFFF'],
    ['ceuta', 'AD Ceuta', '#171717', '#D71920'], ['eldense', 'CD Eldense', '#D71920', '#171717'],
    ['eibar', 'Eibar', '#D71920', '#1766AA'], ['granada', 'Granada', '#D71920', '#FFFFFF'],
    ['girona', 'Girona', '#D71920', '#FFFFFF'], ['las-palmas', 'Las Palmas', '#F5D61D', '#1766AA'],
    ['leganes', 'Leganés', '#16834A', '#FFFFFF'], ['mallorca', 'Mallorca', '#D71920', '#171717'],
    ['oviedo', 'Real Oviedo', '#1766AA', '#F5D61D'], ['sabadell', 'CE Sabadell', '#1766AA', '#FFFFFF'],
    ['real-sociedad-b', 'Real Sociedad B', '#1766AA', '#FFFFFF'], ['sporting', 'Sporting de Gijón', '#D71920', '#1766AA'],
    ['tenerife', 'Tenerife', '#FFFFFF', '#1766AA'], ['valladolid', 'Real Valladolid', '#6B3FA0', '#FFFFFF'],
    ['celta-fortuna', 'Celta Fortuna', '#8CC7E8', '#FFFFFF'], ['albacete', 'Albacete', '#FFFFFF', '#D71920'],
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
  ...define('championship', [
    ['birmingham', 'Birmingham City', '#1766AA', '#FFFFFF'], ['blackburn', 'Blackburn Rovers', '#1766AA', '#FFFFFF'],
    ['bristol-city', 'Bristol City', '#D71920', '#FFFFFF'], ['charlton', 'Charlton Athletic', '#D71920', '#FFFFFF'],
    ['derby', 'Derby County', '#171717', '#FFFFFF'], ['hull', 'Hull City', '#F5A623', '#171717'],
    ['ipswich', 'Ipswich Town', '#0054A6', '#FFFFFF'], ['leicester', 'Leicester City', '#1766AA', '#F5D61D'],
    ['middlesbrough', 'Middlesbrough', '#D71920', '#FFFFFF'], ['millwall', 'Millwall', '#1766AA', '#FFFFFF'],
    ['norwich', 'Norwich City', '#F5D61D', '#16834A'], ['oxford', 'Oxford United', '#F5D61D', '#1766AA'],
    ['portsmouth', 'Portsmouth', '#1766AA', '#FFFFFF'], ['preston', 'Preston North End', '#FFFFFF', '#1766AA'],
    ['qpr', 'Queens Park Rangers', '#1766AA', '#FFFFFF'], ['sheffield-united', 'Sheffield United', '#D71920', '#171717'],
    ['sheffield-wednesday', 'Sheffield Wednesday', '#1766AA', '#FFFFFF'], ['southampton', 'Southampton', '#D71920', '#FFFFFF'],
    ['stoke', 'Stoke City', '#D71920', '#FFFFFF'], ['swansea', 'Swansea City', '#FFFFFF', '#171717'],
    ['watford', 'Watford', '#F5D61D', '#D71920'], ['west-brom', 'West Bromwich Albion', '#FFFFFF', '#6B3FA0'],
    ['wrexham', 'Wrexham', '#D71920', '#FFFFFF'], ['brentford', 'Brentford', '#D71920', '#FFFFFF'],
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
  ...define('serie-b', [
    ['arezzo', 'Arezzo', '#D71920', '#171717'], ['ascoli', 'Ascoli', '#171717', '#FFFFFF'],
    ['avellino', 'Avellino', '#16834A', '#FFFFFF'], ['benevento', 'Benevento', '#F5D61D', '#D71920'],
    ['carrarese', 'Carrarese', '#1766AA', '#FFFFFF'], ['catanzaro', 'Catanzaro', '#F5D61D', '#D71920'],
    ['cesena', 'Cesena', '#171717', '#FFFFFF'], ['cremonese', 'Cremonese', '#D71920', '#FFFFFF'],
    ['empoli', 'Empoli', '#1766AA', '#FFFFFF'], ['hellas-verona', 'Hellas Verona', '#F5D61D', '#1766AA'],
    ['juve-stabia', 'Juve Stabia', '#F5D61D', '#171717'], ['vicenza', 'L.R. Vicenza', '#D71920', '#FFFFFF'],
    ['mantova', 'Mantova', '#D71920', '#FFFFFF'], ['modena', 'Modena', '#F5D61D', '#1766AA'],
    ['padova', 'Padova', '#D71920', '#FFFFFF'], ['palermo', 'Palermo', '#6B3FA0', '#F5D61D'],
    ['pisa', 'Pisa', '#171717', '#FFFFFF'], ['sampdoria', 'Sampdoria', '#1766AA', '#D71920'],
    ['sudtirol', 'Südtirol', '#D71920', '#FFFFFF'], ['virtus-entella', 'Virtus Entella', '#1766AA', '#FFFFFF'],
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
  ...define('ligue-2', [
    ['amiens', 'Amiens SC', '#171717', '#FFFFFF'], ['annecy', 'FC Annecy', '#D71920', '#1766AA'],
    ['bastia', 'Bastia', '#1766AA', '#FFFFFF'], ['boulogne', 'Boulogne', '#D71920', '#171717'],
    ['clermont', 'Clermont Foot', '#D71920', '#1766AA'], ['dunkerque', 'Dunkerque', '#F5D61D', '#D71920'],
    ['grenoble', 'Grenoble Foot 38', '#1766AA', '#D71920'], ['guingamp', 'Guingamp', '#D71920', '#171717'],
    ['laval', 'Laval', '#D71920', '#F5D61D'], ['le-mans', 'Le Mans', '#D71920', '#F2C230'],
    ['montpellier', 'Montpellier', '#F07825', '#1766AA'], ['nancy', 'Nancy', '#D71920', '#FFFFFF'],
    ['pau', 'Pau FC', '#F5D61D', '#1766AA'], ['red-star', 'Red Star FC', '#16834A', '#FFFFFF'],
    ['rodez', 'Rodez AF', '#D71920', '#F5D61D'], ['saint-etienne', 'Saint-Étienne', '#16834A', '#FFFFFF'],
    ['troyes', 'Troyes', '#1766AA', '#FFFFFF'], ['valenciennes', 'Valenciennes', '#D71920', '#FFFFFF'],
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
  ...define('bundesliga-2', [
    ['bochum', 'VfL Bochum', '#1766AA', '#FFFFFF'], ['braunschweig', 'Eintracht Braunschweig', '#F5D61D', '#1766AA'],
    ['darmstadt', 'SV Darmstadt 98', '#1766AA', '#FFFFFF'], ['dusseldorf', 'Fortuna Düsseldorf', '#D71920', '#FFFFFF'],
    ['dresden', 'Dynamo Dresden', '#F5D61D', '#171717'], ['elversberg', 'SV Elversberg', '#171717', '#FFFFFF'],
    ['furth', 'Greuther Fürth', '#16834A', '#FFFFFF'], ['hannover', 'Hannover 96', '#16834A', '#171717'],
    ['hertha', 'Hertha BSC', '#1766AA', '#FFFFFF'], ['kaiserslautern', 'Kaiserslautern', '#D71920', '#FFFFFF'],
    ['karlsruhe', 'Karlsruher SC', '#1766AA', '#FFFFFF'], ['magdeburg', '1. FC Magdeburg', '#1766AA', '#FFFFFF'],
    ['munster', 'Preußen Münster', '#16834A', '#FFFFFF'], ['nurnberg', '1. FC Nürnberg', '#D71920', '#FFFFFF'],
    ['paderborn', 'SC Paderborn 07', '#1766AA', '#171717'], ['schalke', 'Schalke 04', '#1766AA', '#FFFFFF'],
    ['bielefeld', 'Arminia Bielefeld', '#171717', '#FFFFFF'], ['kiel', 'Holstein Kiel', '#16834A', '#FFFFFF'],
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

// Strength influences both the selector and the opponent AI. Ratings are a
// gameplay estimate rather than an official ranking.
const FIVE_STAR = new Set([
  'laliga-barcelona', 'laliga-real-madrid', 'laliga-atletico', 'premier-man-city',
  'premier-liverpool', 'premier-arsenal', 'serie-a-inter', 'serie-a-juventus', 'serie-a-milan',
  'ligue-1-psg', 'bundesliga-bayern', 'bundesliga-dortmund', 'europe-spain', 'europe-france',
  'europe-england', 'europe-germany', 'america-argentina', 'america-brazil',
]);
const FOUR_STAR = new Set([
  'laliga-athletic', 'laliga-betis', 'laliga-sociedad', 'laliga-sevilla', 'laliga-villarreal',
  'premier-aston-villa', 'premier-chelsea', 'premier-newcastle', 'premier-tottenham',
  'serie-a-atalanta', 'serie-a-napoli', 'serie-a-roma', 'ligue-1-monaco', 'ligue-1-marseille',
  'ligue-1-lyon', 'bundesliga-leipzig', 'bundesliga-leverkusen', 'bundesliga-stuttgart',
  'europe-portugal', 'europe-netherlands', 'europe-belgium', 'america-uruguay', 'america-colombia',
]);
const ONE_STAR = new Set([
  'laliga2-ceuta', 'laliga2-real-sociedad-b', 'championship-oxford', 'serie-b-virtus-entella',
  'ligue-2-boulogne', 'bundesliga-2-munster', 'europe-hungary', 'america-bolivia',
]);
for (const team of [...TEAMS, ...NATIONAL_TEAMS]) {
  team.stars = FIVE_STAR.has(team.id) ? 5 : FOUR_STAR.has(team.id) ? 4 : ONE_STAR.has(team.id) ? 1 : team.league.endsWith('2') || team.league === 'championship' || team.league === 'serie-b' || team.league === 'ligue-2' ? 2 : 3;
}

export const TEAM_GROUPS = [...TEAM_LEAGUES, ...NATIONAL_GROUPS];
export const PROFILE_TEAMS = [...TEAMS, ...NATIONAL_TEAMS];
const TEAM_MAP = new Map(PROFILE_TEAMS.map(team => [team.id, team]));
export function getTeamById(id) { return TEAM_MAP.get(id) || null; }
