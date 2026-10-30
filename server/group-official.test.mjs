import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStore } from './domain.mjs';
import { analyzeGroup } from './group-domain.mjs';
import { suggestGroupMembers } from './group-suggestions.mjs';

// Référence calculée indépendamment depuis les tableaux bruts du jeu officiel, sans group-domain.
const store = createStore(
  JSON.parse(await readFile(new URL('../data/dataset.json', import.meta.url), 'utf8')),
);
const group = {
  id: 'official-test',
  name: 'Référence de test',
  description: '',
  memberIds: ['FRA', 'IND', 'BRA', 'CAN'],
  revision: 1,
  createdAt: '2026-10-28T00:00:00.000Z',
  updatedAt: '2026-10-28T00:00:00.000Z',
};
const filters = { from: 2000, to: 2025, theme: 'all', minVotes: 20 };

test('groupe officiel : cohésion pondérée, tendance annuelle et résolutions divisives vérifiées indépendamment', () => {
  const analysis = analyzeGroup(store, group.memberIds, filters);
  assert.equal(analysis.totalPairCount, 6);
  assert.equal(analysis.eligiblePairCount, 6);
  assert.equal(analysis.commonPairVotes, 13304);
  assert.equal(analysis.matchingPairVotes, 7329);
  assert.equal(analysis.cohesionPercent, (100 * 7329) / 13304);
  assert.equal(analysis.observedResolutionCount, 2232);
  const firstYear = analysis.trend.find((point) => point.year === 2000);
  assert.equal(firstYear.commonPairVotes, 408);
  assert.equal(firstYear.matchingPairVotes, 250);
  const lastYear = analysis.trend.find((point) => point.year === 2025);
  assert.equal(lastYear.commonPairVotes, 1152);
  assert.equal(lastYear.matchingPairVotes, 865);
  assert.deepEqual(
    analysis.divisiveResolutions.slice(0, 3).map((row) => row.resolution.id),
    ['4096557', '4096568', '4095651'],
  );
  assert.equal(analysis.divisiveResolutions[0].comparablePairVotes, 6);
  assert.equal(analysis.divisiveResolutions[0].matchingPairVotes, 1);
});

test('groupe officiel : scénarios de retrait et d’ajout sont calculés sans modifier le groupe', () => {
  const removed = analyzeGroup(store, ['FRA', 'BRA', 'CAN'], filters);
  assert.equal(removed.commonPairVotes, 6650);
  assert.equal(removed.matchingPairVotes, 3761);
  const added = analyzeGroup(store, [...group.memberIds, 'BEL'], filters);
  assert.equal(added.commonPairVotes, 22161);
  assert.equal(added.matchingPairVotes, 13435);
  assert.deepEqual(group.memberIds, ['FRA', 'IND', 'BRA', 'CAN']);
});

test('suggestions officielles : cohorte jusqu’à fin de période, pondération et effet de l’ajout', () => {
  const suggestions = suggestGroupMembers(store, group.memberIds, filters);
  assert.equal(suggestions.includeHistorical, false);
  assert.equal(suggestions.eligibleCandidateCount, 189);
  assert.equal(suggestions.excludedCandidateCount, 9);
  assert.deepEqual(
    suggestions.suggestions.map((entry) => entry.country.id),
    ['SYC', 'MCO', 'MLT'],
  );
  const expected = [
    [4613, 3214],
    [8543, 5935],
    [8863, 6128],
  ];
  for (const [index, [common, matches]] of expected.entries()) {
    const candidate = suggestions.suggestions[index];
    assert.equal(candidate.commonPairVotes, common);
    assert.equal(candidate.matchingPairVotes, matches);
    assert.equal(candidate.concordancePercent, (100 * matches) / common);
    assert.equal(candidate.cohesionAfterPercent, (100 * (7329 + matches)) / (13304 + common));
    const preview = analyzeGroup(store, [...group.memberIds, candidate.country.id], filters);
    assert.equal(candidate.cohesionAfterPercent, preview.cohesionPercent);
    assert.deepEqual(candidate.coverage, {
      from: index === 0 ? '2001-11-27' : '2000-06-15',
      to: '2025-12-18',
    });
  }
});

test('suggestions officielles : option explicite pour les codes source sans couverture récente', () => {
  const result = suggestGroupMembers(store, group.memberIds, filters, true);
  assert.equal(result.includeHistorical, true);
  assert.equal(result.eligibleCandidateCount, 191);
  assert.equal(result.excludedCandidateCount, 7);
  assert.deepEqual(
    result.suggestions.map((entry) => entry.country.id),
    ['YUG', 'SCG', 'SYC'],
  );
  assert.equal(result.suggestions[0].commonPairVotes, 697);
  assert.equal(result.suggestions[0].matchingPairVotes, 527);
  assert.ok(result.suggestions[0].coverage.to < '2003-01-01');
});
