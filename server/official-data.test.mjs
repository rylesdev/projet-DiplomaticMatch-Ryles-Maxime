import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareCountries, createStore } from './domain.mjs';

// Jeu réel version 6, conservé dans le dépôt pour une démo indépendante du réseau.
// La référence FRA/IND a été calculée séparément sur les CSV bruts avant l'import.
const dataset = JSON.parse(
  await readFile(new URL('../data/dataset.json', import.meta.url), 'utf8'),
);
const store = createStore(dataset);

test('le jeu importé conserve toutes les lignes officielles et la couverture effective', () => {
  assert.equal(dataset.countries.length, 202);
  assert.equal(dataset.resolutions.length, 20834);
  assert.equal(
    dataset.resolutions.reduce((count, resolution) => count + resolution.votes.length, 0),
    954382,
  );
  assert.deepEqual(dataset.metadata.coverage, { from: '1946-01-26', to: '2026-09-17' });
  assert.equal(dataset.metadata.status, 'official');
});
test('les codes d’entités historiques ne sont pas fusionnés aux États actuels', () => {
  for (const [former, current] of [
    ['SUN', 'RUS'],
    ['GER', 'DEU'],
    ['DDR', 'DEU'],
    ['CSK', 'CZE'],
    ['YUG', 'SRB'],
    ['SCG', 'SRB'],
    ['YMD', 'YEM'],
  ]) {
    assert.ok(store.countries.has(former));
    assert.ok(store.countries.has(current));
    assert.notEqual(store.countries.get(former).nameEn, store.countries.get(current).nameEn);
  }
});
test('France / Inde 2000–2025 correspond au décompte indépendant du CSV source', () => {
  const result = compareCountries(store, 'FRA', 'IND', 2000, 2025);
  assert.equal(result.commonVoteCount, 2218);
  assert.equal(result.matchingVoteCount, 1005);
  assert.equal(result.differingVoteCount, 1213);
  assert.equal(result.nonComparableCount, 14);
  assert.equal(result.agreementPercent, (100 * 1005) / 2218);
  assert.deepEqual(result.coverage, { from: '2000-06-15', to: '2025-12-18' });
});
