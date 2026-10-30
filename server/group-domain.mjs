import { EXPLICIT_CHOICES, inScope, publicResolution } from './domain.mjs';
import { HttpError, integerInRange } from './http-error.mjs';
import { THEMES, THEME_CLASSIFICATION_VERSION } from './themes.mjs';

export const GROUP_METHOD_VERSION = 'diplomatic-match-weighted-groups-v1';
export const MAX_GROUP_MEMBERS = 12;
const THEME_IDS = new Set(THEMES.map((theme) => theme.id));

function objectBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Le corps doit être un objet JSON.');
}

function allowedFields(value, fields) {
  for (const key of Object.keys(value))
    if (!fields.includes(key)) throw new HttpError(400, `Champ non autorisé : ${key}.`);
}

export function validateRevision(value) {
  return integerInRange(value, 'La révision attendue', 1, Number.MAX_SAFE_INTEGER);
}

export function validateMemberIds(store, ids) {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_GROUP_MEMBERS)
    throw new HttpError(400, 'Un groupe doit contenir entre 2 et 12 États.');
  if (new Set(ids).size !== ids.length)
    throw new HttpError(400, 'Chaque État doit apparaître une seule fois dans le groupe.');
  for (const id of ids)
    if (typeof id !== 'string' || !store.countries.has(id))
      throw new HttpError(400, 'Un des États sélectionnés est absent du jeu de données.');
  return ids.slice();
}

export function validateGroupDraft(store, input, previous = null) {
  objectBody(input);
  allowedFields(
    input,
    previous
      ? ['name', 'description', 'memberIds', 'expectedRevision']
      : ['name', 'description', 'memberIds'],
  );
  if (previous) {
    validateRevision(input.expectedRevision);
    if (!['name', 'description', 'memberIds'].some((key) => Object.hasOwn(input, key)))
      throw new HttpError(400, 'Indiquez au moins un champ à modifier.');
  }
  const name = Object.hasOwn(input, 'name') ? input.name : previous?.name;
  const description = Object.hasOwn(input, 'description')
    ? input.description
    : (previous?.description ?? '');
  const memberIds = Object.hasOwn(input, 'memberIds') ? input.memberIds : previous?.memberIds;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80)
    throw new HttpError(400, 'Le nom du groupe doit contenir entre 2 et 80 caractères.');
  if (typeof description !== 'string' || description.length > 500)
    throw new HttpError(400, 'La description est limitée à 500 caractères.');
  return {
    name: name.trim(),
    description: description.trim(),
    memberIds: validateMemberIds(store, memberIds),
  };
}

export function validateAnalysisRequest(
  store,
  input,
  allowOverride = false,
  allowHistorical = false,
) {
  objectBody(input);
  allowedFields(input, [
    'from',
    'to',
    'theme',
    'minVotes',
    'expectedRevision',
    ...(allowOverride ? ['memberIds'] : []),
    ...(allowHistorical ? ['includeHistorical'] : []),
  ]);
  const from = integerInRange(input.from, 'L’année de début', 1946, 2100);
  const to = integerInRange(input.to, 'L’année de fin', 1946, 2100);
  if (from > to) throw new HttpError(400, 'L’année de début doit précéder l’année de fin.');
  if (typeof input.theme !== 'string' || !THEME_IDS.has(input.theme))
    throw new HttpError(400, 'Ce thème n’existe pas.');
  const minVotes = integerInRange(input.minVotes, 'Le nombre minimum de votes communs', 1, 100000);
  if (
    allowHistorical &&
    Object.hasOwn(input, 'includeHistorical') &&
    typeof input.includeHistorical !== 'boolean'
  )
    throw new HttpError(400, 'L’option des entités historiques doit être un booléen.');
  return {
    filters: { from, to, theme: input.theme, minVotes },
    expectedRevision: validateRevision(input.expectedRevision),
    ...(Object.hasOwn(input, 'memberIds')
      ? { memberIds: validateMemberIds(store, input.memberIds) }
      : {}),
    ...(allowHistorical ? { includeHistorical: input.includeHistorical ?? false } : {}),
  };
}

export function coverageUnion(coverage, next) {
  if (next.from !== null && (coverage.from === null || next.from < coverage.from))
    coverage.from = next.from;
  if (next.to !== null && (coverage.to === null || next.to > coverage.to)) coverage.to = next.to;
}

function totals(pairs, minVotes) {
  let eligiblePairCount = 0;
  let commonPairVotes = 0;
  let matchingPairVotes = 0;
  for (const pair of pairs) {
    if (pair.commonVoteCount < minVotes) continue;
    eligiblePairCount++;
    commonPairVotes += pair.commonVoteCount;
    matchingPairVotes += pair.matchingVoteCount;
  }
  return {
    eligiblePairCount,
    commonPairVotes,
    matchingPairVotes,
    cohesionPercent: commonPairVotes === 0 ? null : (100 * matchingPairVotes) / commonPairVotes,
  };
}

// Concordance interne d'une liste de membres (groupe enregistré ou scénario) : calcul seul,
// sans identifiant ni révision de groupe.
export function analyzeGroup(store, memberIds, filters) {
  const members = memberIds.map((id) => store.countries.get(id));
  const pairs = [];
  const pairIndexes = members.map(() => Array(members.length).fill(-1));
  for (let a = 0; a < members.length; a++)
    for (let b = a + 1; b < members.length; b++) {
      pairIndexes[a][b] = pairs.length;
      pairs.push({
        countryA: members[a],
        countryB: members[b],
        commonVoteCount: 0,
        matchingVoteCount: 0,
        coverage: { from: null, to: null },
      });
    }
  const yearly = Array.from({ length: filters.to - filters.from + 1 }, (_, offset) => ({
    year: filters.from + offset,
    pairs: pairs.map(() => ({ commonVoteCount: 0, matchingVoteCount: 0 })),
  }));
  let observedResolutionCount = 0;
  const divisiveResolutions = [];
  for (const resolution of store.orderedResolutions) {
    if (!inScope(resolution, filters.from, filters.to, filters.theme)) continue;
    const votes = memberIds.map((id) => resolution.voteMap.get(id));
    if (votes.some((vote) => vote !== undefined)) observedResolutionCount++;
    const yearPairs = yearly[Number(resolution.date.slice(0, 4)) - filters.from].pairs;
    let comparablePairVotes = 0;
    let matchingPairVotes = 0;
    let participatingCount = 0;
    for (let a = 0; a < members.length; a++) {
      if (!EXPLICIT_CHOICES.has(votes[a]?.choice)) continue;
      participatingCount++;
      for (let b = a + 1; b < members.length; b++) {
        if (!EXPLICIT_CHOICES.has(votes[b]?.choice)) continue;
        const index = pairIndexes[a][b];
        const pair = pairs[index];
        pair.commonVoteCount++;
        yearPairs[index].commonVoteCount++;
        comparablePairVotes++;
        coverageUnion(pair.coverage, { from: resolution.date, to: resolution.date });
        if (votes[a].choice === votes[b].choice) {
          pair.matchingVoteCount++;
          yearPairs[index].matchingVoteCount++;
          matchingPairVotes++;
        }
      }
    }
    // Un vote absent n'est pas transformé en X : sans ligne source, le choix reste UNKNOWN.
    if (comparablePairVotes > 0 && matchingPairVotes < comparablePairVotes)
      divisiveResolutions.push({
        resolution: publicResolution(resolution),
        participatingCount,
        memberCount: members.length,
        matchingPairVotes,
        comparablePairVotes,
        agreementPercent: (100 * matchingPairVotes) / comparablePairVotes,
        votes: memberIds.map((id, index) => ({
          countryId: id,
          choice: votes[index]?.choice ?? 'UNKNOWN',
        })),
      });
  }
  const metrics = totals(pairs, filters.minVotes);
  const coverage = { from: null, to: null };
  const outputPairs = pairs.map((pair) => {
    const eligible = pair.commonVoteCount >= filters.minVotes;
    if (eligible) coverageUnion(coverage, pair.coverage);
    return {
      ...pair,
      differingVoteCount: pair.commonVoteCount - pair.matchingVoteCount,
      agreementPercent: eligible ? (100 * pair.matchingVoteCount) / pair.commonVoteCount : null,
      eligible,
    };
  });
  const symbols = new Intl.Collator('en', { numeric: true });
  divisiveResolutions.sort(
    (a, b) =>
      a.matchingPairVotes * b.comparablePairVotes - b.matchingPairVotes * a.comparablePairVotes ||
      b.comparablePairVotes - a.comparablePairVotes ||
      b.resolution.date.localeCompare(a.resolution.date) ||
      symbols.compare(a.resolution.symbol, b.resolution.symbol) ||
      a.resolution.id.localeCompare(b.resolution.id, 'en'),
  );
  return {
    memberIds: memberIds.slice(),
    members,
    filters: { ...filters },
    totalPairCount: pairs.length,
    ...metrics,
    observedResolutionCount,
    coverage,
    pairs: outputPairs,
    trend: yearly.map((point) => ({
      year: point.year,
      totalPairCount: pairs.length,
      ...totals(point.pairs, filters.minVotes),
    })),
    divisiveResolutions: divisiveResolutions.slice(0, 8),
    dataVersion: store.metadata.version,
    themeClassificationVersion: THEME_CLASSIFICATION_VERSION,
    methodVersion: GROUP_METHOD_VERSION,
  };
}
