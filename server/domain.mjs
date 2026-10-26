// Les valeurs brutes viennent du dictionnaire officiel de l'ONU (version 6).
export const VOTE_CHOICES = ['YES', 'NO', 'ABSTAIN', 'NOT_VOTED', 'UNKNOWN'];
const EXPLICIT_CHOICES = new Set(['YES', 'NO', 'ABSTAIN']);

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
  for (const item of orderedItems) {
    const { votes: rawVotes, ...info } = item;
    const resolution = { ...info, voteMap: new Map() };
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
  return { metadata: dataset.metadata, countries, resolutions, countryVotes, orderedResolutions };
}

// La présence d'une abstention est explicite ; une non-participation ne l'est pas.
// Les résolutions sans vote de l'un OU des deux pays ne sont pas au dénominateur.
export function compareCountries(store, countryAId, countryBId, from, to) {
  let commonVoteCount = 0;
  let matchingVoteCount = 0;
  let nonComparableCount = 0;
  let firstDate = null;
  let lastDate = null;
  const divergences = [];
  for (const resolution of store.orderedResolutions) {
    const year = Number(resolution.date.slice(0, 4));
    if (year < from || year > to) continue;
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

export function compareTrend(store, countryAId, countryBId, from, to, interval = 'year') {
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
    interval,
    points,
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
