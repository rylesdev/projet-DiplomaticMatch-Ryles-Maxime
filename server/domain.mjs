import { FRENCH_NAMES } from './country-names.mjs';
import { THEMES, assignThemes } from './themes.mjs';

// Les valeurs brutes viennent du dictionnaire officiel de l'ONU (version 6).
export const VOTE_CHOICES = ['YES', 'NO', 'ABSTAIN', 'NOT_VOTED', 'UNKNOWN'];
export const EXPLICIT_CHOICES = new Set(['YES', 'NO', 'ABSTAIN']);
const MATRIX_CACHE_LIMIT = 6;
const matrixCaches = new WeakMap();

// Correspondances bilingues FR -> terminologie documentaire anglaise de l'ONU.
const SEARCH_SYNONYMS = {
  taiwan: ['china', '2758'],
  'republique de chine': ['republic of china', 'representation of china'],
  chine: ['china'],
  palestine: ['palestine', 'palestinian', 'unrwa'],
  israel: ['israel', 'israeli', 'occupied territories'],
  ukraine: ['ukraine', 'ukrainian', 'es-11'],
  nucleaire: ['nuclear', 'atomic'],
  'droits humains': ['human rights'],
  'droits de l homme': ['human rights'],
  climat: ['climate'],
  'moyen-orient': ['middle east'],
  'moyen orient': ['middle east'],
  desarmement: ['disarmament'],
  coree: ['korea', 'korean'],
  'afrique du sud': ['south africa', 'apartheid'],
  apartheid: ['apartheid'],
  cuba: ['cuba', 'embargo'],
  syrie: ['syria', 'syrian'],
  irak: ['iraq'],
  iran: ['iran'],
  russie: ['russian', 'soviet'],
  urss: ['soviet', 'ussr'],
  decolonisation: ['decolonization', 'colonial', 'non-self-governing'],
  colonisation: ['colonial', 'decolonization'],
};

function matchesQuery(resolution, normalizedQuery) {
  if (!normalizedQuery) return true;
  if (resolution.searchText.includes(normalizedQuery)) return true;
  const synonyms = SEARCH_SYNONYMS[normalizedQuery];
  if (synonyms) return synonyms.some((term) => resolution.searchText.includes(term));
  return false;
}

export function inScope(resolution, from, to, theme, normalizedQuery = '') {
  const year = Number(resolution.date.slice(0, 4));
  return (
    year >= from &&
    year <= to &&
    (theme === 'all' || resolution.themeIds.includes(theme)) &&
    matchesQuery(resolution, normalizedQuery)
  );
}

export function normalizeVote(raw) {
  return { Y: 'YES', N: 'NO', A: 'ABSTAIN', X: 'NOT_VOTED' }[raw] ?? 'UNKNOWN';
}

export function normalizeSearch(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr');
}

export function publicResolution(resolution) {
  const { id, symbol, title, date, sourceUrl } = resolution;
  return { id, symbol, title, date, sourceUrl };
}

// Choix explicite strictement majoritaire (Pour, Contre ou Abstention) ; null en cas d'égalité en tête.
function majorityOf(totals) {
  const explicitTotal = totals.YES + totals.NO + totals.ABSTAIN;
  const [first, second] = ['YES', 'NO', 'ABSTAIN'].sort((a, b) => totals[b] - totals[a]);
  const majorityChoice = totals[first] > 0 && totals[first] > totals[second] ? first : null;
  return { explicitTotal, majorityChoice };
}

export function createStore(dataset) {
  if (
    dataset.schemaVersion !== 1 ||
    !Array.isArray(dataset.countries) ||
    !Array.isArray(dataset.resolutions)
  ) {
    throw new Error('Format de données incompatible. Relancer npm run data:import.');
  }
  // Le nom affiché vient de la table française ; un code absent de la table garde son nom source.
  const localized = dataset.countries.map((country) => ({
    ...country,
    name: FRENCH_NAMES[country.id] ?? country.name,
  }));
  const countries = new Map(localized.map((country) => [country.id, country]));
  const resolutions = new Map();
  const countryVotes = new Map(dataset.countries.map((country) => [country.id, []]));
  const symbolCollator = new Intl.Collator('en', { numeric: true });
  const orderedItems = dataset.resolutions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || symbolCollator.compare(b.symbol, a.symbol));
  // On parcourt les résolutions déjà triées : les 954 382 lignes pays n'ont pas à être retriées.
  const orderedResolutions = [];
  const themes = THEMES.map((theme) => ({
    ...theme,
    resolutionCount: 0,
    recordedVoteResolutionCount: 0,
  }));
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  for (const item of orderedItems) {
    const { votes: rawVotes, ...info } = item;
    const themeIds = assignThemes(info.subjects ?? []);
    // Texte normalisé (symbole, titre, sujets) pour la recherche par mot-clé de la comparaison.
    const searchText = normalizeSearch(
      [info.symbol, info.title, ...(info.subjects ?? [])].join(' '),
    );
    const resolution = { ...info, themeIds, searchText, voteMap: new Map() };
    // Totaux de l'Assemblée pour la résolution : servent à trouver la « majorité de séance ».
    const assemblyTotals = { YES: 0, NO: 0, ABSTAIN: 0, NOT_VOTED: 0, UNKNOWN: 0 };
    for (const themeId of ['all', ...new Set(themeIds)]) {
      const theme = themeById.get(themeId);
      theme.resolutionCount++;
      if (rawVotes.length > 0) theme.recordedVoteResolutionCount++;
    }
    for (const [countryIndex, rawChoice] of rawVotes) {
      const country = localized[countryIndex];
      if (!country) throw new Error(`Index de pays invalide pour ${item.id}.`);
      const choice = normalizeVote(rawChoice);
      assemblyTotals[choice]++;
      resolution.voteMap.set(country.id, { choice, rawChoice });
      countryVotes.get(country.id).push({ resolution, choice, rawChoice });
    }
    resolution.assemblyTotals = { ...assemblyTotals, ...majorityOf(assemblyTotals) };
    resolutions.set(item.id, resolution);
    orderedResolutions.push(resolution);
  }
  return {
    metadata: dataset.metadata,
    countries,
    resolutions,
    countryVotes,
    orderedResolutions,
    themes,
  };
}

// La présence d'une abstention est explicite ; une non-participation ne l'est pas.
// Les résolutions sans vote de l'un OU des deux pays ne sont pas au dénominateur.
export function compareCountries(
  store,
  countryAId,
  countryBId,
  from,
  to,
  theme = 'all',
  search = '',
) {
  const rawSearch = String(search ?? '').trim();
  const normalizedQuery = normalizeSearch(rawSearch);
  // Exemples de résolutions gardés pour chaque case de la grille 3 × 3 (réponse légère).
  const examplesPerCell = normalizedQuery ? 6 : 4;
  const examplesByCell = new Map();
  let commonVoteCount = 0;
  let matchingVoteCount = 0;
  let nonComparableCount = 0;
  let firstDate = null;
  let lastDate = null;
  let archiveCommonVoteCount = 0;
  let archiveFromYear = null;
  let archiveToYear = null;
  const breakdown = {
    YES: { YES: 0, NO: 0, ABSTAIN: 0 },
    NO: { YES: 0, NO: 0, ABSTAIN: 0 },
    ABSTAIN: { YES: 0, NO: 0, ABSTAIN: 0 },
  };
  const agreements = [];
  const divergences = [];
  for (const resolution of store.orderedResolutions) {
    if (
      normalizedQuery &&
      (theme === 'all' || resolution.themeIds.includes(theme)) &&
      matchesQuery(resolution, normalizedQuery)
    ) {
      const vA = resolution.voteMap.get(countryAId);
      const vB = resolution.voteMap.get(countryBId);
      if (EXPLICIT_CHOICES.has(vA?.choice) && EXPLICIT_CHOICES.has(vB?.choice)) {
        const resYear = Number(resolution.date.slice(0, 4));
        archiveCommonVoteCount++;
        archiveFromYear =
          archiveFromYear === null || resYear < archiveFromYear ? resYear : archiveFromYear;
        archiveToYear = archiveToYear === null || resYear > archiveToYear ? resYear : archiveToYear;
      }
    }
    if (!inScope(resolution, from, to, theme, normalizedQuery)) continue;
    const voteA = resolution.voteMap.get(countryAId);
    const voteB = resolution.voteMap.get(countryBId);
    // Les résolutions sans aucun vote de ces deux pays n'entrent pas dans l'univers observé.
    if (!voteA && !voteB) continue;
    if (!EXPLICIT_CHOICES.has(voteA?.choice) || !EXPLICIT_CHOICES.has(voteB?.choice)) {
      nonComparableCount++;
      continue;
    }
    commonVoteCount++;
    breakdown[voteA.choice][voteB.choice]++;
    firstDate = firstDate === null || resolution.date < firstDate ? resolution.date : firstDate;
    lastDate = lastDate === null || resolution.date > lastDate ? resolution.date : lastDate;
    if (voteA.choice === voteB.choice) matchingVoteCount++;
    const cell = `${voteA.choice}:${voteB.choice}`;
    const examples = examplesByCell.get(cell) ?? 0;
    if (examples < examplesPerCell) {
      examplesByCell.set(cell, examples + 1);
      (voteA.choice === voteB.choice ? agreements : divergences).push({
        resolution: publicResolution(resolution),
        choiceA: voteA.choice,
        choiceB: voteB.choice,
      });
    }
  }
  return {
    countryA: store.countries.get(countryAId),
    countryB: store.countries.get(countryBId),
    from,
    to,
    theme,
    ...(rawSearch ? { search: rawSearch } : {}),
    ...(normalizedQuery
      ? {
          archiveSearchHint: {
            archiveCommonVoteCount,
            fromYear: archiveFromYear,
            toYear: archiveToYear,
          },
        }
      : {}),
    commonVoteCount,
    matchingVoteCount,
    differingVoteCount: commonVoteCount - matchingVoteCount,
    nonComparableCount,
    agreementPercent: commonVoteCount === 0 ? null : (100 * matchingVoteCount) / commonVoteCount,
    breakdown,
    coverage: { from: firstDate, to: lastDate },
    dataVersion: store.metadata.version,
    agreements,
    divergences,
  };
}

export function rankCountries(store, countryId, from, to, minVotes = 20, theme = 'all') {
  const aggregates = new Map();
  // Même univers et même formule que compareCountries : seuls Y/N/A des deux pays comptent.
  // Un seul parcours des votes du pays suffit pour comparer tous les autres États.
  for (const { resolution, choice } of store.countryVotes.get(countryId)) {
    if (!inScope(resolution, from, to, theme) || !EXPLICIT_CHOICES.has(choice)) continue;
    for (const [otherId, otherVote] of resolution.voteMap) {
      if (otherId === countryId || !EXPLICIT_CHOICES.has(otherVote.choice)) continue;
      let entry = aggregates.get(otherId);
      if (!entry) {
        entry = {
          country: store.countries.get(otherId),
          commonVoteCount: 0,
          matchingVoteCount: 0,
          coverage: { from: resolution.date, to: resolution.date },
        };
        aggregates.set(otherId, entry);
      }
      entry.commonVoteCount++;
      if (choice === otherVote.choice) entry.matchingVoteCount++;
      if (resolution.date < entry.coverage.from) entry.coverage.from = resolution.date;
      if (resolution.date > entry.coverage.to) entry.coverage.to = resolution.date;
    }
  }
  const candidates = Array.from(aggregates.values())
    .filter((entry) => entry.commonVoteCount >= minVotes)
    .map((entry) => ({
      ...entry,
      differingVoteCount: entry.commonVoteCount - entry.matchingVoteCount,
      agreementPercent: (100 * entry.matchingVoteCount) / entry.commonVoteCount,
    }));
  const names = new Intl.Collator('fr');
  const tieBreaker = (a, b) =>
    b.commonVoteCount - a.commonVoteCount ||
    names.compare(a.country.name, b.country.name) ||
    a.country.id.localeCompare(b.country.id, 'en');
  // Les produits croisés comparent les fractions sans arrondir les pourcentages.
  const closest = candidates
    .slice()
    .sort(
      (a, b) =>
        b.matchingVoteCount * a.commonVoteCount - a.matchingVoteCount * b.commonVoteCount ||
        tieBreaker(a, b),
    )
    .slice(0, 3);
  const closestIds = new Set(closest.map((entry) => entry.country.id));
  // Les trois premiers sont réservés aux plus proches. Avec moins de six éligibles,
  // la seconde liste est volontairement incomplète pour ne jamais répéter un pays.
  const furthest = candidates
    .filter((entry) => !closestIds.has(entry.country.id))
    .sort(
      (a, b) =>
        a.matchingVoteCount * b.commonVoteCount - b.matchingVoteCount * a.commonVoteCount ||
        tieBreaker(a, b),
    )
    .slice(0, 3);
  return {
    country: store.countries.get(countryId),
    from,
    to,
    theme,
    minVotes,
    eligibleCountryCount: candidates.length,
    excludedCountryCount: store.countries.size - 1 - candidates.length,
    closest,
    furthest,
    dataVersion: store.metadata.version,
  };
}

function computeTrendInflections(points) {
  const highSample = points.filter(
    (point) => point.commonVoteCount >= 20 && point.agreementPercent !== null,
  );
  const anySample = points.filter(
    (point) => point.commonVoteCount >= 1 && point.agreementPercent !== null,
  );
  const minVotesUsed = highSample.length > 0 ? 20 : 1;
  const limitedSample = highSample.length === 0 && anySample.length > 0;
  const eligible = highSample.length > 0 ? highSample : anySample;
  if (eligible.length === 0) {
    return {
      minVotesUsed,
      limitedSample: false,
      eligiblePeriodCount: 0,
      highest: null,
      lowest: null,
      biggestRise: null,
      biggestDrop: null,
    };
  }
  const byRateDesc = eligible
    .slice()
    .sort(
      (a, b) =>
        b.matchingVoteCount * a.commonVoteCount - a.matchingVoteCount * b.commonVoteCount ||
        b.commonVoteCount - a.commonVoteCount ||
        b.year - a.year,
    );
  const highest = byRateDesc[0];
  const lowestCandidates = eligible
    .filter((point) => point.year !== highest.year)
    .sort(
      (a, b) =>
        a.matchingVoteCount * b.commonVoteCount - b.matchingVoteCount * a.commonVoteCount ||
        b.commonVoteCount - a.commonVoteCount ||
        b.year - a.year,
    );
  const lowest = lowestCandidates[0] ?? null;
  let biggestRise = null;
  let biggestDrop = null;
  for (let i = 1; i < eligible.length; i++) {
    const prev = eligible[i - 1];
    const next = eligible[i];
    const deltaPoints = next.agreementPercent - prev.agreementPercent;
    const transition = {
      fromYear: prev.year,
      toYear: next.year,
      fromPercent: prev.agreementPercent,
      toPercent: next.agreementPercent,
      deltaPoints,
      fromCommonVoteCount: prev.commonVoteCount,
      toCommonVoteCount: next.commonVoteCount,
    };
    if (
      deltaPoints > 0 &&
      (!biggestRise ||
        deltaPoints > biggestRise.deltaPoints ||
        (deltaPoints === biggestRise.deltaPoints &&
          (next.commonVoteCount + prev.commonVoteCount >
            biggestRise.toCommonVoteCount + biggestRise.fromCommonVoteCount ||
            next.year > biggestRise.toYear)))
    ) {
      biggestRise = transition;
    }
    if (
      deltaPoints < 0 &&
      (!biggestDrop ||
        deltaPoints < biggestDrop.deltaPoints ||
        (deltaPoints === biggestDrop.deltaPoints &&
          (next.commonVoteCount + prev.commonVoteCount >
            biggestDrop.toCommonVoteCount + biggestDrop.fromCommonVoteCount ||
            next.year > biggestDrop.toYear)))
    ) {
      biggestDrop = transition;
    }
  }
  return {
    minVotesUsed,
    limitedSample,
    eligiblePeriodCount: eligible.length,
    highest,
    lowest,
    biggestRise,
    biggestDrop,
  };
}

export function compareTrend(
  store,
  countryAId,
  countryBId,
  from,
  to,
  interval = 'year',
  theme = 'all',
  search = '',
) {
  const rawSearch = String(search ?? '').trim();
  const step = interval === 'decade' ? 10 : 1;
  const firstYear = interval === 'decade' ? Math.floor(from / 10) * 10 : from;
  const points = [];
  for (let year = firstYear; year <= to; year += step) {
    const result = compareCountries(
      store,
      countryAId,
      countryBId,
      Math.max(from, year),
      Math.min(to, year + step - 1),
      theme,
      rawSearch,
    );
    points.push({
      year,
      commonVoteCount: result.commonVoteCount,
      matchingVoteCount: result.matchingVoteCount,
      agreementPercent: result.agreementPercent,
    });
  }
  return {
    countryA: store.countries.get(countryAId),
    countryB: store.countries.get(countryBId),
    from,
    to,
    theme,
    ...(rawSearch ? { search: rawSearch } : {}),
    interval,
    points,
    inflections: computeTrendInflections(points),
    dataVersion: store.metadata.version,
  };
}

function matrixAggregates(store, from, to, theme) {
  let cache = matrixCaches.get(store);
  if (!cache) {
    cache = new Map();
    matrixCaches.set(store, cache);
  }
  const key = JSON.stringify([from, to, theme]);
  if (cache.has(key)) {
    const found = cache.get(key);
    cache.delete(key);
    cache.set(key, found);
    return found;
  }
  const names = new Intl.Collator('fr');
  const countries = Array.from(store.countries.values()).sort(
    (a, b) => names.compare(a.name, b.name) || a.id.localeCompare(b.id, 'en'),
  );
  const indexes = new Map(countries.map((country, index) => [country.id, index]));
  const size = countries.length;
  const common = new Uint32Array(size * size);
  const matching = new Uint32Array(size * size);
  for (const resolution of store.orderedResolutions) {
    if (!inScope(resolution, from, to, theme)) continue;
    const countryIndexes = [];
    const choices = [];
    for (const [id, vote] of resolution.voteMap) {
      if (!EXPLICIT_CHOICES.has(vote.choice)) continue;
      countryIndexes.push(indexes.get(id));
      choices.push(vote.choice);
    }
    // Chaque paire explicite n'est visitée qu'une fois par résolution, diagonale incluse.
    // Son orientation peut varier dans la source ; les deux sens sont réunis au rendu.
    for (let a = 0; a < countryIndexes.length; a++) {
      const rowOffset = countryIndexes[a] * size;
      const choiceA = choices[a];
      for (let b = a; b < countryIndexes.length; b++) {
        const offset = rowOffset + countryIndexes[b];
        common[offset]++;
        if (choiceA === choices[b]) matching[offset]++;
      }
    }
  }
  const result = { countries, common, matching };
  cache.set(key, result);
  if (cache.size > MATRIX_CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return result;
}

export function compareMatrix(store, from, to, minVotes = 20, theme = 'all') {
  const { countries, common, matching } = matrixAggregates(store, from, to, theme);
  const size = countries.length;
  const commonVoteCounts = Array.from({ length: size }, () => Array(size).fill(0));
  const matchingVoteCounts = Array.from({ length: size }, () => Array(size).fill(0));
  const agreementPercents = Array.from({ length: size }, () => Array(size).fill(null));
  for (let a = 0; a < size; a++) {
    for (let b = a; b < size; b++) {
      const count = common[a * size + b] + (a === b ? 0 : common[b * size + a]);
      const matches = matching[a * size + b] + (a === b ? 0 : matching[b * size + a]);
      // Sous le seuil, les effectifs restent disponibles mais aucun taux n'est présenté.
      const percentage = count > 0 && count >= minVotes ? (100 * matches) / count : null;
      commonVoteCounts[a][b] = commonVoteCounts[b][a] = count;
      matchingVoteCounts[a][b] = matchingVoteCounts[b][a] = matches;
      agreementPercents[a][b] = agreementPercents[b][a] = percentage;
    }
  }
  return {
    countries: countries.slice(),
    from,
    to,
    theme,
    minVotes,
    agreementPercents,
    commonVoteCounts,
    matchingVoteCounts,
    dataVersion: store.metadata.version,
  };
}

// Matrice limitée à quelques pays, dans l'ordre demandé : on garde les lignes et colonnes
// voulues de la matrice complète, qui applique déjà la formule, le thème et le seuil.
export function selectMatrix(store, countryIds, from, to, minVotes = 20, theme = 'all') {
  const full = compareMatrix(store, from, to, minVotes, theme);
  const indexes = countryIds.map((id) => full.countries.findIndex((country) => country.id === id));
  const pick = (grid) => indexes.map((row) => indexes.map((column) => grid[row][column]));
  return {
    ...full,
    countries: indexes.map((index) => full.countries[index]),
    agreementPercents: pick(full.agreementPercents),
    commonVoteCounts: pick(full.commonVoteCounts),
    matchingVoteCounts: pick(full.matchingVoteCounts),
  };
}

// Fiche pays : répartition des votes et alignement sur la majorité de séance de l'Assemblée.
export function countryProfile(store, countryId, from, to, theme = 'all') {
  const totals = Object.fromEntries(VOTE_CHOICES.map((choice) => [choice, 0]));
  let recordedResolutionCount = 0;
  let explicitVoteCount = 0;
  let comparableWithMajorityCount = 0;
  let alignedWithMajorityCount = 0;
  let tiedMajorityCount = 0;
  let strictMinorityVoteCount = 0;
  let firstDate = null;
  let lastDate = null;
  const dissenting = [];
  for (const { resolution, choice } of store.countryVotes.get(countryId)) {
    if (!inScope(resolution, from, to, theme)) continue;
    recordedResolutionCount++;
    totals[choice]++;
    if (!EXPLICIT_CHOICES.has(choice)) continue;
    explicitVoteCount++;
    firstDate = firstDate === null || resolution.date < firstDate ? resolution.date : firstDate;
    lastDate = lastDate === null || resolution.date > lastDate ? resolution.date : lastDate;
    const { majorityChoice, explicitTotal, YES, NO, ABSTAIN } = resolution.assemblyTotals;
    if (majorityChoice === null) {
      tiedMajorityCount++;
      continue;
    }
    comparableWithMajorityCount++;
    if (choice === majorityChoice) {
      alignedWithMajorityCount++;
    } else {
      const sameChoiceCount = resolution.assemblyTotals[choice];
      if (sameChoiceCount <= 5) strictMinorityVoteCount++;
      dissenting.push({
        resolution: publicResolution(resolution),
        choice,
        majorityChoice,
        sameChoiceCount,
        assemblyExplicitTotal: explicitTotal,
        assemblyTotals: { YES, NO, ABSTAIN },
      });
    }
  }
  const symbolCollator = new Intl.Collator('en', { numeric: true });
  dissenting.sort(
    (a, b) =>
      a.sameChoiceCount - b.sameChoiceCount ||
      b.assemblyExplicitTotal - a.assemblyExplicitTotal ||
      b.resolution.date.localeCompare(a.resolution.date) ||
      symbolCollator.compare(b.resolution.symbol, a.resolution.symbol),
  );
  return {
    country: store.countries.get(countryId),
    from,
    to,
    theme,
    totals,
    recordedResolutionCount,
    explicitVoteCount,
    comparableWithMajorityCount,
    alignedWithMajorityCount,
    dissentingVoteCount: comparableWithMajorityCount - alignedWithMajorityCount,
    tiedMajorityCount,
    majorityAlignmentPercent:
      comparableWithMajorityCount === 0
        ? null
        : (100 * alignedWithMajorityCount) / comparableWithMajorityCount,
    strictMinorityVoteCount,
    coverage: { from: firstDate, to: lastDate },
    minorityVotes: dissenting.slice(0, 8),
    dataVersion: store.metadata.version,
  };
}

export function resolutionDetail(store, resolution) {
  const totals = Object.fromEntries(VOTE_CHOICES.map((choice) => [choice, 0]));
  const votes = Array.from(resolution.voteMap, ([countryId, vote]) => {
    totals[vote.choice]++;
    return { country: store.countries.get(countryId), ...vote };
  }).sort((a, b) => a.country.name.localeCompare(b.country.name, 'fr'));
  return { ...publicResolution(resolution), votes, totals };
}
