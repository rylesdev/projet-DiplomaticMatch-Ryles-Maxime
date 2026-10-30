import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from './api.mjs';
import { createStore } from './domain.mjs';
import { suggestGroupMembers } from './group-suggestions.mjs';
import { groupDataset, groupFilters } from './fixtures/group-dataset.mjs';

test('suggestions : éligibilité contre chaque membre et cohésion après ajout avec toutes les paires', () => {
  const store = createStore(groupDataset());
  const memberIds = ['FRA', 'IND'];
  const result = suggestGroupMembers(store, memberIds, groupFilters);
  assert.equal(result.includeHistorical, false);
  assert.equal(result.eligibleCandidateCount, 4);
  assert.equal(result.excludedCandidateCount, 1);
  assert.deepEqual(
    result.suggestions.map((entry) => entry.country.id),
    ['CAN', 'BEL', 'USA'],
  );
  const belgium = result.suggestions[1];
  assert.equal(belgium.commonPairVotes, 8);
  assert.equal(belgium.matchingPairVotes, 6);
  assert.equal(belgium.concordancePercent, 75);
  assert.equal(belgium.cohesionAfterPercent, (100 * 9) / 11);
  assert.equal(belgium.deltaPoints, (100 * 9) / 11 - 100);
  assert.equal(belgium.eligiblePairCount, 2);
  assert.deepEqual(belgium.coverage, { from: '2020-01-01', to: '2022-06-01' });
});

test('suggestions : atteindre le seuil contre un seul membre ne suffit pas', () => {
  const result = suggestGroupMembers(createStore(groupDataset()), ['FRA', 'IND'], {
    ...groupFilters,
    minVotes: 3,
  });
  assert.ok(!result.suggestions.some((entry) => entry.country.id === 'BRA'));
  assert.equal(result.eligibleCandidateCount, 3);
});

test('suggestions : une cohésion initiale indéfinie garde un delta null', () => {
  const result = suggestGroupMembers(createStore(groupDataset()), ['FRA', 'IND'], {
    ...groupFilters,
    minVotes: 4,
  });
  assert.equal(result.suggestions[0].country.id, 'CAN');
  assert.equal(result.suggestions[0].concordancePercent, 100);
  assert.equal(result.suggestions[0].cohesionAfterPercent, 100);
  assert.equal(result.suggestions[0].deltaPoints, null);
});

test('suggestions : dernière année observée contrôlée, option historique et période ancienne', () => {
  const dataset = groupDataset();
  dataset.countries.find((country) => country.id === 'CAN').lastYear = 2021;
  const store = createStore(dataset);
  const memberIds = ['FRA', 'IND'];
  const current = suggestGroupMembers(store, memberIds, groupFilters);
  assert.ok(!current.suggestions.some((entry) => entry.country.id === 'CAN'));
  assert.equal(current.eligibleCandidateCount, 3);
  const history = suggestGroupMembers(store, memberIds, groupFilters, true);
  assert.equal(history.suggestions[0].country.id, 'CAN');
  assert.equal(history.includeHistorical, true);
  const older = suggestGroupMembers(store, memberIds, { ...groupFilters, to: 2021 });
  assert.equal(older.suggestions[0].country.id, 'CAN');
});

test('suggestions : une entité ancienne reste admissible pour une période qu’elle couvre', () => {
  const dataset = groupDataset();
  dataset.countries.push({
    id: 'SUN',
    name: 'Union soviétique (test)',
    nameEn: 'TEST USSR',
    voteCount: 1,
    firstYear: 1946,
    lastYear: 1991,
  });
  dataset.resolutions.push({
    id: 'old',
    symbol: 'TEST/OLD',
    title: 'Fixture ancienne',
    date: '1980-12-31',
    sourceUrl: 'https://example.test/fixture',
    subjects: [],
    votes: [
      [0, 'Y'],
      [1, 'Y'],
      [7, 'Y'],
    ],
  });
  const result = suggestGroupMembers(createStore(dataset), ['FRA', 'IND'], {
    from: 1980,
    to: 1980,
    theme: 'all',
    minVotes: 1,
  });
  assert.equal(result.includeHistorical, false);
  assert.equal(result.suggestions[0].country.id, 'SUN');
});

test('suggestions : période future bornée par la couverture source et groupe de douze déjà complet', () => {
  const store = createStore(groupDataset());
  assert.ok(
    suggestGroupMembers(store, ['FRA', 'IND'], { ...groupFilters, to: 2100 }).suggestions.length >
      0,
  );
  const dataset = groupDataset();
  for (let index = 0; index < 8; index++)
    dataset.countries.push({
      id: `T${index}`,
      name: `Test ${index}`,
      nameEn: `Test ${index}`,
      voteCount: 0,
      firstYear: 2020,
      lastYear: 2024,
    });
  const fullGroup = dataset.countries.slice(0, 12).map((country) => country.id);
  const result = suggestGroupMembers(createStore(dataset), fullGroup, groupFilters);
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.eligibleCandidateCount, 0);
  assert.equal(result.excludedCandidateCount, 3);
});

test('GET /api/groups/suggestions : même calcul, option historique explicite', () => {
  const store = createStore(groupDataset());
  const request = (url) => handleApi(store, { url, method: 'GET' });
  const query = 'members=FRA,IND&from=2020&to=2022&minVotes=2';
  assert.deepEqual(
    request(`/api/groups/suggestions?${query}`),
    suggestGroupMembers(store, ['FRA', 'IND'], groupFilters),
  );
  assert.equal(
    request(`/api/groups/suggestions?${query}&includeHistorical=true`).includeHistorical,
    true,
  );
  assert.throws(() => request(`/api/groups/suggestions?${query}&includeHistorical=oui`), {
    status: 400,
  });
  assert.throws(() => request('/api/groups/suggestions?members=FRA'), { status: 400 });
});
