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

export const HONORARY_GROUPS = [
  { id: 'honorificos', label: 'Equipos honoríficos', type: 'honorary' },
];

export const TEAM_COUNTRIES = [
  { id: 'spain', label: 'España', groups: ['laliga', 'laliga2'] },
  { id: 'england', label: 'Inglaterra', groups: ['premier', 'championship'] },
  { id: 'italy', label: 'Italia', groups: ['serie-a', 'serie-b'] },
  { id: 'france', label: 'Francia', groups: ['ligue-1', 'ligue-2'] },
  { id: 'germany', label: 'Alemania', groups: ['bundesliga', 'bundesliga-2'] },
  { id: 'national', label: 'Selecciones', groups: ['europe', 'america'] },
  { id: 'honorary', label: 'Honoríficos', groups: ['honorificos'] },
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
    ['bolton', 'Bolton Wanderers', '#FFFFFF', '#171717'], ['bristol-city', 'Bristol City', '#D71920', '#FFFFFF'],
    ['burnley', 'Burnley', '#6B3FA0', '#FFFFFF'], ['cardiff', 'Cardiff City', '#1766AA', '#D71920'],
    ['charlton', 'Charlton Athletic', '#D71920', '#FFFFFF'], ['derby', 'Derby County', '#171717', '#FFFFFF'],
    ['lincoln', 'Lincoln City', '#D71920', '#171717'], ['middlesbrough', 'Middlesbrough', '#D71920', '#FFFFFF'],
    ['millwall', 'Millwall', '#1766AA', '#FFFFFF'], ['norwich', 'Norwich City', '#F5D61D', '#16834A'],
    ['portsmouth', 'Portsmouth', '#1766AA', '#FFFFFF'], ['preston', 'Preston North End', '#FFFFFF', '#1766AA'],
    ['qpr', 'Queens Park Rangers', '#1766AA', '#FFFFFF'], ['sheffield-united', 'Sheffield United', '#D71920', '#171717'],
    ['southampton', 'Southampton', '#D71920', '#FFFFFF'], ['stoke', 'Stoke City', '#D71920', '#FFFFFF'],
    ['swansea', 'Swansea City', '#FFFFFF', '#171717'], ['watford', 'Watford', '#F5D61D', '#D71920'],
    ['west-brom', 'West Bromwich Albion', '#FFFFFF', '#6B3FA0'], ['west-ham', 'West Ham United', '#7B2638', '#80B8E8'],
    ['wolves', 'Wolverhampton Wanderers', '#F5A623', '#171717'], ['wrexham', 'Wrexham', '#D71920', '#FFFFFF'],
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
    ['annecy', 'FC Annecy', '#D71920', '#1766AA'], ['boulogne', 'Boulogne', '#D71920', '#171717'],
    ['clermont', 'Clermont Foot', '#D71920', '#1766AA'], ['dijon', 'Dijon FCO', '#D71920', '#F5D61D'],
    ['dunkerque', 'Dunkerque', '#F5D61D', '#D71920'], ['grenoble', 'Grenoble Foot 38', '#1766AA', '#D71920'],
    ['guingamp', 'Guingamp', '#D71920', '#171717'], ['laval', 'Laval', '#D71920', '#F5D61D'],
    ['metz', 'FC Metz', '#8B1837', '#FFFFFF'], ['montpellier', 'Montpellier', '#F07825', '#1766AA'],
    ['nancy', 'Nancy', '#D71920', '#FFFFFF'], ['nantes', 'FC Nantes', '#16834A', '#F5D61D'],
    ['pau', 'Pau FC', '#F5D61D', '#1766AA'], ['red-star', 'Red Star FC', '#16834A', '#FFFFFF'],
    ['reims', 'Stade de Reims', '#D71920', '#FFFFFF'], ['rodez', 'Rodez AF', '#D71920', '#F5D61D'],
    ['saint-etienne', 'Saint-Étienne', '#16834A', '#FFFFFF'], ['sochaux', 'Sochaux', '#F5D61D', '#1766AA'],
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
    ['hertha', 'Hertha BSC', '#1766AA', '#FFFFFF'], ['nurnberg', '1. FC Nürnberg', '#D71920', '#FFFFFF'],
    ['heidenheim', '1. FC Heidenheim', '#D71920', '#1766AA'], ['kaiserslautern', 'Kaiserslautern', '#D71920', '#FFFFFF'],
    ['wolfsburg', 'VfL Wolfsburg', '#16834A', '#FFFFFF'], ['magdeburg', '1. FC Magdeburg', '#1766AA', '#FFFFFF'],
    ['cottbus', 'Energie Cottbus', '#D71920', '#FFFFFF'], ['braunschweig', 'Eintracht Braunschweig', '#F5D61D', '#1766AA'],
    ['st-pauli', 'FC St. Pauli', '#5A3729', '#FFFFFF'], ['bochum', 'VfL Bochum', '#1766AA', '#FFFFFF'],
    ['hannover', 'Hannover 96', '#16834A', '#171717'], ['osnabruck', 'VfL Osnabrück', '#FFFFFF', '#171717'],
    ['furth', 'Greuther Fürth', '#16834A', '#FFFFFF'], ['bielefeld', 'Arminia Bielefeld', '#171717', '#FFFFFF'],
    ['karlsruhe', 'Karlsruher SC', '#1766AA', '#FFFFFF'], ['kiel', 'Holstein Kiel', '#16834A', '#FFFFFF'],
    ['dresden', 'Dynamo Dresden', '#F5D61D', '#171717'], ['darmstadt', 'SV Darmstadt 98', '#1766AA', '#FFFFFF'],
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

export const HONORARY_TEAMS = [
  { id: 'honor-cd-san-fernando-1940', name: 'CD San Fernando 1940', league: 'honorificos', type: 'honorary', primary: '#1769AA', secondary: '#FFFFFF', stars: 3 },
  { id: 'honor-ge-bazan', name: 'GE Bazan', league: 'honorificos', type: 'honorary', primary: '#F3D21B', secondary: '#111111', stars: 3 },
];

const KIT_PATTERN_GROUPS = {
  'horizontal-stripes': [
    'laliga-betis', 'premier-man-united', 'europe-argentina', 'europe-usa',
  ],
  'vertical-stripes': [
    'laliga-athletic', 'laliga-atletico', 'laliga-barcelona', 'laliga-celta', 'laliga-alaves', 'laliga-espanyol', 'laliga-sociedad', 'laliga-racing',
    'premier-newcastle', 'premier-sunderland', 'premier-crystal-palace', 'premier-brentford',
    'serie-a-inter', 'serie-a-milan', 'serie-a-juventus', 'serie-a-bologna', 'serie-a-genoa', 'serie-a-atalanta', 'serie-a-sassuolo',
    'ligue-1-psg', 'ligue-1-nice', 'ligue-1-lille', 'bundesliga-dortmund', 'bundesliga-frankfurt', 'bundesliga-werder',
    'europe-italy', 'europe-belgium', 'europe-sweden', 'europe-denmark', 'europe-turkiye',
    'america-uruguay', 'america-colombia', 'america-chile', 'america-peru', 'america-mexico', 'america-argentina',
  ],
  checkerboard: ['europe-croatia'],
  'half-horizontal': [
    'laliga-osasuna', 'laliga-real-madrid', 'laliga-sevilla', 'premier-arsenal', 'premier-liverpool', 'premier-man-city',
    'serie-a-roma', 'serie-a-lazio', 'ligue-1-marseille', 'bundesliga-bayern', 'bundesliga-stuttgart',
    'europe-spain', 'europe-germany', 'europe-england', 'europe-netherlands', 'europe-poland', 'europe-portugal', 'europe-wales',
    'america-brazil', 'america-canada', 'america-usa', 'honor-ge-bazan',
  ],
  'half-vertical': [
    'laliga-rayo', 'laliga-deportivo', 'laliga-valencia', 'laliga-villarreal', 'premier-aston-villa', 'premier-everton',
    'serie-a-napoli', 'serie-a-torino', 'ligue-1-monaco', 'ligue-1-lyon', 'bundesliga-leverkusen', 'bundesliga-hamburg',
    'europe-france', 'europe-austria', 'europe-greece', 'america-ecuador', 'america-paraguay', 'america-jamaica',
    'honor-cd-san-fernando-1940',
  ],
  quarters: [
    'laliga-levante', 'premier-west-ham', 'serie-a-cagliari', 'serie-a-venezia', 'ligue-1-strasbourg', 'bundesliga-union-berlin',
    'europe-czechia', 'europe-romania', 'europe-hungary', 'america-costa-rica', 'america-panama',
  ],
};
const KIT_PATTERN_BY_TEAM = new Map(Object.entries(KIT_PATTERN_GROUPS).flatMap(([pattern, ids]) => ids.map(id => [id, pattern])));
const RANDOM_KIT_PATTERNS = ['horizontal-stripes', 'vertical-stripes', 'checkerboard', 'half-horizontal', 'half-vertical', 'quarters'];
function chooseKitPattern(id) {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return RANDOM_KIT_PATTERNS[(hash >>> 0) % RANDOM_KIT_PATTERNS.length];
}
for (const team of [...TEAMS, ...NATIONAL_TEAMS, ...HONORARY_TEAMS]) {
  team.kitPattern = KIT_PATTERN_BY_TEAM.get(team.id) || chooseKitPattern(team.id);
}

export function getKitBackground(team) {
  if (!team) return 'linear-gradient(90deg, #33413b 0 50%, #52645b 50% 100%)';
  const first = team.primary || '#68746e', second = team.secondary || first;
  switch (team.kitPattern) {
    case 'horizontal-stripes': return `repeating-linear-gradient(0deg, ${first} 0 9px, ${second} 9px 17px)`;
    case 'vertical-stripes': return `repeating-linear-gradient(90deg, ${first} 0 9px, ${second} 9px 17px)`;
    case 'checkerboard': return `conic-gradient(${first} 25%, ${second} 0 50%, ${first} 0 75%, ${second} 0) 0 0 / 14px 14px`;
    case 'quarters': return `conic-gradient(${first} 0 25%, ${second} 0 50%, ${first} 0 75%, ${second} 0)`;
    case 'half-horizontal': return `linear-gradient(180deg, ${first} 0 50%, ${second} 50% 100%)`;
    case 'half-vertical': default: return `linear-gradient(90deg, ${first} 0 50%, ${second} 50% 100%)`;
  }
}

const KIT_NUMBER_COLORS = {
  'laliga-athletic': '#ffffff', 'laliga-atletico': '#ffffff', 'laliga-barcelona': '#f6d65c', 'laliga-osasuna': '#ffffff',
  'laliga-celta': '#ffffff', 'laliga-alaves': '#ffffff', 'laliga-elche': '#ffffff', 'laliga-getafe': '#ffffff',
  'laliga-levante': '#ffffff', 'laliga-malaga': '#ffffff', 'laliga-racing': '#ffffff', 'laliga-rayo': '#182027',
  'laliga-deportivo': '#ffffff', 'laliga-espanyol': '#ffffff', 'laliga-betis': '#ffffff', 'laliga-real-madrid': '#17274b',
  'laliga-sociedad': '#ffffff', 'laliga-sevilla': '#c9162e', 'laliga-valencia': '#171717', 'laliga-villarreal': '#123b75',
  'premier-arsenal': '#ffffff', 'premier-aston-villa': '#ffffff', 'premier-bournemouth': '#ffffff', 'premier-brentford': '#ffffff',
  'premier-brighton': '#ffffff', 'premier-chelsea': '#ffffff', 'premier-crystal-palace': '#ffffff', 'premier-everton': '#ffffff',
  'premier-fulham': '#171717', 'premier-liverpool': '#ffffff', 'premier-man-city': '#ffffff', 'premier-man-united': '#f6d74e',
  'premier-newcastle': '#ffffff', 'premier-nottingham': '#ffffff', 'premier-sunderland': '#ffffff', 'premier-tottenham': '#17274b',
  'premier-coventry': '#17274b', 'premier-hull': '#171717', 'premier-ipswich': '#ffffff', 'premier-leeds': '#17274b',
  'serie-a-atalanta': '#ffffff', 'serie-a-bologna': '#ffffff', 'serie-a-inter': '#f6d65c', 'serie-a-juventus': '#ffffff',
  'serie-a-lazio': '#17274b', 'serie-a-milan': '#ffffff', 'serie-a-napoli': '#ffffff', 'serie-a-roma': '#f6d65c',
  'serie-a-sassuolo': '#ffffff', 'serie-a-torino': '#ffffff', 'serie-a-cagliari': '#ffffff', 'serie-a-como': '#ffffff',
  'serie-a-fiorentina': '#ffffff', 'serie-a-frosinone': '#17274b', 'serie-a-genoa': '#ffffff', 'serie-a-lecce': '#ffffff',
  'serie-a-monza': '#ffffff', 'serie-a-parma': '#173b73', 'serie-a-udinese': '#ffffff', 'serie-a-venezia': '#f6d65c',
  'ligue-1-psg': '#ffffff', 'ligue-1-marseille': '#133c70',
  'ligue-1-monaco': '#ffffff', 'ligue-1-lyon': '#ffffff', 'ligue-1-lille': '#ffffff', 'ligue-1-nice': '#ffffff',
  'ligue-1-angers': '#ffffff', 'ligue-1-auxerre': '#ffffff', 'ligue-1-brest': '#ffffff', 'ligue-1-le-havre': '#173b73',
  'ligue-1-le-mans': '#171717', 'ligue-1-lens': '#171717', 'ligue-1-lorient': '#171717', 'ligue-1-paris-fc': '#ffffff',
  'ligue-1-rennes': '#ffffff', 'ligue-1-strasbourg': '#ffffff', 'ligue-1-toulouse': '#ffffff', 'ligue-1-troyes': '#ffffff',
  'bundesliga-bayern': '#ffffff', 'bundesliga-dortmund': '#171717', 'bundesliga-leipzig': '#ffffff',
  'bundesliga-leverkusen': '#ffffff', 'bundesliga-frankfurt': '#ffffff', 'bundesliga-stuttgart': '#d71920',
  'bundesliga-augsburg': '#ffffff', 'bundesliga-union-berlin': '#ffffff', 'bundesliga-werder': '#ffffff',
  'bundesliga-elversberg': '#ffffff', 'bundesliga-freiburg': '#ffffff', 'bundesliga-hamburg': '#ffffff',
  'bundesliga-hoffenheim': '#ffffff', 'bundesliga-koln': '#c9162e', 'bundesliga-mainz': '#ffffff',
  'bundesliga-gladbach': '#ffffff', 'bundesliga-paderborn': '#ffffff', 'bundesliga-schalke': '#ffffff',
  'europe-spain': '#f6d65c', 'europe-france': '#ffffff', 'europe-germany': '#171717', 'europe-italy': '#ffffff',
  'europe-england': '#152d54', 'europe-portugal': '#ffffff', 'europe-netherlands': '#ffffff', 'europe-belgium': '#f4d24a',
  'europe-croatia': '#ffffff', 'europe-denmark': '#ffffff', 'europe-sweden': '#173b73', 'europe-norway': '#ffffff',
  'europe-poland': '#d7193f', 'europe-switzerland': '#ffffff', 'europe-austria': '#ffffff', 'europe-turkiye': '#ffffff',
  'europe-serbia': '#ffffff', 'europe-ukraine': '#f6d65c', 'europe-scotland': '#ffffff', 'europe-wales': '#ffffff',
  'europe-greece': '#ffffff', 'europe-czechia': '#ffffff', 'europe-romania': '#f6d65c', 'europe-hungary': '#ffffff',
  'america-argentina': '#17274b', 'america-brazil': '#17683c', 'america-uruguay': '#ffffff', 'america-colombia': '#173b73',
  'america-chile': '#ffffff', 'america-ecuador': '#173b73', 'america-paraguay': '#173b73', 'america-peru': '#ffffff',
  'america-venezuela': '#173b73', 'america-bolivia': '#173b73', 'america-mexico': '#ffffff', 'america-usa': '#ffffff',
  'america-canada': '#ffffff', 'america-costa-rica': '#ffffff', 'america-jamaica': '#f3d344', 'america-panama': '#ffffff',
  'america-honduras': '#ffffff', 'america-guatemala': '#173b73',
};
function contrastingNumberColor(hex) {
  const value = hex.replace('#', '');
  const rgb = [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return luminance > .45 ? '#172027' : '#ffffff';
}
for (const team of [...TEAMS, ...NATIONAL_TEAMS, ...HONORARY_TEAMS]) {
  team.numberColor = KIT_NUMBER_COLORS[team.id] || contrastingNumberColor(team.primary || '#68746e');
}

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
  'laliga2-almeria', 'laliga2-girona', 'laliga2-las-palmas', 'laliga2-mallorca', 'laliga2-valladolid',
  'premier-aston-villa', 'premier-chelsea', 'premier-newcastle', 'premier-tottenham',
  'championship-burnley', 'championship-southampton', 'championship-west-ham', 'championship-wolves',
  'serie-a-atalanta', 'serie-a-napoli', 'serie-a-roma', 'ligue-1-monaco', 'ligue-1-marseille',
  'serie-b-palermo', 'serie-b-sampdoria', 'ligue-1-lyon', 'ligue-2-saint-etienne', 'ligue-2-reims',
  'bundesliga-leipzig', 'bundesliga-leverkusen', 'bundesliga-stuttgart', 'bundesliga-2-hertha',
  'bundesliga-2-wolfsburg', 'bundesliga-2-st-pauli',
  'europe-portugal', 'europe-netherlands', 'europe-belgium', 'america-uruguay', 'america-colombia',
]);
const ONE_STAR = new Set([
  'laliga2-ceuta', 'laliga2-real-sociedad-b', 'championship-oxford', 'serie-b-virtus-entella',
  'ligue-2-boulogne', 'bundesliga-2-osnabruck', 'europe-hungary', 'america-bolivia',
]);
for (const team of [...TEAMS, ...NATIONAL_TEAMS]) {
  team.stars = FIVE_STAR.has(team.id) ? 5 : FOUR_STAR.has(team.id) ? 4 : ONE_STAR.has(team.id) ? 1 : team.league.endsWith('2') || team.league === 'championship' || team.league === 'serie-b' || team.league === 'ligue-2' ? 2 : 3;
}

export const TEAM_GROUPS = [...TEAM_LEAGUES, ...NATIONAL_GROUPS, ...HONORARY_GROUPS];
export const TEAM_CLUB_GROUPS = [...TEAM_LEAGUES, ...HONORARY_GROUPS];
export const PROFILE_TEAMS = [...TEAMS, ...NATIONAL_TEAMS, ...HONORARY_TEAMS];
const TEAM_MAP = new Map(PROFILE_TEAMS.map(team => [team.id, team]));
export function getTeamById(id) { return TEAM_MAP.get(id) || null; }
