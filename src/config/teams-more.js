// Extra leagues: lower divisions for countries that only had one or two, and new countries with their
// first division. Club lists follow each competition's 2026/27 (or 2026) composition; only names and
// colour palettes are used. `tier` is the division level (1 = top flight).
export const MORE_LEAGUES = [
  { id: 'league-one', label: 'League One · Inglaterra 26/27', country: 'england', tier: 3 },
  { id: 'serie-c-a', label: 'Serie C Girone A · Italia 26/27', country: 'italy', tier: 3 },
  { id: 'serie-c-b', label: 'Serie C Girone B · Italia 26/27', country: 'italy', tier: 3 },
  { id: 'serie-c-c', label: 'Serie C Girone C · Italia 26/27', country: 'italy', tier: 3 },
  { id: 'ligue-3', label: 'Ligue 3 · Francia 26/27', country: 'france', tier: 3 },
  { id: 'liga-3-de', label: '3. Liga · Alemania 26/27', country: 'germany', tier: 3 },
  { id: 'primera-nacional-a', label: 'Primera Nacional Zona A · Argentina 2026', country: 'argentina', tier: 2 },
  { id: 'primera-nacional-b', label: 'Primera Nacional Zona B · Argentina 2026', country: 'argentina', tier: 2 },
  { id: 'brasileirao-b', label: 'Brasileirão Série B · Brasil 2026', country: 'brazil', tier: 2 },
  { id: 'brasileirao-c', label: 'Brasileirão Série C · Brasil 2026', country: 'brazil', tier: 3 },
  { id: 'usl', label: 'USL Championship · Estados Unidos 2026', country: 'north-america', tier: 2 },
  { id: 'liga-portugal-2', label: 'Liga Portugal 2 · Portugal 26/27', country: 'portugal', tier: 2 },
  { id: 'tff-1-lig', label: '1. Lig · Turquía 26/27', country: 'turkey', tier: 2 },
  { id: 'eredivisie', label: 'Eredivisie · Países Bajos 26/27', country: 'netherlands', tier: 1 },
  { id: 'scottish-prem', label: 'Premiership · Escocia 26/27', country: 'scotland', tier: 1 },
  { id: 'saudi-pro', label: 'Saudi Pro League · Arabia Saudí 26/27', country: 'saudi-arabia', tier: 1 },
  { id: 'colombia', label: 'Liga BetPlay · Colombia 2026', country: 'colombia', tier: 1 },
  { id: 'chile', label: 'Liga de Primera · Chile 2026', country: 'chile', tier: 1 },
  { id: 'uruguay', label: 'Liga AUF Uruguaya · Uruguay 2026', country: 'uruguay', tier: 1 },
  { id: 'austria', label: 'Bundesliga · Austria 26/27', country: 'austria', tier: 1 },
  { id: 'swiss', label: 'Super League · Suiza 26/27', country: 'switzerland', tier: 1 },
];

// New countries, in the order they appear after the existing ones.
export const MORE_COUNTRIES = [
  { id: 'netherlands', label: 'Países Bajos' },
  { id: 'scotland', label: 'Escocia' },
  { id: 'saudi-arabia', label: 'Arabia Saudí' },
  { id: 'colombia', label: 'Colombia' },
  { id: 'chile', label: 'Chile' },
  { id: 'uruguay', label: 'Uruguay' },
  { id: 'austria', label: 'Austria' },
  { id: 'switzerland', label: 'Suiza' },
];

const R = '#D71920', W = '#FFFFFF', K = '#171717', B = '#1766AA', Y = '#F5D21B', G = '#167A48', SKY = '#79BCE8', NAVY = '#13294B', ORANGE = '#F07825', CLARET = '#7A2139', PURPLE = '#6B3FA0', GOLD = '#C9A227', GREY = '#8A9299';

export const MORE_TEAM_ROWS = {
  'league-one': [
    ['wimbledon', 'AFC Wimbledon', B, Y], ['barnsley', 'Barnsley', R, W], ['blackpool', 'Blackpool', ORANGE, W], ['bradford', 'Bradford City', CLARET, Y],
    ['bromley', 'Bromley', W, K], ['burton', 'Burton Albion', Y, K], ['cambridge', 'Cambridge United', Y, K], ['doncaster', 'Doncaster Rovers', R, W],
    ['huddersfield', 'Huddersfield Town', B, W], ['leicester', 'Leicester City', B, W], ['orient', 'Leyton Orient', R, W], ['luton', 'Luton Town', ORANGE, NAVY],
    ['mansfield', 'Mansfield Town', Y, B], ['mk-dons', 'MK Dons', W, K], ['notts-county', 'Notts County', K, W], ['oxford', 'Oxford United', Y, NAVY],
    ['peterborough', 'Peterborough United', B, W], ['plymouth', 'Plymouth Argyle', G, W], ['reading', 'Reading', B, W], ['sheffield-wed', 'Sheffield Wednesday', B, W],
    ['stevenage', 'Stevenage', R, W], ['stockport', 'Stockport County', B, W], ['wigan', 'Wigan Athletic', B, W], ['wycombe', 'Wycombe Wanderers', NAVY, SKY],
  ],
  'serie-c-a': [
    ['albinoleffe', 'AlbinoLeffe', B, W], ['alcione', 'Alcione Milano', ORANGE, B], ['arzignano', 'Arzignano Valchiampo', Y, K], ['carpi', 'Carpi', R, W],
    ['cittadella', 'Cittadella', CLARET, W], ['desenzano', 'Desenzano', B, W], ['dolomiti', 'Dolomiti Bellunesi', B, W], ['folgore-caratese', 'Folgore Caratese', B, W],
    ['giana', 'Giana Erminio', B, W], ['juventus-ng', 'Juventus Next Gen', W, K], ['lecco', 'Lecco', B, SKY], ['lumezzane', 'Lumezzane', B, W],
    ['novara', 'Novara', B, W], ['ospitaletto', 'Ospitaletto Franciacorta', Y, B], ['pergolettese', 'Pergolettese', Y, B], ['pro-vercelli', 'Pro Vercelli', W, K],
    ['renate', 'Renate', B, W], ['trento', 'Trento', Y, B], ['treviso', 'Treviso', W, SKY], ['union-brescia', 'Union Brescia', B, W],
  ],
  'serie-c-b': [
    ['atalanta-u23', 'Atalanta U23', K, B], ['campobasso', 'Campobasso', R, B], ['forli', 'Forlì', R, W], ['grosseto', 'Grosseto', R, W],
    ['gubbio', 'Gubbio', R, B], ['guidonia', 'Guidonia Montecelio', B, W], ['latina', 'Latina', K, B], ['livorno', 'Livorno', CLARET, W],
    ['ostiamare', 'Ostiamare', CLARET, SKY], ['perugia', 'Perugia', R, W], ['pescara', 'Pescara', SKY, W], ['pianese', 'Pianese', B, W],
    ['pineto', 'Pineto', B, W], ['ravenna', 'Ravenna', Y, R], ['reggiana', 'Reggiana', CLARET, W], ['sambenedettese', 'Sambenedettese', R, B],
    ['spezia', 'Spezia', W, K], ['torres', 'Torres', R, B], ['vado', 'Vado', R, B], ['vis-pesaro', 'Vis Pesaro', R, W],
  ],
  'serie-c-c': [
    ['altamura', 'Team Altamura', R, W], ['cerignola', 'Audace Cerignola', Y, B], ['bari', 'Bari', R, W], ['barletta', 'Barletta', R, W],
    ['casarano', 'Casarano', R, SKY], ['casertana', 'Casertana', R, B], ['catania', 'Catania', R, SKY], ['cavese', 'Cavese', B, W],
    ['cosenza', 'Cosenza', R, B], ['crotone', 'Crotone', R, B], ['foggia', 'Foggia', R, K], ['giugliano', 'Giugliano', B, W],
    ['inter-u23', 'Inter U23', B, K], ['monopoli', 'Monopoli', W, G], ['picerno', 'Picerno', R, B], ['potenza', 'Potenza', R, B],
    ['salernitana', 'Salernitana', CLARET, W], ['savoia', 'Savoia', W, K], ['scafatese', 'Scafatese', Y, B], ['sorrento', 'Sorrento', R, Y],
  ],
  'ligue-3': [
    ['amiens', 'Amiens SC', W, K], ['cannes', 'AS Cannes', R, W], ['bourg-peronnas', 'FBBP 01', R, W], ['fleury', 'FC Fleury 91', B, W],
    ['rouen', 'FC Rouen', R, W], ['villefranche', 'FC Villefranche', B, W], ['le-puy', 'Le Puy Foot 43', B, W], ['paris-13', 'Paris 13 Atletico', R, B],
    ['quevilly', 'US Quevilly-Rouen', Y, K], ['aubagne', 'SC Aubagne', B, W], ['bastia', 'SC Bastia', B, W], ['caen', 'SM Caen', B, R],
    ['thionville', 'US Thionville Lusitanos', B, W], ['concarneau', 'US Concarneau', B, R], ['orleans', 'US Orléans', R, W], ['valenciennes', 'Valenciennes FC', R, W],
    ['la-roche', 'La Roche VF', R, W], ['versailles', 'FC Versailles', B, W],
  ],
  'liga-3-de': [
    ['aachen', 'Alemannia Aachen', Y, K], ['duisburg', 'MSV Duisburg', B, W], ['dusseldorf', 'Fortuna Düsseldorf', R, W], ['essen', 'Rot-Weiss Essen', R, W],
    ['grossaspach', 'Sonnenhof Großaspach', B, W], ['havelse', 'TSV Havelse', B, W], ['hoffenheim-ii', 'TSG Hoffenheim II', B, W], ['ingolstadt', 'FC Ingolstadt', R, K],
    ['fortuna-koln', 'Fortuna Köln', R, W], ['viktoria-koln', 'Viktoria Köln', R, W], ['mannheim', 'Waldhof Mannheim', B, K], ['meppen', 'SV Meppen', B, W],
    ['munster', 'Preußen Münster', K, W], ['regensburg', 'Jahn Regensburg', R, W], ['rostock', 'Hansa Rostock', B, W], ['saarbrucken', '1. FC Saarbrücken', B, K],
    ['stuttgart-ii', 'VfB Stuttgart II', W, R], ['verl', 'SC Verl', K, W], ['wiesbaden', 'Wehen Wiesbaden', R, K], ['wurzburg', 'Würzburger Kickers', R, W],
  ],
  'primera-nacional-a': [
    ['ferro', 'Ferro Carril Oeste', G, W], ['moron', 'Deportivo Morón', W, R], ['colon', 'Colón', R, K], ['almirante-brown', 'Almirante Brown', Y, K],
    ['madryn', 'Deportivo Madryn', Y, K], ['godoy-cruz', 'Godoy Cruz', B, W], ['ciudad-bolivar', 'Ciudad de Bolívar', B, W], ['estudiantes-ba', 'Estudiantes (BA)', K, W],
    ['los-andes', 'Los Andes', R, W], ['racing-cordoba', 'Racing de Córdoba', SKY, W], ['mitre', 'Mitre (SdE)', Y, K], ['san-miguel', 'San Miguel', G, W],
    ['central-norte', 'Central Norte', K, W], ['chaco', 'Chaco For Ever', K, W], ['san-telmo', 'San Telmo', SKY, W], ['all-boys', 'All Boys', W, K],
    ['defensores', 'Defensores de Belgrano', R, K], ['acassuso', 'Acassuso', SKY, W],
  ],
  'primera-nacional-b': [
    ['tristan-suarez', 'Tristán Suárez', SKY, K], ['gimnasia-jujuy', 'Gimnasia y Esgrima (J)', B, W], ['temperley', 'Temperley', SKY, W], ['atlanta', 'Atlanta', Y, B],
    ['midland', 'Ferrocarril Midland', SKY, K], ['gimnasia-tiro', 'Gimnasia y Tiro', W, SKY], ['rafaela', 'Atlético de Rafaela', SKY, W], ['maipu', 'Deportivo Maipú', R, W],
    ['san-martin-sj', 'San Martín (SJ)', G, K], ['san-martin-t', 'San Martín (T)', R, W], ['colegiales', 'Colegiales', B, R], ['quilmes', 'Quilmes', W, B],
    ['almagro', 'Almagro', B, K], ['nueva-chicago', 'Nueva Chicago', G, K], ['agropecuario', 'Agropecuario', G, W], ['patronato', 'Patronato', R, K],
    ['chacarita', 'Chacarita Juniors', R, K], ['guemes', 'Güemes', R, B],
  ],
  'brasileirao-b': [
    ['america-mg', 'América Mineiro', G, K], ['athletic-mg', 'Athletic Club', K, W], ['atletico-go', 'Atlético Goianiense', R, K], ['avai', 'Avaí', B, W],
    ['botafogo-sp', 'Botafogo-SP', R, W], ['ceara', 'Ceará', K, W], ['crb', 'CRB', R, W], ['criciuma', 'Criciúma', Y, K],
    ['cuiaba', 'Cuiabá', G, Y], ['fortaleza', 'Fortaleza', B, R], ['goias', 'Goiás', G, W], ['juventude', 'Juventude', G, W],
    ['londrina', 'Londrina', SKY, W], ['nautico', 'Náutico', R, W], ['novorizontino', 'Novorizontino', Y, K], ['operario', 'Operário Ferroviário', K, W],
    ['ponte-preta', 'Ponte Preta', K, W], ['sao-bernardo', 'São Bernardo', Y, K], ['sport', 'Sport Recife', R, K], ['vila-nova', 'Vila Nova', R, W],
  ],
  'brasileirao-c': [
    ['amazonas', 'Amazonas FC', Y, K], ['anapolis', 'Anápolis', R, W], ['barra', 'Barra FC', B, W], ['botafogo-pb', 'Botafogo-PB', K, W],
    ['brusque', 'Brusque', Y, R], ['caxias', 'Caxias', CLARET, W], ['confianca', 'Confiança', B, W], ['ferroviaria', 'Ferroviária', CLARET, W],
    ['figueirense', 'Figueirense', K, W], ['floresta', 'Floresta', G, W], ['guarani', 'Guarani', G, W], ['inter-limeira', 'Inter de Limeira', K, W],
    ['itabaiana', 'Itabaiana', B, R], ['ituano', 'Ituano', R, K], ['maranhao', 'Maranhão', R, B], ['maringa', 'Maringá', B, W],
    ['paysandu', 'Paysandu', SKY, W], ['santa-cruz', 'Santa Cruz', R, K], ['volta-redonda', 'Volta Redonda', Y, K], ['ypiranga', 'Ypiranga', Y, G],
  ],
  usl: [
    ['tampa-bay', 'Tampa Bay Rowdies', G, Y], ['charleston', 'Charleston Battery', Y, K], ['pittsburgh', 'Pittsburgh Riverhounds', K, Y], ['detroit', 'Detroit City FC', CLARET, Y],
    ['hartford', 'Hartford Athletic', G, B], ['louisville', 'Louisville City FC', PURPLE, GOLD], ['rhode-island', 'Rhode Island FC', NAVY, Y], ['indy', 'Indy Eleven', B, R],
    ['miami', 'Miami FC', SKY, ORANGE], ['loudoun', 'Loudoun United', R, K], ['birmingham', 'Birmingham Legion', K, GOLD], ['brooklyn', 'Brooklyn FC', K, W],
    ['jacksonville', 'Sporting Jacksonville', B, ORANGE], ['new-mexico', 'New Mexico United', Y, K], ['el-paso', 'El Paso Locomotive', NAVY, ORANGE], ['colorado-springs', 'Colorado Springs Switchbacks', NAVY, Y],
    ['orange-county', 'Orange County SC', ORANGE, K], ['tulsa', 'FC Tulsa', B, ORANGE], ['san-antonio', 'San Antonio FC', K, R], ['sacramento', 'Sacramento Republic', CLARET, Y],
    ['lexington', 'Lexington SC', SKY, G], ['phoenix', 'Phoenix Rising', K, R], ['las-vegas', 'Las Vegas Lights', PURPLE, Y], ['oakland', 'Oakland Roots', K, Y],
    ['monterey-bay', 'Monterey Bay FC', B, W],
  ],
  'liga-portugal-2': [
    ['academica', 'Académica', K, W], ['afs', 'AFS', B, W], ['amarante', 'Amarante', B, W], ['benfica-b', 'Benfica B', R, W],
    ['chaves', 'Chaves', R, B], ['farense', 'Farense', W, K], ['feirense', 'Feirense', B, W], ['felgueiras', 'Felgueiras', B, W],
    ['leixoes', 'Leixões', R, W], ['lourosa', 'Lusitânia Lourosa', B, W], ['penafiel', 'Penafiel', R, K], ['portimonense', 'Portimonense', K, W],
    ['porto-b', 'Porto B', B, W], ['sporting-b', 'Sporting CP B', G, W], ['tondela', 'Tondela', Y, G], ['torreense', 'Torreense', B, W],
    ['uniao-leiria', 'União de Leiria', K, W], ['vizela', 'Vizela', B, W],
  ],
  'tff-1-lig': [
    ['antalyaspor', 'Antalyaspor', R, W], ['bandirmaspor', 'Bandırmaspor', R, B], ['batman', 'Batman Petrolspor', R, K], ['bodrum', 'Bodrum FK', G, W],
    ['boluspor', 'Boluspor', R, W], ['bursaspor', 'Bursaspor', G, W], ['erokspor', 'Esenler Erokspor', B, W], ['karagumruk', 'Fatih Karagümrük', R, K],
    ['igdir', 'Iğdır FK', B, W], ['istanbulspor', 'İstanbulspor', Y, K], ['kayserispor', 'Kayserispor', Y, R], ['keciorengucu', 'Keçiörengücü', CLARET, W],
    ['manisa', 'Manisa FK', K, W], ['mardin', 'Mardin 1969', R, Y], ['muglaspor', 'Muğlaspor', B, W], ['pendikspor', 'Pendikspor', R, W],
    ['sariyer', 'Sarıyer', B, W], ['sivasspor', 'Sivasspor', R, W], ['umraniyespor', 'Ümraniyespor', R, W], ['vanspor', 'Vanspor', R, K],
  ],
  eredivisie: [
    ['ado', 'ADO Den Haag', Y, G], ['ajax', 'Ajax', W, R], ['az', 'AZ Alkmaar', R, W], ['cambuur', 'Cambuur', Y, B],
    ['excelsior', 'Excelsior', R, K], ['feyenoord', 'Feyenoord', R, W], ['fortuna-sittard', 'Fortuna Sittard', Y, G], ['go-ahead', 'Go Ahead Eagles', R, Y],
    ['groningen', 'FC Groningen', G, W], ['heerenveen', 'Heerenveen', B, W], ['nec', 'NEC Nijmegen', R, G], ['zwolle', 'PEC Zwolle', B, W],
    ['psv', 'PSV Eindhoven', R, W], ['sparta', 'Sparta Rotterdam', R, W], ['telstar', 'Telstar', W, K], ['twente', 'FC Twente', R, W],
    ['utrecht', 'FC Utrecht', R, W], ['willem-ii', 'Willem II', R, B],
  ],
  'scottish-prem': [
    ['aberdeen', 'Aberdeen', R, W], ['celtic', 'Celtic', G, W], ['dundee', 'Dundee', NAVY, W], ['dundee-united', 'Dundee United', ORANGE, K],
    ['falkirk', 'Falkirk', NAVY, W], ['hearts', 'Heart of Midlothian', CLARET, W], ['hibernian', 'Hibernian', G, W], ['kilmarnock', 'Kilmarnock', B, W],
    ['motherwell', 'Motherwell', Y, CLARET], ['rangers', 'Rangers', B, W], ['st-johnstone', 'St Johnstone', B, W], ['st-mirren', 'St Mirren', K, W],
  ],
  'saudi-pro': [
    ['abha', 'Abha', G, W], ['al-ahli', 'Al Ahli', G, W], ['al-diriyah', 'Al Diriyah', B, Y], ['al-ettifaq', 'Al Ettifaq', G, R],
    ['al-faisaly', 'Al Faisaly', B, W], ['al-fateh', 'Al Fateh', B, W], ['al-fayha', 'Al Fayha', ORANGE, K], ['al-hazem', 'Al Hazem', CLARET, Y],
    ['al-hilal', 'Al Hilal', B, W], ['al-ittihad', 'Al Ittihad', Y, K], ['al-khaleej', 'Al Khaleej', Y, G], ['al-kholood', 'Al Kholood', R, K],
    ['al-nassr', 'Al Nassr', Y, B], ['al-qadsiah', 'Al Qadsiah', R, Y], ['al-riyadh', 'Al Riyadh', R, K], ['al-shabab', 'Al Shabab', W, K],
    ['al-taawoun', 'Al Taawoun', Y, B], ['neom', 'NEOM SC', K, GOLD],
  ],
  colombia: [
    ['nacional', 'Atlético Nacional', G, W], ['junior', 'Junior', R, W], ['pasto', 'Deportivo Pasto', R, B], ['america-cali', 'América de Cali', R, W],
    ['once-caldas', 'Once Caldas', W, K], ['tolima', 'Deportes Tolima', CLARET, Y], ['santa-fe', 'Independiente Santa Fe', R, W], ['equidad', 'La Equidad', G, W],
    ['cali', 'Deportivo Cali', G, W], ['millonarios', 'Millonarios', B, W], ['medellin', 'Independiente Medellín', R, B], ['aguilas', 'Rionegro Águilas', Y, K],
    ['bucaramanga', 'Atlético Bucaramanga', Y, G], ['llaneros', 'Llaneros', R, W], ['fortaleza-ceif', 'Fortaleza CEIF', B, W], ['jaguares', 'Jaguares de Córdoba', B, Y],
    ['alianza', 'Alianza FC', Y, G], ['chico', 'Boyacá Chicó', B, W], ['cucuta', 'Cúcuta Deportivo', R, K], ['pereira', 'Deportivo Pereira', Y, R],
  ],
  chile: [
    ['audax', 'Audax Italiano', G, W], ['cobresal', 'Cobresal', ORANGE, W], ['colo-colo', 'Colo-Colo', W, K], ['coquimbo', 'Coquimbo Unido', Y, K],
    ['concepcion', 'Deportes Concepción', PURPLE, W], ['la-serena', 'Deportes La Serena', R, W], ['limache', 'Deportes Limache', R, W], ['everton', 'Everton de Viña', B, Y],
    ['huachipato', 'Huachipato', B, K], ['nublense', 'Ñublense', R, W], ['ohiggins', "O'Higgins", SKY, W], ['palestino', 'Palestino', G, R],
    ['la-calera', 'Unión La Calera', R, W], ['catolica', 'Universidad Católica', W, B], ['u-chile', 'Universidad de Chile', B, R], ['u-concepcion', 'Universidad de Concepción', Y, B],
  ],
  uruguay: [
    ['albion', 'Albion', W, R], ['boston-river', 'Boston River', G, W], ['central-espanol', 'Central Español', R, B], ['cerro', 'Cerro', SKY, W],
    ['cerro-largo', 'Cerro Largo', B, W], ['danubio', 'Danubio', W, K], ['defensor', 'Defensor Sporting', PURPLE, W], ['maldonado', 'Deportivo Maldonado', R, G],
    ['juventud', 'Juventud de Las Piedras', B, W], ['liverpool-uy', 'Liverpool', K, B], ['mvd-city', 'Montevideo City Torque', SKY, W], ['wanderers', 'Montevideo Wanderers', K, W],
    ['nacional-uy', 'Nacional', W, B], ['penarol', 'Peñarol', Y, K], ['progreso', 'Progreso', Y, R], ['racing-uy', 'Racing Club de Montevideo', G, W],
  ],
  austria: [
    ['rapid', 'Rapid Wien', G, W], ['salzburg', 'Red Bull Salzburg', W, R], ['lask', 'LASK', K, W], ['sturm', 'Sturm Graz', K, W],
    ['ried', 'SV Ried', K, G], ['hartberg', 'TSV Hartberg', B, W], ['gak', 'GAK 1902', R, W], ['lustenau', 'Austria Lustenau', G, W],
    ['wsg-tirol', 'WSG Tirol', G, W], ['austria-wien', 'Austria Wien', PURPLE, W], ['altach', 'Rheindorf Altach', K, Y], ['wolfsberger', 'Wolfsberger AC', K, ORANGE],
  ],
  swiss: [
    ['basel', 'FC Basel', R, B], ['grasshopper', 'Grasshopper', B, W], ['zurich', 'FC Zürich', W, B], ['lausanne', 'Lausanne-Sport', B, W],
    ['lugano', 'FC Lugano', K, W], ['luzern', 'FC Luzern', B, W], ['servette', 'Servette', CLARET, W], ['sion', 'FC Sion', W, R],
    ['st-gallen', 'FC St. Gallen', G, W], ['thun', 'FC Thun', R, W], ['vaduz', 'FC Vaduz', R, B], ['young-boys', 'Young Boys', Y, K],
  ],
};

// Gameplay strength estimates for the best-known clubs of the new leagues.
export const MORE_FOUR_STAR = [
  'eredivisie-ajax', 'eredivisie-psv', 'eredivisie-feyenoord', 'eredivisie-az', 'scottish-prem-celtic', 'scottish-prem-rangers',
  'saudi-pro-al-hilal', 'saudi-pro-al-nassr', 'saudi-pro-al-ittihad', 'saudi-pro-al-ahli',
  'colombia-nacional', 'colombia-millonarios', 'chile-colo-colo', 'chile-u-chile', 'uruguay-penarol', 'uruguay-nacional-uy',
  'austria-salzburg', 'austria-sturm', 'swiss-basel', 'swiss-young-boys',
];
