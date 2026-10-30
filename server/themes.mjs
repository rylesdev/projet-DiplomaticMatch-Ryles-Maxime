// Regroupements propres au projet : ces thèmes ne sont pas une taxonomie officielle de l'ONU.
// Seuls les sujets documentaires source sont examinés, jamais le titre ou le pays concerné.
// v2 : ajout de cinq thèmes ; les six règles de la v1 sont inchangées.
export const THEME_CLASSIFICATION_VERSION = 'diplomatic-match-subject-rules-v2';

export const THEMES = [
  { id: 'all', label: 'Tous les sujets', description: 'Aucun filtre thématique.' },
  {
    id: 'environment',
    label: 'Écologie et environnement',
    description: 'Sujets explicites liés à l’environnement, au climat et à la conservation.',
  },
  {
    id: 'security',
    label: 'Sécurité et paix',
    description: 'Paix, conflits armés, désarmement, armes et lutte contre le terrorisme.',
  },
  {
    id: 'rights',
    label: 'Droits et protection des personnes',
    description: 'Droits humains, lutte contre les discriminations et protection des personnes.',
  },
  {
    id: 'development',
    label: 'Développement et conditions de vie',
    description: 'Développement, coopération économique, pauvreté, santé et éducation.',
  },
  {
    id: 'decolonization',
    label: 'Décolonisation et autodétermination',
    description: 'Décolonisation, territoires non autonomes et autodétermination des peuples.',
  },
  {
    id: 'institutions',
    label: 'Institutions et fonctionnement de l’ONU',
    description: 'Organes, programmes, budget, personnel et fonctionnement des Nations unies.',
  },
  {
    id: 'middle-east',
    label: 'Moyen-Orient et question palestinienne',
    description: 'Question de Palestine, situation au Moyen-Orient et territoires occupés.',
  },
  {
    id: 'law',
    label: 'Droit international et justice',
    description: 'Droit de la mer, droit international, juridictions et prévention du crime.',
  },
  {
    id: 'science',
    label: 'Espace, Antarctique et sciences',
    description: 'Espace extra-atmosphérique, Antarctique, sciences et télécommunications.',
  },
  {
    id: 'conflicts',
    label: 'Situations de pays et conflits',
    description: 'Situations nommées par pays ou par région (Afghanistan, Amérique centrale…).',
  },
  {
    id: 'economy',
    label: 'Économie, commerce et finances',
    description: 'Mondialisation, dette extérieure, commerce, produits de base et sanctions.',
  },
  {
    id: 'unclassified',
    label: 'Sans thème attribué',
    description: 'Sujets absents ou non couverts par les règles de classement du projet.',
  },
];

// Les expressions sont également conservées dans le manifeste pour rendre le classement rejouable.
// Les subdivisions -- restent dans le libellé ; seule la comparaison ignore casse et espaces externes.
export const THEME_RULES = [
  {
    id: 'environment',
    patterns: [
      '\\bENVIRONMENT(?:AL(?:LY)?)?\\b',
      '\\b(?:CLIMATE|BIOLOGICAL DIVERSITY|BIODIVERSITY|DESERTIFICATION|POLLUTION|OZONE)\\b',
      '\\b(?:FORESTS?|MARINE ECOSYSTEMS|LIVING MARINE RESOURCES|NATURE CONSERVATION|CONSERVATION OF NATURE)\\b',
      '^(?:NATURE|OCEANS)(?:--|$)',
    ],
  },
  {
    id: 'security',
    patterns: [
      '\\b(?:DISARMAMENT|WEAPONS?|ARMS|ARMED CONFLICTS?|TERRORISM|COUNTER-TERRORISM)\\b',
      '\\bPEACE(?:KEEPING|BUILDING)?\\b',
      '\\b(?:INTERNATIONAL|REGIONAL|COLLECTIVE) SECURITY\\b',
      '\\b(?:PEACE AND SECURITY|SECURITY COUNCIL|NUCLEAR NON-PROLIFERATION|NUCLEAR TEST BANS?|NUCLEAR-TEST-BAN|MILITARY BUDGETS)\\b',
    ],
  },
  {
    id: 'rights',
    patterns: [
      '\\b(?:HUMAN RIGHTS|RIGHTS OF|RIGHT TO|DISCRIMINATION|RACISM|APARTHEID|TORTURE|GENOCIDE)\\b',
      "\\b(?:WOMEN'S ADVANCEMENT|WOMEN'S RIGHTS|GENDER EQUALITY|REFUGEES|DISPLACED PERSONS|PERSONS WITH DISABILITIES)\\b",
    ],
  },
  {
    id: 'development',
    patterns: [
      '\\b(?:DEVELOPMENT|DEVELOPING COUNTRIES|POVERTY|HEALTH|EDUCATION|HUMAN SETTLEMENTS)\\b',
      '\\b(?:ECONOMIC|SOCIAL) (?:ASSISTANCE|COOPERATION|GROWTH|CONDITIONS)\\b',
      '\\b(?:INTERNATIONAL TRADE|FOOD SECURITY|FOOD PROBLEMS|HUNGER|LEAST DEVELOPED COUNTRIES)\\b',
    ],
  },
  {
    id: 'decolonization',
    patterns: [
      '\\b(?:DECOLONIZATION|COLONIALISM|COLONIAL COUNTRIES|NON-SELF-GOVERNING TERRITORIES|TRUST TERRITORIES)\\b',
      '\\b(?:SELF-DETERMINATION OF PEOPLES|NATIONAL LIBERATION MOVEMENTS)\\b',
    ],
  },
  {
    id: 'institutions',
    patterns: [
      '^UN(?:[. ]|--)',
      '^(?:UNRWA|UNDP|UNEP|UNICEF|UNFPA|UNITAR|UNIDIR|UNHCR)(?:[. ]|--|$)',
      '^(?:CONFERENCE AND MEETING SERVICES|PERSONNEL QUESTIONS|INTERNATIONAL CIVIL SERVICE)(?:--|$)',
    ],
  },
  // Thèmes ajoutés en v2 : chacun regroupe plus de 100 résolutions avec votes individuels.
  {
    id: 'middle-east',
    patterns: [
      '\\b(?:PALESTINE QUESTION|PALESTINIANS?|MIDDLE EAST|TERRITORIES OCCUPIED BY ISRAEL|SYRIAN GOLAN|JERUSALEM|ISRAEL)\\b',
      '^UNRWA(?:--|$)',
    ],
  },
  {
    id: 'law',
    patterns: [
      '\\b(?:LAW OF THE SEA|INTERNATIONAL LAW|INTERNATIONAL CRIMINAL COURT|INTERNATIONAL TRIBUNAL|INTERNATIONAL COURT OF JUSTICE|DISPUTE SETTLEMENT|TREATIES|DIPLOMATIC RELATIONS|STATE RESPONSIBILITY|CRIMINAL JUSTICE|CRIME PREVENTION|INTERNATIONAL LAW COMMISSION)\\b',
    ],
  },
  {
    id: 'science',
    patterns: [
      '\\b(?:OUTER SPACE|ANTARCTICA|SCIENCE AND TECHNOLOGY|TELECOMMUNICATIONS?|INFORMATION AND COMMUNICATIONS TECHNOLOGY|ATOMIC RADIATION)\\b',
    ],
  },
  {
    // « MIDDLE EAST SITUATION » relève déjà du thème middle-east.
    id: 'conflicts',
    patterns: [
      '^(?!MIDDLE EAST)[^-]*\\bSITUATION\\b',
      '^(?:CUBA|UKRAINE|IRAQ|NICARAGUA|AFGHANISTAN|KOREA|CYPRUS|WESTERN SAHARA|FALKLAND ISLANDS \\(MALVINAS\\) QUESTION|NAMIBIA QUESTION|SOUTH AFRICA)(?:--|$)',
    ],
  },
  {
    id: 'economy',
    patterns: [
      '\\b(?:GLOBALIZATION|EXTERNAL DEBT|NEW INTERNATIONAL ECONOMIC ORDER|COMMODITIES|ECONOMIC SANCTIONS|TAXATION|ECONOMIC RIGHTS AND DUTIES OF STATES|INTERNATIONAL TRADE|FINANCIAL|MONETARY|UNILATERAL ECONOMIC MEASURES|ECONOMIC EMBARGO|ECONOMIC COERCION)\\b',
    ],
  },
];

const compiledRules = THEME_RULES.map(({ id, patterns }) => ({
  id,
  patterns: patterns.map((pattern) => new RegExp(pattern, 'u')),
}));

export function assignThemes(subjects) {
  const labels = Array.isArray(subjects)
    ? subjects
        .filter((subject) => typeof subject === 'string')
        .map((subject) => subject.trim().toUpperCase())
    : [];
  const themes = compiledRules
    .filter(({ patterns }) =>
      labels.some((label) => patterns.some((pattern) => pattern.test(label))),
    )
    .map(({ id }) => id);
  return themes.length ? themes : ['unclassified'];
}
