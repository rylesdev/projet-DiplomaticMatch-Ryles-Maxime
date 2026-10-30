import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './domain.mjs';
import { analyzeGroup, validateMemberIds } from './group-domain.mjs';
import { groupDataset, groupFilters } from './fixtures/group-dataset.mjs';

// Membres fictifs utilisés par les calculs : le calcul ne dépend que de cette liste.
const members = ['FRA', 'IND', 'BRA'];

test('groupes : cohésion pondérée par effectifs, distincte de la moyenne des taux', () => {
  const result = analyzeGroup(createStore(groupDataset()), members, groupFilters);
  assert.equal(result.totalPairCount, 3);
  assert.equal(result.eligiblePairCount, 3);
  assert.equal(result.commonPairVotes, 7);
  assert.equal(result.matchingPairVotes, 4);
  assert.equal(result.cohesionPercent, (100 * 4) / 7);
  const mean = result.pairs.reduce((sum, pair) => sum + pair.agreementPercent, 0) / 3;
  assert.notEqual(result.cohesionPercent, mean);
  assert.equal(result.observedResolutionCount, 6);
  assert.deepEqual(result.coverage, { from: '2020-01-01', to: '2022-06-01' });
  assert.equal(result.groupId, undefined);
  assert.ok(result.methodVersion);
  assert.ok(result.themeClassificationVersion);
});

test('groupes : seuil par paire et par année, sans transformer une année vide en 0 %', () => {
  const store = createStore(groupDataset());
  const result = analyzeGroup(store, members, groupFilters);
  assert.deepEqual(
    result.trend.map((point) => point.eligiblePairCount),
    [1, 0, 0],
  );
  assert.deepEqual(
    result.trend.map((point) => point.cohesionPercent),
    [100, null, null],
  );
  const threshold = analyzeGroup(store, members, { ...groupFilters, minVotes: 3 });
  assert.equal(threshold.eligiblePairCount, 1);
  assert.equal(threshold.commonPairVotes, 3);
  assert.equal(threshold.cohesionPercent, 100);
  assert.equal(threshold.pairs.filter((pair) => pair.agreementPercent === null).length, 2);
  assert.deepEqual(threshold.coverage, { from: '2020-01-01', to: '2021-01-01' });
  const zero = analyzeGroup(store, members, { ...groupFilters, minVotes: 1 });
  assert.equal(zero.trend[2].cohesionPercent, 0);
});

test('groupes : aucune paire éligible donne null, avec effectifs observés disponibles', () => {
  const result = analyzeGroup(createStore(groupDataset()), members, {
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
  const result = analyzeGroup(createStore(groupDataset()), members, {
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
  const result = analyzeGroup(createStore(dataset), members, { ...groupFilters, minVotes: 1 });
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

test('groupes : le calcul porte sur la liste de membres reçue, comme pour un scénario', () => {
  const scenario = ['FRA', 'IND', 'CAN'];
  const result = analyzeGroup(createStore(groupDataset()), scenario, groupFilters);
  assert.deepEqual(scenario, ['FRA', 'IND', 'CAN']);
  assert.deepEqual(result.memberIds, ['FRA', 'IND', 'CAN']);
  assert.equal(result.cohesionPercent, 100);
});

test('groupes : 2 à 12 membres distincts, tous présents dans le jeu de données', () => {
  const store = createStore(groupDataset());
  assert.deepEqual(validateMemberIds(store, ['FRA', 'IND']), ['FRA', 'IND']);
  for (const memberIds of [
    null,
    [],
    ['FRA'],
    ['FRA', 'FRA'],
    ['FRA', 'NON'],
    Array(13).fill('FRA'),
  ])
    assert.throws(() => validateMemberIds(store, memberIds), { status: 400 });
});
