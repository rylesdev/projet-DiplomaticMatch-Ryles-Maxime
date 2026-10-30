import { THEMES, assignThemes } from './themes.mjs';

// Les valeurs brutes viennent du dictionnaire officiel de l'ONU (version 6).
export const VOTE_CHOICES = ['YES', 'NO', 'ABSTAIN', 'NOT_VOTED', 'UNKNOWN'];
export const EXPLICIT_CHOICES = new Set(['YES', 'NO', 'ABSTAIN']);
const MATRIX_CACHE_LIMIT = 6;
const matrixCaches = new WeakMap();

export function inScope(resolution, from, to, theme) {
  const year = Number(resolution.date.slice(0, 4));
  return year >= from && year <= to && (theme === 'all' || resolution.themeIds.includes(theme));
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

export function createStore(dataset) {
  if (
    dataset.schemaVersion !== 1 ||
    !Array.isArray(dataset.countries) ||
    !Array.isArray(dataset.resolutions)
  ) {
    throw new Error('Format de données incompatible. Relancer npm run data:import.');
  }
  const countries = new Map(dataset.countries.map((country) => [country.id, country]));
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
    const resolution = { ...info, themeIds, voteMap: new Map() };
    for (const themeId of ['all', ...new Set(themeIds)]) {
      const theme = themeById.get(themeId);
      theme.resolutionCount++;
      if (rawVotes.length > 0) theme.recordedVoteResolutionCount++;
    }
    for (const [countryIndex, rawChoice] of rawVotes) {
      const country = dataset.countries[countryIndex];
      if (!country) throw new Error(`Index de pays invalide pour ${item.id}.`);
      const choice = normalizeVote(rawChoice);
      resolution.voteMap.set(country.id, { choice, rawChoice });
      countryVotes.get(country.id).push({ resolution, choice, rawChoice });
    }
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
export function compareCountries(store, countryAId, countryBId, from, to, theme = 'all') {
  let commonVoteCount = 0;
  let matchingVoteCount = 0;
  let nonComparableCount = 0;
  let firstDate = null;
  let lastDate = null;
  const divergences = [];
  for (const resolution of store.orderedResolutions) {
    if (!inScope(resolution, from, to, theme)) continue;
    const voteA = resolution.voteMap.get(countryAId);
    const voteB = resolution.voteMap.get(countryBId);
    // Les résolutions sans aucun vote de ces deux pays n'entrent pas dans l'univers observé.
    if (!voteA && !voteB) continue;
    if (!EXPLICIT_CHOICES.has(voteA?.choice) || !EXPLICIT_CHOICES.has(voteB?.choice)) {
      nonComparableCount++;
      continue;
    }
    commonVoteCount++;
    firstDate = firstDate === null || resolution.date < firstDate ? resolution.date : firstDate;
    lastDate = lastDate === null || resolution.date > lastDate ? resolution.date : lastDate;
    if (voteA.choice === voteB.choice) matchingVoteCount++;
    else if (divergences.length < 12)
      divergences.push({
        resolution: publicResolution(resolution),
        choiceA: voteA.choice,
        choiceB: voteB.choice,
      });
  }
  return {
    countryA: store.countries.get(countryAId),
    countryB: store.countries.get(countryBId),
    from,
    to,
    theme,
    commonVoteCount,
    matchingVoteCount,
    differingVoteCount: commonVoteCount - matchingVoteCount,
    nonComparableCount,
    agreementPercent: commonVoteCount === 0 ? null : (100 * matchingVoteCount) / commonVoteCount,
    coverage: { from: firstDate, to: lastDate },
    dataVersion: store.metadata.version,
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

export function compareTrend(
  store,
  countryAId,
  countryBId,
  from,
  to,
  interval = 'year',
  theme = 'all',
) {
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
    interval,
    points,
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

export function resolutionDetail(store, resolution) {
  const totals = Object.fromEntries(VOTE_CHOICES.map((choice) => [choice, 0]));
  const votes = Array.from(resolution.voteMap, ([countryId, vote]) => {
    totals[vote.choice]++;
    return { country: store.countries.get(countryId), ...vote };
  }).sort((a, b) => a.country.name.localeCompare(b.country.name, 'fr'));
  return { ...publicResolution(resolution), votes, totals };
}
