// Regroupements propres au projet : ces thèmes ne sont pas une taxonomie officielle de l'ONU.
// Seuls les sujets documentaires source sont examinés, jamais le titre ou le pays concerné.
export const THEME_CLASSIFICATION_VERSION = 'diplomatic-match-subject-rules-v1';

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
