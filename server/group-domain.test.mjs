import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './domain.mjs';
import {
  analyzeGroup,
  suggestGroupMembers,
  validateAnalysisRequest,
  validateGroupDraft,
} from './group-domain.mjs';
import { groupDataset, groupFilters, testGroup } from './fixtures/group-dataset.mjs';

test('groupes : cohésion pondérée par effectifs, distincte de la moyenne des taux', () => {
  const result = analyzeGroup(createStore(groupDataset()), testGroup(), groupFilters);
  assert.equal(result.totalPairCount, 3);
  assert.equal(result.eligiblePairCount, 3);
  assert.equal(result.commonPairVotes, 7);
  assert.equal(result.matchingPairVotes, 4);
  assert.equal(result.cohesionPercent, (100 * 4) / 7);
  const mean = result.pairs.reduce((sum, pair) => sum + pair.agreementPercent, 0) / 3;
  assert.notEqual(result.cohesionPercent, mean);
  assert.equal(result.observedResolutionCount, 6);
  assert.deepEqual(result.coverage, { from: '2020-01-01', to: '2022-06-01' });
  assert.equal(result.groupRevision, 1);
  assert.ok(result.methodVersion);
  assert.ok(result.themeClassificationVersion);
});

test('groupes : seuil par paire et par année, sans transformer une année vide en 0 %', () => {
  const store = createStore(groupDataset());
  const result = analyzeGroup(store, testGroup(), groupFilters);
  assert.deepEqual(
    result.trend.map((point) => point.eligiblePairCount),
    [1, 0, 0],
  );
  assert.deepEqual(
    result.trend.map((point) => point.cohesionPercent),
    [100, null, null],
  );
  const threshold = analyzeGroup(store, testGroup(), { ...groupFilters, minVotes: 3 });
  assert.equal(threshold.eligiblePairCount, 1);
  assert.equal(threshold.commonPairVotes, 3);
  assert.equal(threshold.cohesionPercent, 100);
  assert.equal(threshold.pairs.filter((pair) => pair.agreementPercent === null).length, 2);
  assert.deepEqual(threshold.coverage, { from: '2020-01-01', to: '2021-01-01' });
  const zero = analyzeGroup(store, testGroup(), { ...groupFilters, minVotes: 1 });
  assert.equal(zero.trend[2].cohesionPercent, 0);
});

test('groupes : aucune paire éligible donne null, avec effectifs observés disponibles', () => {
  const result = analyzeGroup(createStore(groupDataset()), testGroup(), {
    ...groupFilters,
    minVotes: 99,
  });
  assert.equal(result.cohesionPercent, null);
  assert.equal(result.commonPairVotes, 0);
  assert.equal(result.matchingPairVotes, 0);
  assert.equal(result.observedResolutionCount, 6);
  assert.deepEqual(result.coverage, { from: null, to: null });
  assert.ok(result.pairs.some((pair) => pair.commonVoteCount > 0));
});

test('groupes : filtres thématiques et dates inclusives restent sourcés', () => {
  const result = analyzeGroup(createStore(groupDataset()), testGroup(), {
    from: 2020,
    to: 2020,
    theme: 'environment',
    minVotes: 1,
  });
  assert.equal(result.observedResolutionCount, 1);
  assert.equal(result.commonPairVotes, 3);
  assert.equal(result.matchingPairVotes, 1);
  assert.equal(result.cohesionPercent, (100 * 1) / 3);
  assert.deepEqual(result.coverage, { from: '2020-01-01', to: '2020-01-01' });
});

test('groupes : résolutions divisives calculées par paires, absences et lignes manquantes distinctes', () => {
  const dataset = groupDataset();
  dataset.resolutions[3].votes.find(([index]) => index === 2)[1] = 'N';
  const result = analyzeGroup(createStore(dataset), testGroup(), { ...groupFilters, minVotes: 1 });
  const threeVotes = result.divisiveResolutions.find((row) => row.resolution.id === '1');
  assert.equal(threeVotes.participatingCount, 3);
  assert.equal(threeVotes.memberCount, 3);
  assert.equal(threeVotes.comparablePairVotes, 3);
  assert.equal(threeVotes.matchingPairVotes, 1);
  assert.equal(threeVotes.agreementPercent, (100 * 1) / 3);
  const missing = result.divisiveResolutions.find((row) => row.resolution.id === '6');
  assert.equal(missing.participatingCount, 2);
  assert.equal(missing.votes.find((vote) => vote.countryId === 'IND').choice, 'UNKNOWN');
  const absent = result.divisiveResolutions.find((row) => row.resolution.id === '4');
  assert.equal(absent.votes.find((vote) => vote.countryId === 'FRA').choice, 'NOT_VOTED');
  assert.ok(result.divisiveResolutions.every((row) => row.agreementPercent < 100));
});

test('groupes : aperçu avec membres alternatifs ne modifie pas la définition passée', () => {
  const group = testGroup();
  const result = analyzeGroup(createStore(groupDataset()), group, groupFilters, [
    'FRA',
    'IND',
    'CAN',
  ]);
  assert.deepEqual(group.memberIds, ['FRA', 'IND', 'BRA']);
  assert.deepEqual(result.memberIds, ['FRA', 'IND', 'CAN']);
  assert.equal(result.cohesionPercent, 100);
});

test('suggestions : éligibilité contre chaque membre et cohésion après ajout avec toutes les paires', () => {
  const store = createStore(groupDataset());
  const group = testGroup(['FRA', 'IND']);
  const result = suggestGroupMembers(store, group, groupFilters);
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
  const result = suggestGroupMembers(createStore(groupDataset()), testGroup(['FRA', 'IND']), {
    ...groupFilters,
    minVotes: 3,
  });
  assert.ok(!result.suggestions.some((entry) => entry.country.id === 'BRA'));
  assert.equal(result.eligibleCandidateCount, 3);
});

test('suggestions : une cohésion initiale indéfinie garde un delta null', () => {
  const result = suggestGroupMembers(createStore(groupDataset()), testGroup(['FRA', 'IND']), {
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
  const group = testGroup(['FRA', 'IND']);
  const current = suggestGroupMembers(store, group, groupFilters);
  assert.ok(!current.suggestions.some((entry) => entry.country.id === 'CAN'));
  assert.equal(current.eligibleCandidateCount, 3);
  const history = suggestGroupMembers(store, group, groupFilters, true);
  assert.equal(history.suggestions[0].country.id, 'CAN');
  assert.equal(history.includeHistorical, true);
  const older = suggestGroupMembers(store, group, { ...groupFilters, to: 2021 });
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
  const result = suggestGroupMembers(createStore(dataset), testGroup(['FRA', 'IND']), {
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
    suggestGroupMembers(store, testGroup(['FRA', 'IND']), { ...groupFilters, to: 2100 }).suggestions
      .length > 0,
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
  const fullGroup = testGroup(dataset.countries.slice(0, 12).map((country) => country.id));
  const result = suggestGroupMembers(createStore(dataset), fullGroup, groupFilters);
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.eligibleCandidateCount, 0);
  assert.equal(result.excludedCandidateCount, 3);
});

test('groupes : validation bornée, doublons, codes inconnus et filtres complets', () => {
  const store = createStore(groupDataset());
  const valid = { name: '  Groupe  ', description: '', memberIds: ['FRA', 'IND'] };
  assert.equal(validateGroupDraft(store, valid).name, 'Groupe');
  for (const input of [
    null,
    [],
    { ...valid, name: 'x' },
    { ...valid, name: 'x'.repeat(81) },
    { ...valid, description: 'x'.repeat(501) },
    { ...valid, memberIds: ['FRA'] },
    { ...valid, memberIds: ['FRA', 'FRA'] },
    { ...valid, memberIds: ['FRA', 'NON'] },
    { ...valid, unknown: true },
  ])
    assert.throws(() => validateGroupDraft(store, input), { status: 400 });
  const request = { ...groupFilters, expectedRevision: 1 };
  assert.deepEqual(validateAnalysisRequest(store, request).filters, groupFilters);
  assert.throws(() => validateAnalysisRequest(store, { ...request, expectedRevision: undefined }), {
    status: 400,
  });
  assert.throws(() => validateAnalysisRequest(store, { ...request, from: 1945 }), { status: 400 });
  assert.throws(() => validateAnalysisRequest(store, { ...request, from: 2024, to: 2020 }), {
    status: 400,
  });
  assert.throws(() => validateAnalysisRequest(store, { ...request, theme: 'not-a-theme' }), {
    status: 400,
  });
  assert.throws(() => validateAnalysisRequest(store, { ...request, memberIds: ['FRA', 'CAN'] }), {
    status: 400,
  });
  assert.deepEqual(
    validateAnalysisRequest(store, { ...request, memberIds: ['FRA', 'CAN'] }, true).memberIds,
    ['FRA', 'CAN'],
  );
  assert.throws(
    () => validateAnalysisRequest(store, { ...request, includeHistorical: 'true' }, false, true),
    { status: 400 },
  );
});
