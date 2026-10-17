// The rest of FIFA's 211 national teams, by confederation group (europe = UEFA, america = CONMEBOL + CONCACAF).
// Rows: [id, name, primary kit colour, secondary kit colour, stars]. Stars are a gameplay strength estimate.
export const MORE_NATIONAL_GROUPS = [
  { id: 'africa', label: 'África · Selecciones', type: 'national' },
  { id: 'asia', label: 'Asia · Selecciones', type: 'national' },
  { id: 'oceania', label: 'Oceanía · Selecciones', type: 'national' },
];

const R = '#D83B45', W = '#F4F3EE', K = '#191919', B = '#1765A8', Y = '#F2D34E', G = '#16824E', SKY = '#79BCE8', NAVY = '#173F75', O = '#EE7623', CLARET = '#7A2139', GOLD = '#C9A227';

export const MORE_NATIONAL_ROWS = {
  europe: [
    ['albania', 'Albania', R, K, 3], ['andorra', 'Andorra', B, Y, 1], ['armenia', 'Armenia', R, B, 2], ['azerbaijan', 'Azerbaiyán', B, R, 2],
    ['belarus', 'Bielorrusia', R, W, 2], ['bosnia', 'Bosnia y Herzegovina', B, Y, 3], ['bulgaria', 'Bulgaria', W, G, 2], ['cyprus', 'Chipre', B, W, 2],
    ['estonia', 'Estonia', B, K, 2], ['faroe', 'Islas Feroe', W, B, 2], ['finland', 'Finlandia', W, NAVY, 3], ['georgia', 'Georgia', W, R, 3],
    ['gibraltar', 'Gibraltar', R, W, 1], ['iceland', 'Islandia', B, W, 3], ['israel', 'Israel', W, B, 3], ['kazakhstan', 'Kazajistán', Y, SKY, 2],
    ['kosovo', 'Kosovo', B, Y, 2], ['latvia', 'Letonia', CLARET, W, 2], ['liechtenstein', 'Liechtenstein', B, R, 1], ['lithuania', 'Lituania', Y, G, 2],
    ['luxembourg', 'Luxemburgo', R, SKY, 2], ['malta', 'Malta', R, W, 1], ['moldova', 'Moldavia', B, Y, 1], ['montenegro', 'Montenegro', R, GOLD, 3],
    ['north-macedonia', 'Macedonia del Norte', R, Y, 3], ['northern-ireland', 'Irlanda del Norte', G, W, 3], ['ireland', 'Irlanda', G, W, 3], ['russia', 'Rusia', W, B, 3],
    ['san-marino', 'San Marino', SKY, W, 1], ['slovakia', 'Eslovaquia', B, W, 3], ['slovenia', 'Eslovenia', W, G, 3],
  ],
  america: [
    ['anguilla', 'Anguila', B, O, 1], ['antigua', 'Antigua y Barbuda', K, R, 1], ['aruba', 'Aruba', Y, SKY, 1], ['bahamas', 'Bahamas', Y, SKY, 1],
    ['barbados', 'Barbados', Y, B, 1], ['belize', 'Belice', B, R, 1], ['bermuda', 'Bermudas', B, R, 1], ['british-virgin', 'Islas Vírgenes Británicas', G, Y, 1],
    ['cayman', 'Islas Caimán', R, W, 1], ['cuba', 'Cuba', R, B, 2], ['curacao', 'Curazao', B, Y, 3], ['dominica', 'Dominica', G, Y, 1],
    ['dominican-republic', 'República Dominicana', B, R, 2], ['el-salvador', 'El Salvador', B, W, 2], ['grenada', 'Granada', R, Y, 1], ['guyana', 'Guyana', G, Y, 2],
    ['haiti', 'Haití', B, R, 3], ['montserrat', 'Montserrat', G, B, 1], ['nicaragua', 'Nicaragua', B, W, 2], ['puerto-rico', 'Puerto Rico', R, B, 1],
    ['st-kitts', 'San Cristóbal y Nieves', G, R, 1], ['st-lucia', 'Santa Lucía', SKY, Y, 1], ['st-vincent', 'San Vicente y las Granadinas', B, G, 1], ['suriname', 'Surinam', W, R, 2],
    ['trinidad', 'Trinidad y Tobago', R, K, 2], ['turks-caicos', 'Islas Turcas y Caicos', B, W, 1], ['us-virgin', 'Islas Vírgenes de EE. UU.', B, Y, 1],
  ],
  africa: [
    ['algeria', 'Argelia', W, G, 3], ['angola', 'Angola', R, K, 2], ['benin', 'Benín', Y, G, 2], ['botswana', 'Botsuana', SKY, K, 1],
    ['burkina-faso', 'Burkina Faso', G, R, 2], ['burundi', 'Burundi', R, G, 1], ['cameroon', 'Camerún', G, R, 3], ['cape-verde', 'Cabo Verde', B, W, 3],
    ['central-african', 'República Centroafricana', B, W, 1], ['chad', 'Chad', B, Y, 1], ['comoros', 'Comoras', G, W, 2], ['congo', 'Congo', G, Y, 2],
    ['dr-congo', 'RD del Congo', SKY, R, 3], ['djibouti', 'Yibuti', SKY, G, 1], ['egypt', 'Egipto', R, W, 3], ['equatorial-guinea', 'Guinea Ecuatorial', R, G, 2],
    ['eritrea', 'Eritrea', B, G, 1], ['eswatini', 'Esuatini', B, Y, 1], ['ethiopia', 'Etiopía', G, Y, 1], ['gabon', 'Gabón', Y, G, 2],
    ['gambia', 'Gambia', R, B, 2], ['ghana', 'Ghana', W, K, 3], ['guinea', 'Guinea', R, Y, 2], ['guinea-bissau', 'Guinea-Bisáu', R, G, 2],
    ['ivory-coast', 'Costa de Marfil', O, W, 3], ['kenya', 'Kenia', R, G, 2], ['lesotho', 'Lesoto', B, G, 1], ['liberia', 'Liberia', B, R, 1],
    ['libya', 'Libia', R, K, 2], ['madagascar', 'Madagascar', R, G, 2], ['malawi', 'Malaui', R, K, 1], ['mali', 'Malí', Y, G, 3],
    ['mauritania', 'Mauritania', G, Y, 2], ['mauritius', 'Mauricio', R, B, 1], ['morocco', 'Marruecos', R, G, 4], ['mozambique', 'Mozambique', R, K, 2],
    ['namibia', 'Namibia', R, B, 1], ['niger', 'Níger', O, G, 1], ['nigeria', 'Nigeria', G, W, 3], ['rwanda', 'Ruanda', Y, G, 1],
    ['sao-tome', 'Santo Tomé y Príncipe', G, Y, 1], ['senegal', 'Senegal', W, G, 3], ['seychelles', 'Seychelles', R, B, 1], ['sierra-leone', 'Sierra Leona', G, B, 1],
    ['somalia', 'Somalia', SKY, W, 1], ['south-africa', 'Sudáfrica', Y, G, 3], ['south-sudan', 'Sudán del Sur', W, B, 1], ['sudan', 'Sudán', R, W, 2],
    ['tanzania', 'Tanzania', G, B, 1], ['togo', 'Togo', Y, G, 2], ['tunisia', 'Túnez', R, W, 3], ['uganda', 'Uganda', Y, K, 2],
    ['zambia', 'Zambia', G, O, 2], ['zimbabwe', 'Zimbabue', Y, G, 1],
  ],
  asia: [
    ['afghanistan', 'Afganistán', R, G, 1], ['australia', 'Australia', Y, G, 3], ['bahrain', 'Baréin', R, W, 2], ['bangladesh', 'Bangladés', G, R, 1],
    ['bhutan', 'Bután', Y, O, 1], ['brunei', 'Brunéi', Y, K, 1], ['cambodia', 'Camboya', B, R, 1], ['china', 'China', R, Y, 2],
    ['chinese-taipei', 'China Taipéi', B, W, 1], ['guam', 'Guam', B, R, 1], ['hong-kong', 'Hong Kong', R, W, 1], ['india', 'India', B, O, 2],
    ['indonesia', 'Indonesia', R, W, 2], ['iran', 'Irán', W, R, 3], ['iraq', 'Irak', G, W, 2], ['japan', 'Japón', NAVY, W, 4],
    ['jordan', 'Jordania', W, R, 3], ['south-korea', 'Corea del Sur', R, K, 3], ['north-korea', 'Corea del Norte', R, W, 2], ['kuwait', 'Kuwait', B, W, 1],
    ['kyrgyzstan', 'Kirguistán', R, Y, 2], ['laos', 'Laos', R, B, 1], ['lebanon', 'Líbano', R, W, 2], ['macau', 'Macao', G, W, 1],
    ['malaysia', 'Malasia', Y, K, 2], ['maldives', 'Maldivas', R, G, 1], ['mongolia', 'Mongolia', R, B, 1], ['myanmar', 'Myanmar', R, Y, 1],
    ['nepal', 'Nepal', R, B, 1], ['oman', 'Omán', R, W, 2], ['pakistan', 'Pakistán', G, W, 1], ['palestine', 'Palestina', W, G, 2],
    ['philippines', 'Filipinas', B, R, 1], ['qatar', 'Catar', CLARET, W, 3], ['saudi-arabia', 'Arabia Saudí', G, W, 3], ['singapore', 'Singapur', R, W, 1],
    ['sri-lanka', 'Sri Lanka', CLARET, Y, 1], ['syria', 'Siria', R, W, 2], ['tajikistan', 'Tayikistán', W, R, 2], ['thailand', 'Tailandia', B, R, 2],
    ['timor-leste', 'Timor Oriental', R, K, 1], ['turkmenistan', 'Turkmenistán', G, W, 1], ['uae', 'Emiratos Árabes Unidos', W, R, 2], ['uzbekistan', 'Uzbekistán', W, B, 3],
    ['vietnam', 'Vietnam', R, Y, 2], ['yemen', 'Yemen', R, W, 1],
  ],
  oceania: [
    ['american-samoa', 'Samoa Americana', B, R, 1], ['cook-islands', 'Islas Cook', G, W, 1], ['fiji', 'Fiyi', W, K, 1], ['new-caledonia', 'Nueva Caledonia', G, R, 2],
    ['new-zealand', 'Nueva Zelanda', W, K, 3], ['papua', 'Papúa Nueva Guinea', R, Y, 1], ['samoa', 'Samoa', B, R, 1], ['solomon', 'Islas Salomón', Y, B, 1],
    ['tahiti', 'Tahití', R, W, 1], ['tonga', 'Tonga', R, W, 1], ['vanuatu', 'Vanuatu', Y, K, 1],
  ],
};
