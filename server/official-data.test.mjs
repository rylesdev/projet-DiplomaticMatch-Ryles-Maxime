import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compareCountries,
  compareMatrix,
  compareTrend,
  countryProfile,
  createStore,
  rankCountries,
} from './domain.mjs';
import { FRENCH_NAMES } from './country-names.mjs';

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
test('chacun des 202 codes reçoit un nom français, sans perdre la recherche en anglais', () => {
  const missing = dataset.countries.filter((country) => !FRENCH_NAMES[country.id]);
  assert.deepEqual(missing, []);
  assert.equal(Object.keys(FRENCH_NAMES).length, 202);
  assert.equal(store.countries.get('NRU').name, 'Nauru');
  assert.equal(store.countries.get('SUN').name, 'Union soviétique (historique)');
  assert.equal(store.countries.get('EAZ').name, 'Zanzibar (historique)');
  // Les noms source restent conservés pour la recherche et la traçabilité.
  assert.equal(store.countries.get('NRU').nameEn, 'NAOERO');
  assert.ok(store.countries.get('NRU').aliases.includes('NAURU'));
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

test('le classement France 2000–2025 correspond à l’agrégation indépendante des lignes source', () => {
  const result = rankCountries(store, 'FRA', 2000, 2025, 20);
  assert.equal(result.eligibleCountryCount, 194);
  assert.equal(result.excludedCountryCount, 7);
  const expected = [
    ['GBR', 2216, 2033, '2000-06-15'],
    ['MCO', 2136, 1946, '2000-06-15'],
    ['BEL', 2214, 1958, '2000-06-15'],
    ['SYR', 2049, 780, '2000-06-15'],
    ['NRU', 1245, 479, '2000-10-20'],
    ['CMR', 2020, 783, '2000-10-20'],
  ];
  const entries = [...result.closest, ...result.furthest];
  assert.equal(new Set(entries.map((entry) => entry.country.id)).size, 6);
  for (const [index, [id, common, matching, from]] of expected.entries()) {
    const entry = entries[index];
    assert.equal(entry.country.id, id);
    assert.equal(entry.commonVoteCount, common);
    assert.equal(entry.matchingVoteCount, matching);
    assert.equal(entry.differingVoteCount, common - matching);
    assert.equal(entry.agreementPercent, (100 * matching) / common);
    assert.deepEqual(entry.coverage, { from, to: '2025-12-18' });
  }
});

test('la matrice complète conserve les 202 entités et la référence bilatérale France / Inde', () => {
  const matrix = compareMatrix(store, 2000, 2025, 20, 'all');
  assert.equal(matrix.countries.length, 202);
  const indexes = Object.fromEntries(matrix.countries.map((country, index) => [country.id, index]));
  assert.ok(Number.isInteger(indexes.SUN));
  assert.ok(Number.isInteger(indexes.RUS));
  assert.equal(matrix.commonVoteCounts[indexes.FRA][indexes.IND], 2218);
  assert.equal(matrix.matchingVoteCounts[indexes.FRA][indexes.IND], 1005);
  assert.equal(matrix.agreementPercents[indexes.FRA][indexes.IND], (100 * 1005) / 2218);
  assert.equal(matrix.agreementPercents[indexes.IND][indexes.FRA], (100 * 1005) / 2218);
  assert.equal(matrix.commonVoteCounts[indexes.SUN][indexes.FRA], 0);
  assert.equal(matrix.agreementPercents[indexes.SUN][indexes.FRA], null);
});

test('écologie et sécurité France / Inde correspondent aux décomptes indépendants des sujets source', () => {
  const belowThreshold = compareMatrix(store, 2000, 2025, 20, 'environment');
  const indexes = Object.fromEntries(
    belowThreshold.countries.map((country, index) => [country.id, index]),
  );
  assert.equal(belowThreshold.commonVoteCounts[indexes.FRA][indexes.IND], 15);
  assert.equal(belowThreshold.matchingVoteCounts[indexes.FRA][indexes.IND], 8);
  assert.equal(belowThreshold.agreementPercents[indexes.FRA][indexes.IND], null);
  const visible = compareMatrix(store, 2000, 2025, 1, 'environment');
  assert.equal(visible.agreementPercents[indexes.FRA][indexes.IND], (100 * 8) / 15);
  const security = compareCountries(store, 'FRA', 'IND', 2000, 2025, 'security');
  assert.equal(security.commonVoteCount, 647);
  assert.equal(security.matchingVoteCount, 193);
  assert.equal(security.agreementPercent, (100 * 193) / 647);
});

test('la matrice 3x3, les inflexions et le profil de majorité France / Inde 2000–2025 sont exacts', () => {
  const comp = compareCountries(store, 'FRA', 'IND', 2000, 2025);
  assert.deepEqual(comp.breakdown, {
    YES: { YES: 936, NO: 89, ABSTAIN: 229 },
    NO: { YES: 362, NO: 35, ABSTAIN: 95 },
    ABSTAIN: { YES: 432, NO: 6, ABSTAIN: 34 },
  });
  const trend = compareTrend(store, 'FRA', 'IND', 2000, 2025, 'year', 'all');
  assert.equal(trend.inflections.minVotesUsed, 20);
  assert.equal(trend.inflections.limitedSample, false);
  assert.equal(trend.inflections.highest.year, 2025);
  assert.equal(trend.inflections.highest.commonVoteCount, 192);
  assert.equal(trend.inflections.highest.matchingVoteCount, 129);
  assert.equal(trend.inflections.lowest.year, 2009);
  assert.equal(trend.inflections.lowest.commonVoteCount, 68);
  assert.equal(trend.inflections.lowest.matchingVoteCount, 24);
  assert.equal(trend.inflections.biggestRise.fromYear, 2024);
  assert.equal(trend.inflections.biggestRise.toYear, 2025);
  assert.equal(trend.inflections.biggestDrop.fromYear, 2018);
  assert.equal(trend.inflections.biggestDrop.toYear, 2019);

  const profileFra = countryProfile(store, 'FRA', 2000, 2026);
  assert.equal(profileFra.explicitVoteCount, 2260);
  assert.equal(profileFra.comparableWithMajorityCount, 2260);
  assert.equal(profileFra.alignedWithMajorityCount, 1284);
  assert.equal(profileFra.strictMinorityVoteCount, 175);
  assert.equal(profileFra.minorityVotes[0].sameChoiceCount, 1);
});

test('les comparaisons restent légères : au plus 4 exemples par case, 6 avec un mot-clé', () => {
  const plain = compareCountries(store, 'FRA', 'USA', 1946, 2025);
  const searched = compareCountries(store, 'RUS', 'UKR', 1946, 2025, 'all', 'resolution');
  for (const [result, limit] of [
    [plain, 4],
    [searched, 6],
  ]) {
    const cells = new Map();
    for (const item of [...result.agreements, ...result.divergences]) {
      const cell = `${item.choiceA}:${item.choiceB}`;
      cells.set(cell, (cells.get(cell) ?? 0) + 1);
    }
    assert.ok([...cells.values()].every((count) => count <= limit));
    // Sous 30 Ko : certains proxys de développement bloquent les grosses réponses.
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 30_000);
  }
});
