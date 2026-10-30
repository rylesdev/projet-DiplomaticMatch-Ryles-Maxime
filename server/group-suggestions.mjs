import { compareMatrix, EXPLICIT_CHOICES, inScope } from './domain.mjs';
import {
  analyzeGroup,
  coverageUnion,
  GROUP_METHOD_VERSION,
  MAX_GROUP_MEMBERS,
} from './group-domain.mjs';

// Candidats à ajouter : chacun doit atteindre le seuil avec chaque membre ; tri par concordance
// avec les membres, puis effet sur la concordance interne du groupe.
export function suggestGroupMembers(store, memberIds, filters, includeHistorical = false) {
  const outside = Array.from(store.countries.values()).filter(
    (country) => !memberIds.includes(country.id),
  );
  const response = {
    filters: { ...filters },
    includeHistorical,
    suggestions: [],
    eligibleCandidateCount: 0,
    excludedCandidateCount: outside.length,
    dataVersion: store.metadata.version,
    methodVersion: GROUP_METHOD_VERSION,
  };
  if (memberIds.length >= MAX_GROUP_MEMBERS) return response;
  const matrix = compareMatrix(store, filters.from, filters.to, filters.minVotes, filters.theme);
  const indexes = new Map(matrix.countries.map((country, index) => [country.id, index]));
  const memberIndexes = memberIds.map((id) => indexes.get(id));
  const base = analyzeGroup(store, memberIds, filters);
  const candidates = [];
  const lastRequiredYear = Math.min(filters.to, Number(store.metadata.coverage.to.slice(0, 4)));
  for (const country of outside) {
    if (!includeHistorical && country.lastYear < lastRequiredYear) continue;
    const index = indexes.get(country.id);
    if (memberIndexes.some((member) => matrix.commonVoteCounts[index][member] < filters.minVotes))
      continue;
    const commonPairVotes = memberIndexes.reduce(
      (sum, member) => sum + matrix.commonVoteCounts[index][member],
      0,
    );
    const matchingPairVotes = memberIndexes.reduce(
      (sum, member) => sum + matrix.matchingVoteCounts[index][member],
      0,
    );
    const cohesionAfterPercent =
      (100 * (base.matchingPairVotes + matchingPairVotes)) /
      (base.commonPairVotes + commonPairVotes);
    candidates.push({
      country,
      commonPairVotes,
      matchingPairVotes,
      concordancePercent: (100 * matchingPairVotes) / commonPairVotes,
      cohesionAfterPercent,
      deltaPoints:
        base.cohesionPercent === null ? null : cohesionAfterPercent - base.cohesionPercent,
      eligiblePairCount: memberIds.length,
      coverage: { from: null, to: null },
    });
  }
  const names = new Intl.Collator('fr');
  candidates.sort(
    (a, b) =>
      b.matchingPairVotes * a.commonPairVotes - a.matchingPairVotes * b.commonPairVotes ||
      b.commonPairVotes - a.commonPairVotes ||
      names.compare(a.country.name, b.country.name) ||
      a.country.id.localeCompare(b.country.id, 'en'),
  );
  const suggestions = candidates.slice(0, 3);
  // Le cache matrice donne les effectifs ; une seule passe sourcée donne la couverture des 3 retenus.
  for (const resolution of store.orderedResolutions) {
    if (
      !inScope(resolution, filters.from, filters.to, filters.theme) ||
      !memberIds.some((id) => EXPLICIT_CHOICES.has(resolution.voteMap.get(id)?.choice))
    )
      continue;
    for (const suggestion of suggestions)
      if (EXPLICIT_CHOICES.has(resolution.voteMap.get(suggestion.country.id)?.choice)) {
        coverageUnion(suggestion.coverage, { from: resolution.date, to: resolution.date });
      }
  }
  return {
    ...response,
    suggestions,
    eligibleCandidateCount: candidates.length,
    excludedCandidateCount: outside.length - candidates.length,
  };
}
