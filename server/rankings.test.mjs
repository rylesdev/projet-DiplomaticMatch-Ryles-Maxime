import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCountries, createStore, rankCountries } from './domain.mjs';
import { syntheticDataset } from './fixtures/synthetic-dataset.mjs';

// Matrices inventées pour les tests uniquement ; aucun résultat de fixture n'est servi en production.
function rankingStore(countryNames, rows) {
  const dataset = syntheticDataset();
  dataset.countries = Object.entries(countryNames).map(([id, name]) => ({
    id,
    name,
    nameEn: name,
    voteCount: 0,
    firstYear: 2020,
    lastYear: 2021,
  }));
  const indexes = new Map(dataset.countries.map((country, index) => [country.id, index]));
  dataset.resolutions = rows.map((row, index) => ({
    id: String(index + 1),
    symbol: `TEST/${index + 1}`,
    title: 'Résolution fictive de classement',
    date: row.date,
    sourceUrl: 'https://example.test/fixture',
    votes: Object.entries(row.choices).map(([id, raw]) => [indexes.get(id), raw]),
  }));
  return createStore(dataset);
}

function fullRankingStore() {
  const patterns = {
    FRA: 'YYYY',
    AAA: 'YYYY',
    BBB: 'YYYX',
    CCC: 'YYNN',
    DDD: 'YNXX',
    EEE: 'NNNN',
    FFF: 'NNNX',
    GGG: 'YNNN',
    HHH: 'XXXX',
    III: '????',
  };
  const names = Object.fromEntries(Object.keys(patterns).map((id) => [id, id]));
  names.JJJ = 'Sans intersection';
  const dates = ['2020-01-01', '2020-02-01', '2020-09-01', '2020-12-31'];
  return rankingStore(
    names,
    dates.map((date, index) => ({
      date,
      choices: Object.fromEntries(Object.entries(patterns).map(([id, raw]) => [id, raw[index]])),
    })),
  );
}

const ids = (entries) => entries.map((entry) => entry.country.id);

test('classement : top et bottom selon taux exact, effectif décroissant et sans pays lui-même', () => {
  const result = rankCountries(fullRankingStore(), 'FRA', 2020, 2020, 1);
  assert.deepEqual(ids(result.closest), ['AAA', 'BBB', 'CCC']);
  assert.deepEqual(ids(result.furthest), ['EEE', 'FFF', 'GGG']);
  assert.equal(result.eligibleCountryCount, 7);
  assert.equal(result.excludedCountryCount, 3);
  assert.equal(new Set([...ids(result.closest), ...ids(result.furthest)]).size, 6);
  assert.ok(![...ids(result.closest), ...ids(result.furthest)].includes('FRA'));
  assert.deepEqual(result.closest[0].coverage, { from: '2020-01-01', to: '2020-12-31' });
  assert.deepEqual(result.closest[1].coverage, { from: '2020-01-01', to: '2020-09-01' });
});

test('classement : chaque résultat est identique au calcul de comparaison bilatérale', () => {
  const store = fullRankingStore();
  const result = rankCountries(store, 'FRA', 2020, 2020, 1);
  for (const entry of [...result.closest, ...result.furthest]) {
    const comparison = compareCountries(store, 'FRA', entry.country.id, 2020, 2020);
    for (const key of [
      'commonVoteCount',
      'matchingVoteCount',
      'differingVoteCount',
      'agreementPercent',
      'coverage',
    ]) {
      assert.deepEqual(entry[key], comparison[key]);
    }
  }
});

test('classement : deux pourcentages affichables identiquement restent triés sans arrondi', () => {
  const rows = Array.from({ length: 400 }, (_, index) => ({
    date: '2020-01-01',
    choices: {
      FRA: 'Y',
      AAA: index < 9 ? (index < 7 ? 'Y' : 'N') : 'X',
      BBB: index < 311 ? 'Y' : 'N',
    },
  }));
  const result = rankCountries(
    rankingStore({ FRA: 'France', AAA: 'A', BBB: 'B' }, rows),
    'FRA',
    2020,
    2020,
    1,
  );
  assert.deepEqual(ids(result.closest), ['AAA', 'BBB']);
  assert.equal(result.closest[0].agreementPercent, (100 * 7) / 9);
  assert.equal(result.closest[1].agreementPercent, (100 * 311) / 400);
  assert.equal(
    result.closest[0].agreementPercent.toFixed(1),
    result.closest[1].agreementPercent.toFixed(1),
  );
});

test('classement : seuil minimum inclusif et listes partielles sans doublon si moins de six éligibles', () => {
  const result = rankCountries(fullRankingStore(), 'FRA', 2020, 2020, 4);
  assert.equal(result.eligibleCountryCount, 4);
  assert.equal(result.excludedCountryCount, 6);
  assert.deepEqual(ids(result.closest), ['AAA', 'CCC', 'GGG']);
  assert.deepEqual(ids(result.furthest), ['EEE']);
});

test('classement : taux ex æquo départagés par effectif puis nom français puis identifiant', () => {
  const store = rankingStore(
    { FRA: 'France', AAA: 'Zèbre', BBB: 'Éclair', DDD: 'Abricot', CCC: 'Abricot' },
    [{ date: '2020-01-01', choices: { FRA: 'Y', AAA: 'Y', BBB: 'Y', CCC: 'Y', DDD: 'Y' } }],
  );
  const result = rankCountries(store, 'FRA', 2020, 2020, 1);
  assert.deepEqual(ids(result.closest), ['CCC', 'DDD', 'BBB']);
  assert.deepEqual(ids(result.furthest), ['AAA']);
});

test('classement : les ex æquo du bas utilisent aussi effectif, nom français et identifiant', () => {
  const store = rankingStore(
    {
      FRA: 'France',
      AAA: 'A',
      BBB: 'B',
      CCC: 'C',
      DDD: 'Zèbre',
      EEE: 'Alpha',
      FFF: 'Alpha',
      GGG: 'Bêta',
    },
    ['2020-01-01', '2020-02-01', '2020-03-01', '2020-12-31'].map((date, index) => ({
      date,
      choices: {
        FRA: 'Y',
        AAA: 'Y',
        BBB: 'Y',
        CCC: 'Y',
        DDD: 'N',
        EEE: 'N',
        FFF: index === 3 ? 'X' : 'N',
        GGG: 'N',
      },
    })),
  );
  assert.deepEqual(ids(rankCountries(store, 'FRA', 2020, 2020, 1).furthest), ['EEE', 'GGG', 'DDD']);
});

test('classement : abstention commune incluse ; absence ou inconnu de l’un des pays exclus', () => {
  const store = rankingStore({ FRA: 'France', AAA: 'A', BBB: 'B', CCC: 'C' }, [
    { date: '2020-01-01', choices: { FRA: 'A', AAA: 'A', BBB: 'X', CCC: '?' } },
    { date: '2020-02-01', choices: { FRA: 'X', AAA: 'Y', BBB: 'A', CCC: 'Y' } },
    { date: '2020-03-01', choices: { FRA: '?', AAA: 'Y', BBB: 'Y', CCC: 'Y' } },
  ]);
  const result = rankCountries(store, 'FRA', 2020, 2020, 1);
  assert.equal(result.eligibleCountryCount, 1);
  assert.equal(result.excludedCountryCount, 2);
  assert.deepEqual(ids(result.closest), ['AAA']);
  assert.deepEqual(result.furthest, []);
  assert.equal(result.closest[0].commonVoteCount, 1);
  assert.equal(result.closest[0].agreementPercent, 100);
  assert.deepEqual(result.closest[0].coverage, { from: '2020-01-01', to: '2020-01-01' });
});

test('classement : périodes sans vote commun ou sous le seuil donnent des listes vides', () => {
  const store = fullRankingStore();
  for (const result of [
    rankCountries(store, 'FRA', 1946, 1946, 1),
    rankCountries(store, 'FRA', 2020, 2020, 5),
  ]) {
    assert.equal(result.eligibleCountryCount, 0);
    assert.equal(result.excludedCountryCount, 10);
    assert.deepEqual(result.closest, []);
    assert.deepEqual(result.furthest, []);
  }
});

test('classement : changer la période actualise le classement et les dates de couverture', () => {
  const store = rankingStore({ FRA: 'France', AAA: 'A', BBB: 'B' }, [
    { date: '2020-01-01', choices: { FRA: 'Y', AAA: 'Y', BBB: 'N' } },
    { date: '2020-12-31', choices: { FRA: 'Y', AAA: 'Y', BBB: 'N' } },
    { date: '2021-01-01', choices: { FRA: 'Y', AAA: 'N', BBB: 'Y' } },
  ]);
  const first = rankCountries(store, 'FRA', 2020, 2020, 1);
  const second = rankCountries(store, 'FRA', 2021, 2021, 1);
  assert.deepEqual(ids(first.closest), ['AAA', 'BBB']);
  assert.equal(first.closest[0].commonVoteCount, 2);
  assert.deepEqual(first.closest[0].coverage, { from: '2020-01-01', to: '2020-12-31' });
  assert.deepEqual(ids(second.closest), ['BBB', 'AAA']);
  assert.deepEqual(second.closest[0].coverage, { from: '2021-01-01', to: '2021-01-01' });
});

test('classement : les entités historiques et actuelles restent distinctes', () => {
  const store = rankingStore({ FRA: 'France', SUN: 'Union soviétique', RUS: 'Russie' }, [
    { date: '2020-01-01', choices: { FRA: 'Y', SUN: 'Y', RUS: 'N' } },
  ]);
  assert.deepEqual(ids(rankCountries(store, 'FRA', 2020, 2020, 1).closest), ['SUN', 'RUS']);
});
