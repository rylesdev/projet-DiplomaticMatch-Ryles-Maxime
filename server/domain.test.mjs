import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCountries,
  compareTrend,
  countryProfile,
  createStore,
  normalizeVote,
  resolutionDetail,
} from './domain.mjs';
import { syntheticDataset } from './fixtures/synthetic-dataset.mjs';

function pairStore(rawA, rawB) {
  const dataset = syntheticDataset();
  dataset.resolutions = [
    {
      ...dataset.resolutions[0],
      votes: [
        [0, rawA],
        [1, rawB],
      ],
    },
  ];
  return createStore(dataset);
}

test('les quatre codes ONU et les valeurs inconnues restent distincts', () => {
  assert.deepEqual(['Y', 'N', 'A', 'X', '', '?'].map(normalizeVote), [
    'YES',
    'NO',
    'ABSTAIN',
    'NOT_VOTED',
    'UNKNOWN',
    'UNKNOWN',
  ]);
});
test('deux votes identiques donnent 100 %', () => {
  const result = compareCountries(pairStore('Y', 'Y'), 'FRA', 'IND', 2020, 2020);
  assert.equal(result.commonVoteCount, 1);
  assert.equal(result.matchingVoteCount, 1);
  assert.equal(result.agreementPercent, 100);
});
test('deux votes différents donnent 0 % avec un dénominateur non nul', () => {
  const result = compareCountries(pairStore('Y', 'N'), 'FRA', 'IND', 2020, 2020);
  assert.equal(result.differingVoteCount, 1);
  assert.equal(result.agreementPercent, 0);
});
test('abstention / abstention est une concordance explicite', () => {
  assert.equal(
    compareCountries(pairStore('A', 'A'), 'FRA', 'IND', 2020, 2020).agreementPercent,
    100,
  );
});
for (const [label, a, b] of [
  ['abstention / absence', 'A', 'X'],
  ['absence / absence', 'X', 'X'],
  ['inconnu / pour', '?', 'Y'],
]) {
  test(`${label} est exclu du dénominateur et donne null si aucun autre vote`, () => {
    const result = compareCountries(pairStore(a, b), 'FRA', 'IND', 2020, 2020);
    assert.equal(result.commonVoteCount, 0);
    assert.equal(result.matchingVoteCount, 0);
    assert.equal(result.nonComparableCount, 1);
    assert.equal(result.agreementPercent, null);
    assert.deepEqual(result.coverage, { from: null, to: null });
  });
}
test('aucune intersection temporelle retourne null, sans fabriquer de vote', () => {
  const result = compareCountries(createStore(syntheticDataset()), 'FRA', 'IND', 1946, 1950);
  assert.equal(result.agreementPercent, null);
  assert.equal(result.commonVoteCount, 0);
  assert.equal(result.nonComparableCount, 0);
});
test('deux pays observés à des dates disjointes n’ont aucun vote comparable', () => {
  const dataset = syntheticDataset();
  dataset.resolutions = [
    { ...dataset.resolutions[0], votes: [[0, 'Y']] },
    { ...dataset.resolutions[2], votes: [[1, 'Y']] },
  ];
  const result = compareCountries(createStore(dataset), 'FRA', 'IND', 2020, 2021);
  assert.equal(result.commonVoteCount, 0);
  assert.equal(result.nonComparableCount, 2);
  assert.equal(result.agreementPercent, null);
});
test('les premiers et derniers votes de la période sont inclus', () => {
  const result = compareCountries(createStore(syntheticDataset()), 'FRA', 'IND', 2020, 2020);
  assert.equal(result.commonVoteCount, 2);
  assert.equal(result.agreementPercent, 50);
  assert.deepEqual(result.coverage, { from: '2020-01-01', to: '2020-12-31' });
});
test('changer la période change le calcul et ne l’arrondit pas', () => {
  const store = createStore(syntheticDataset());
  const all = compareCountries(store, 'FRA', 'IND', 2020, 2024);
  const next = compareCountries(store, 'FRA', 'IND', 2021, 2024);
  assert.equal(all.commonVoteCount, 3);
  assert.equal(all.matchingVoteCount, 2);
  assert.equal(all.nonComparableCount, 3);
  assert.equal(all.agreementPercent, (100 * 2) / 3);
  assert.equal(next.agreementPercent, 100);
});
test('la tendance réutilise la formule et conserve les années vides à null', () => {
  const store = createStore(syntheticDataset());
  const trend = compareTrend(store, 'FRA', 'IND', 2020, 2024);
  assert.equal(trend.points.length, 5);
  assert.deepEqual(
    trend.points.map((point) => point.agreementPercent),
    [50, 100, null, null, null],
  );
  assert.deepEqual(
    trend.points.map((point) => point.commonVoteCount),
    [2, 1, 0, 0, 0],
  );
});
test('les décennies partielles respectent strictement la période sélectionnée', () => {
  const trend = compareTrend(createStore(syntheticDataset()), 'FRA', 'IND', 2021, 2022, 'decade');
  assert.equal(trend.points.length, 1);
  assert.equal(trend.points[0].year, 2020);
  assert.equal(trend.points[0].commonVoteCount, 1);
  assert.equal(trend.points[0].agreementPercent, 100);
});
test('le détail de résolution distingue les cinq choix et conserve leur valeur brute', () => {
  const store = createStore(syntheticDataset());
  const detail = resolutionDetail(store, store.resolutions.get('4'));
  assert.deepEqual(detail.totals, { YES: 0, NO: 0, ABSTAIN: 1, NOT_VOTED: 1, UNKNOWN: 0 });
  assert.deepEqual(new Set(detail.votes.map((vote) => vote.rawChoice)), new Set(['A', 'X']));
});
test('le profil de majorité exclut les égalités de séance et isole les votes à contre-courant', () => {
  const dataset = syntheticDataset();
  dataset.countries.push({
    id: 'BRA',
    name: 'Brésil',
    nameEn: 'BRAZIL',
    iso3: 'BRA',
    voteCount: 3,
    firstYear: 2020,
    lastYear: 2024,
  });
  dataset.resolutions = [
    // Résolution 1 : FRA=Y, IND=Y, BRA=Y -> majorité YES (3/3), FRA alignée
    {
      ...dataset.resolutions[0],
      votes: [
        [0, 'Y'],
        [1, 'Y'],
        [2, 'Y'],
      ],
    },
    // Résolution 2 : FRA=N, IND=Y, BRA=Y -> majorité YES (2 contre 1), FRA à contre-courant
    {
      ...dataset.resolutions[1],
      votes: [
        [0, 'N'],
        [1, 'Y'],
        [2, 'Y'],
      ],
    },
    // Résolution 3 : FRA=Y, IND=N, BRA=X -> égalité 1 YES / 1 NO, exclue du dénominateur
    {
      ...dataset.resolutions[2],
      votes: [
        [0, 'Y'],
        [1, 'N'],
        [2, 'X'],
      ],
    },
  ];
  const store = createStore(dataset);
  const profile = countryProfile(store, 'FRA', 2020, 2024);
  assert.equal(profile.explicitVoteCount, 3);
  assert.equal(profile.comparableWithMajorityCount, 2);
  assert.equal(profile.alignedWithMajorityCount, 1);
  assert.equal(profile.dissentingVoteCount, 1);
  assert.equal(profile.tiedMajorityCount, 1);
  assert.equal(profile.majorityAlignmentPercent, 50);
  assert.equal(profile.strictMinorityVoteCount, 1);
  assert.equal(profile.minorityVotes.length, 1);
  assert.equal(profile.minorityVotes[0].resolution.id, '2');
  assert.equal(profile.minorityVotes[0].choice, 'NO');
  assert.equal(profile.minorityVotes[0].majorityChoice, 'YES');
  assert.equal(profile.minorityVotes[0].sameChoiceCount, 1);
  assert.equal(profile.minorityVotes[0].assemblyExplicitTotal, 3);
});
