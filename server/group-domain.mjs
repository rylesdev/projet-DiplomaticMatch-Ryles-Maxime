import { countryRef, EXPLICIT_CHOICES, inScope, publicResolution } from './domain.mjs';
import { HttpError } from './http-error.mjs';
import { THEME_CLASSIFICATION_VERSION } from './themes.mjs';

export const GROUP_METHOD_VERSION = 'diplomatic-match-weighted-groups-v1';
export const MAX_GROUP_MEMBERS = 12;

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
        countryA: countryRef(members[a]),
        countryB: countryRef(members[b]),
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
  // Paires renvoyées sans champs déductibles (écart, éligibilité, dates) pour une réponse légère.
  const outputPairs = pairs.map(
    ({ countryA, countryB, commonVoteCount, matchingVoteCount }, index) => {
      const eligible = commonVoteCount >= filters.minVotes;
      if (eligible) coverageUnion(coverage, pairs[index].coverage);
      return {
        countryA,
        countryB,
        commonVoteCount,
        matchingVoteCount,
        agreementPercent: eligible ? (100 * matchingVoteCount) / commonVoteCount : null,
      };
    },
  );
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
    trend: yearly.map((point) => ({ year: point.year, ...totals(point.pairs, filters.minVotes) })),
    divisiveResolutions: divisiveResolutions.slice(0, 8),
    dataVersion: store.metadata.version,
    themeClassificationVersion: THEME_CLASSIFICATION_VERSION,
    methodVersion: GROUP_METHOD_VERSION,
  };
}
