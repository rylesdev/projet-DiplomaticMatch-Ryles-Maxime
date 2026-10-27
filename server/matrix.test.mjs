import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCountries,
  compareMatrix,
  compareTrend,
  createStore,
  rankCountries,
} from './domain.mjs';
import { syntheticDataset } from './fixtures/synthetic-dataset.mjs';

// Les votes et sujets de ce jeu sont inventés pour les tests ; ils ne sont jamais servis en production.
function themedDataset() {
  const dataset = syntheticDataset();
  dataset.countries.push(
    {
      id: 'USA',
      name: 'États-Unis',
      nameEn: 'UNITED STATES',
      voteCount: 0,
      firstYear: 2020,
      lastYear: 2024,
    },
    {
      id: 'AAB',
      name: 'Alphabétique',
      nameEn: 'TEST B',
      voteCount: 0,
      firstYear: 2020,
      lastYear: 2024,
    },
    {
      id: 'AAA',
      name: 'Alphabétique',
      nameEn: 'TEST A',
      voteCount: 0,
      firstYear: 2020,
      lastYear: 2024,
    },
  );
  const subjects = [
    ['ENVIRONMENT'],
    ['DISARMAMENT'],
    ['ENVIRONMENT--SUSTAINABLE DEVELOPMENT'],
    [],
    ['HUMAN RIGHTS'],
    ['UN. GENERAL ASSEMBLY'],
  ];
  for (const [index, resolution] of dataset.resolutions.entries())
    resolution.subjects = subjects[index];
  dataset.resolutions[3].title = 'Environment, security and human rights : titre fictif sans sujet';
  dataset.resolutions.push({
    id: '7',
    symbol: 'TEST/7',
    title: 'Résolution fictive sans vote enregistré',
    date: '2021-06-01',
    sourceUrl: 'https://example.test/fixture',
    subjects: ['ENVIRONMENT'],
    votes: [],
  });
  return dataset;
}

function positions(matrix) {
  return Object.fromEntries(matrix.countries.map((country, index) => [country.id, index]));
}

test('thèmes : comptages sur les sujets sources, multi-attribution et résolutions sans vote', () => {
  const store = createStore(themedDataset());
  const themes = Object.fromEntries(store.themes.map((theme) => [theme.id, theme]));
  assert.equal(themes.all.resolutionCount, 7);
  assert.equal(themes.all.recordedVoteResolutionCount, 6);
  assert.equal(themes.environment.resolutionCount, 3);
  assert.equal(themes.environment.recordedVoteResolutionCount, 2);
  assert.equal(themes.development.resolutionCount, 1);
  assert.equal(themes.unclassified.resolutionCount, 1);
  assert.deepEqual(store.resolutions.get('3').themeIds, ['environment', 'development']);
  assert.deepEqual(store.resolutions.get('4').themeIds, ['unclassified']);
});

test('thèmes : comparaison, classement et tendance filtrent exactement le même univers', () => {
  const store = createStore(themedDataset());
  const comparison = compareCountries(store, 'FRA', 'IND', 2020, 2024, 'environment');
  assert.equal(comparison.theme, 'environment');
  assert.equal(comparison.commonVoteCount, 2);
  assert.equal(comparison.matchingVoteCount, 2);
  assert.equal(comparison.agreementPercent, 100);
  assert.deepEqual(comparison.coverage, { from: '2020-01-01', to: '2021-05-01' });
  const ranking = rankCountries(store, 'FRA', 2020, 2024, 1, 'environment');
  assert.equal(ranking.theme, 'environment');
  assert.equal(ranking.closest[0].country.id, 'IND');
  assert.equal(ranking.closest[0].commonVoteCount, 2);
  assert.equal(ranking.closest[0].agreementPercent, 100);
  const trend = compareTrend(store, 'FRA', 'IND', 2020, 2024, 'year', 'environment');
  assert.equal(trend.theme, 'environment');
  assert.deepEqual(
    trend.points.map((point) => point.commonVoteCount),
    [1, 1, 0, 0, 0],
  );
  assert.deepEqual(
    trend.points.map((point) => point.agreementPercent),
    [100, 100, null, null, null],
  );
  assert.equal(compareCountries(store, 'FRA', 'IND', 2020, 2024, 'security').agreementPercent, 0);
  assert.equal(
    compareCountries(store, 'FRA', 'IND', 2020, 2024, 'unclassified').agreementPercent,
    null,
  );
});

test('matrice : tous les pays sont conservés et triés par nom français puis identifiant', () => {
  const matrix = compareMatrix(createStore(themedDataset()), 2020, 2024, 1);
  assert.deepEqual(
    matrix.countries.map((country) => country.id),
    ['AAA', 'AAB', 'USA', 'FRA', 'IND'],
  );
  assert.equal(matrix.theme, 'all');
  assert.equal(matrix.minVotes, 1);
  assert.equal(matrix.dataVersion, 'test');
  for (const key of ['agreementPercents', 'commonVoteCounts', 'matchingVoteCounts']) {
    assert.equal(matrix[key].length, 5);
    assert.ok(matrix[key].every((row) => row.length === 5));
  }
});

test('matrice : toutes les cases sont symétriques, avec diagonale et formule exacte', () => {
  const store = createStore(themedDataset());
  const matrix = compareMatrix(store, 2020, 2024, 1);
  const index = positions(matrix);
  for (let a = 0; a < matrix.countries.length; a++) {
    for (let b = 0; b < matrix.countries.length; b++) {
      const pair = compareCountries(
        store,
        matrix.countries[a].id,
        matrix.countries[b].id,
        2020,
        2024,
      );
      assert.equal(matrix.commonVoteCounts[a][b], pair.commonVoteCount);
      assert.equal(matrix.matchingVoteCounts[a][b], pair.matchingVoteCount);
      assert.equal(matrix.agreementPercents[a][b], pair.agreementPercent);
      assert.equal(matrix.commonVoteCounts[a][b], matrix.commonVoteCounts[b][a]);
      assert.equal(matrix.matchingVoteCounts[a][b], matrix.matchingVoteCounts[b][a]);
      assert.equal(matrix.agreementPercents[a][b], matrix.agreementPercents[b][a]);
    }
  }
  assert.equal(matrix.agreementPercents[index.FRA][index.FRA], 100);
  assert.equal(matrix.commonVoteCounts[index.FRA][index.FRA], 4);
  assert.equal(matrix.agreementPercents[index.USA][index.USA], null);
  assert.equal(matrix.commonVoteCounts[index.USA][index.USA], 0);
});

test('matrice : seuil inclusif, absence et vrai zéro restent distincts', () => {
  const store = createStore(themedDataset());
  const security = compareMatrix(store, 2020, 2024, 1, 'security');
  const index = positions(security);
  assert.equal(security.commonVoteCounts[index.FRA][index.IND], 1);
  assert.equal(security.matchingVoteCounts[index.FRA][index.IND], 0);
  assert.equal(security.agreementPercents[index.FRA][index.IND], 0);
  const belowThreshold = compareMatrix(store, 2020, 2024, 2, 'security');
  assert.equal(belowThreshold.commonVoteCounts[index.FRA][index.IND], 1);
  assert.equal(belowThreshold.matchingVoteCounts[index.FRA][index.IND], 0);
  assert.equal(belowThreshold.agreementPercents[index.FRA][index.IND], null);
  assert.equal(belowThreshold.agreementPercents[index.FRA][index.FRA], null);
  const noVote = compareMatrix(store, 2020, 2024, 1, 'rights');
  assert.equal(noVote.commonVoteCounts[index.FRA][index.IND], 0);
  assert.equal(noVote.agreementPercents[index.FRA][index.IND], null);
});

test('matrice : les dates de début et de fin et le thème restreignent les mêmes résolutions', () => {
  const store = createStore(themedDataset());
  for (const [from, to, theme, expectedCount, expectedPercentage] of [
    [2020, 2020, 'all', 2, 50],
    [2020, 2020, 'environment', 1, 100],
    [2021, 2021, 'environment', 1, 100],
    [2020, 2024, 'environment', 2, 100],
    [2019, 2019, 'all', 0, null],
  ]) {
    const matrix = compareMatrix(store, from, to, 1, theme);
    const index = positions(matrix);
    assert.equal(matrix.commonVoteCounts[index.FRA][index.IND], expectedCount);
    assert.equal(matrix.agreementPercents[index.FRA][index.IND], expectedPercentage);
  }
});

test('matrice : cache isolé par période, thème et store ; seuil réappliqué à chaque réponse', () => {
  const store = createStore(themedDataset());
  const first = compareMatrix(store, 2020, 2024, 1, 'environment');
  const index = positions(first);
  const highThreshold = compareMatrix(store, 2020, 2024, 3, 'environment');
  assert.equal(highThreshold.agreementPercents[index.FRA][index.IND], null);
  assert.equal(highThreshold.commonVoteCounts[index.FRA][index.IND], 2);
  assert.equal(first.agreementPercents[index.FRA][index.IND], 100);
  first.commonVoteCounts[index.FRA][index.IND] = 999;
  const again = compareMatrix(store, 2020, 2024, 1, 'environment');
  assert.equal(again.commonVoteCounts[index.FRA][index.IND], 2);
  const otherDataset = themedDataset();
  otherDataset.resolutions[0].votes[0][1] = 'N';
  const other = compareMatrix(createStore(otherDataset), 2020, 2024, 1, 'environment');
  assert.equal(other.agreementPercents[index.FRA][index.IND], 50);
  // Après plus de six combinaisons, une ancienne entrée peut être recalculée correctement.
  for (let year = 2010; year < 2018; year++) compareMatrix(store, year, year, 1, 'all');
  assert.equal(
    compareMatrix(store, 2020, 2024, 1, 'environment').agreementPercents[index.FRA][index.IND],
    100,
  );
});

test('thèmes et matrice : un changement d’ordre source des pays ne change pas les paires', () => {
  const dataset = themedDataset();
  dataset.resolutions[1].votes.reverse();
  dataset.resolutions[2].votes.reverse();
  const matrix = compareMatrix(createStore(dataset), 2020, 2024, 1);
  const index = positions(matrix);
  assert.equal(matrix.commonVoteCounts[index.FRA][index.IND], 3);
  assert.equal(matrix.matchingVoteCounts[index.FRA][index.IND], 2);
  assert.equal(matrix.agreementPercents[index.FRA][index.IND], (100 * 2) / 3);
});
