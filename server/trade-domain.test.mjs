import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, compareCountries } from './domain.mjs';
import { syntheticDataset } from './fixtures/synthetic-dataset.mjs';
import { compareTrade, createTradeStore, tradePartners } from './trade-domain.mjs';

function fixture() {
  const votes = syntheticDataset();
  votes.countries.push(
    {
      id: 'CAN',
      iso3: 'CAN',
      name: 'Canada',
      nameEn: 'CANADA',
      voteCount: 2,
      firstYear: 2020,
      lastYear: 2020,
    },
    {
      id: 'RUS',
      iso3: 'RUS',
      name: 'Russie',
      nameEn: 'RUSSIAN FEDERATION',
      voteCount: 2,
      firstYear: 2020,
      lastYear: 2020,
    },
    {
      id: 'SUN',
      name: 'Union soviétique (historique)',
      nameEn: 'USSR',
      voteCount: 2,
      firstYear: 2020,
      lastYear: 2020,
    },
  );
  votes.resolutions[0].votes.push([2, 'N'], [3, 'Y'], [4, 'N']);
  votes.resolutions[1].votes.push([2, 'N'], [3, 'Y'], [4, 'N']);
  const flows = [
    [2020, 'FRA', 'IND', 100],
    [2020, 'IND', 'FRA', 60],
    [2021, 'FRA', 'IND', 0],
    [2021, 'IND', 'FRA', 0],
    [2022, 'FRA', 'IND', 40],
    [2024, 'IND', 'FRA', 80],
    [2020, 'FRA', 'CAN', 200],
    [2020, 'CAN', 'FRA', 20],
    [2020, 'FRA', 'RUS', 300],
    [2020, 'RUS', 'FRA', 300],
  ];
  const dataset = {
    schemaVersion: 1,
    metadata: {
      sourceName: 'Fixture inventée pour tests',
      sourceUrl: 'https://example.test/trade',
      version: 'test-trade',
      retrievedAt: '2026-01-01T00:00:00Z',
      unit: 'USD',
      priceBasis: 'current',
      valuation: 'FOB',
      measure: 'goods_exports',
      coverage: { from: 2020, to: 2024 },
      countryCount: 4,
      observationCount: flows.length,
    },
    countries: ['FRA', 'IND', 'CAN', 'RUS'],
    flows,
  };
  return { votes: createStore(votes), trade: createTradeStore(dataset), dataset };
}

function comparison(votes, trade, overrides = {}) {
  return compareTrade(votes, trade, {
    countryA: 'FRA',
    countryB: 'IND',
    from: 2020,
    to: 2024,
    minVotes: 1,
    ...overrides,
  });
}

test('commerce : les flux orientés, le total et le solde utilisent exclusivement les deux séries d’exportation', () => {
  const { votes, trade } = fixture();
  const result = comparison(votes, trade);
  assert.equal(result.voteDataVersion, syntheticDataset().metadata.version);
  assert.deepEqual(result.points[0], {
    year: 2020,
    exportsAtoB: 100,
    exportsBtoA: 60,
    totalTrade: 160,
    balanceA: 40,
    derivationAtoB: null,
    derivationBtoA: null,
    statusAtoB: null,
    statusBtoA: null,
    agreementPercent: 50,
    commonVoteCount: 2,
  });
  const reverse = comparison(votes, trade, { countryA: 'IND', countryB: 'FRA' });
  assert.equal(reverse.points[0].exportsAtoB, 60);
  assert.equal(reverse.points[0].exportsBtoA, 100);
  assert.equal(reverse.points[0].totalTrade, 160);
  assert.equal(reverse.points[0].balanceA, -40);
  assert.equal(reverse.points[0].agreementPercent, 50);
});

test('commerce : un vrai zéro reste zéro, une direction manquante interdit total et solde', () => {
  const { votes, trade } = fixture();
  const result = comparison(votes, trade);
  assert.equal(result.points[1].totalTrade, 0);
  assert.equal(result.points[1].balanceA, 0);
  assert.equal(result.points[2].exportsAtoB, 40);
  assert.equal(result.points[2].exportsBtoA, null);
  assert.equal(result.points[2].totalTrade, null);
  assert.equal(result.points[2].balanceA, null);
  assert.equal(result.points[3].exportsAtoB, null);
  assert.equal(result.points[3].exportsBtoA, null);
  assert.equal(result.points[4].exportsAtoB, null);
  assert.equal(result.points[4].exportsBtoA, 80);
  assert.equal(result.summary.latestCompleteYear, 2021);
  assert.equal(result.summary.latest.totalTrade, 0);
  assert.equal(result.summary.comparableYearCount, 2);
});

test('commerce : les années hors couverture restent vides et le seuil ONU est appliqué à chaque année', () => {
  const { votes, trade } = fixture();
  const result = comparison(votes, trade, { from: 2019, to: 2025, minVotes: 2 });
  assert.deepEqual(
    result.points.map((point) => point.year),
    [2019, 2020, 2021, 2022, 2023, 2024, 2025],
  );
  assert.equal(result.points[0].totalTrade, null);
  assert.equal(result.points[6].totalTrade, null);
  assert.equal(result.points[1].agreementPercent, 50);
  assert.equal(result.points[2].agreementPercent, null);
  assert.equal(result.points[2].commonVoteCount, 1);
  assert.equal(result.summary.comparableYearCount, 1);
  assert.equal(result.summary.latestCompleteYear, 2021);
});

test('commerce : le thème filtre uniquement les votes, sans changer les flux ni inventer un accord ONU', () => {
  const { votes, trade } = fixture();
  const result = comparison(votes, trade, { theme: 'environment' });
  assert.equal(result.points[0].totalTrade, 160);
  assert.equal(result.points[0].agreementPercent, null);
  assert.equal(result.points[0].commonVoteCount, 0);
  assert.equal(result.summary.comparableYearCount, 0);
  for (const point of comparison(votes, trade).points) {
    const expected = compareCountries(votes, 'FRA', 'IND', point.year, point.year);
    assert.equal(point.commonVoteCount, expected.commonVoteCount);
    assert.equal(point.agreementPercent, expected.agreementPercent);
  }
});

test('commerce : les partenaires sont triés par total complet, les données partielles restent consultables', () => {
  const { votes, trade } = fixture();
  const result = tradePartners(votes, trade, { country: 'FRA', year: 2020, minVotes: 1 });
  assert.equal(result.voteDataVersion, syntheticDataset().metadata.version);
  assert.deepEqual(
    result.partners.map((item) => item.country.id),
    ['RUS', 'CAN', 'IND'],
  );
  assert.equal(result.partners[0].totalTrade, 600);
  assert.equal(result.partners[2].exportsToPartner, 100);
  assert.equal(result.partners[2].exportsFromPartner, 60);
  assert.equal(result.partners[2].agreementPercent, 50);
  const partial = tradePartners(votes, trade, { country: 'FRA', year: 2022, minVotes: 1 });
  assert.equal(partial.partners.length, 1);
  assert.equal(partial.partners[0].totalTrade, null);
  assert.equal(partial.partners[0].exportsToPartner, 40);
  assert.equal(partial.partners[0].exportsFromPartner, null);
  assert.equal(partial.partners[0].agreementPercent, null);
  assert.deepEqual(tradePartners(votes, trade, { country: 'FRA', year: 2019 }).partners, []);
});

test('commerce : un État historique ne récupère jamais les séries de son successeur', () => {
  const { votes, trade } = fixture();
  const historical = comparison(votes, trade, { countryB: 'SUN' });
  assert.ok(
    historical.points.every((point) => point.exportsAtoB === null && point.exportsBtoA === null),
  );
  assert.equal(historical.summary.latest, null);
  assert.deepEqual(tradePartners(votes, trade, { country: 'SUN', year: 2020 }).partners, []);
  assert.equal(comparison(votes, trade, { countryB: 'RUS' }).points[0].totalTrade, 600);
});

test('commerce : les statuts source sont conservés dans chaque direction, y compris après permutation', () => {
  const { votes, dataset } = fixture();
  dataset.flows[0].push('M', null);
  dataset.flows[1].push('M', 'e');
  const trade = createTradeStore(dataset);
  const forward = comparison(votes, trade).points[0];
  assert.equal(forward.derivationAtoB, 'M');
  assert.equal(forward.derivationBtoA, 'M');
  assert.equal(forward.statusAtoB, null);
  assert.equal(forward.statusBtoA, 'e');
  assert.equal(forward.totalTrade, 160);
  const reverse = comparison(votes, trade, { countryA: 'IND', countryB: 'FRA' }).points[0];
  assert.equal(reverse.derivationAtoB, 'M');
  assert.equal(reverse.derivationBtoA, 'M');
  assert.equal(reverse.statusAtoB, 'e');
  assert.equal(reverse.statusBtoA, null);
  const partners = tradePartners(votes, trade, { country: 'FRA', year: 2020 });
  const india = partners.partners.find((item) => item.country.id === 'IND');
  assert.equal(india.derivationToPartner, 'M');
  assert.equal(india.derivationFromPartner, 'M');
  assert.equal(india.statusToPartner, null);
  assert.equal(india.statusFromPartner, 'e');
});

test('commerce : l’import rejette doublons, valeurs absentes, unités inattendues et métadonnées incohérentes', () => {
  const { dataset } = fixture();
  for (const mutate of [
    (d) => {
      d.flows.push(d.flows[0]);
      d.metadata.observationCount++;
    },
    (d) => {
      d.flows[0][3] = null;
    },
    (d) => {
      d.flows[0][3] = -1;
    },
    (d) => {
      d.flows[0][3] = Infinity;
    },
    (d) => {
      d.flows[0].push('M', 123);
    },
    (d) => {
      d.flows[0][0] = 2019;
    },
    (d) => {
      d.flows[0][1] = 'ZZZ';
    },
    (d) => {
      d.flows[0][1] = 'IND';
    },
    (d) => {
      d.metadata.unit = 'USD millions';
    },
    (d) => {
      d.metadata.valuation = 'CIF';
    },
    (d) => {
      d.metadata.observationCount++;
    },
    (d) => {
      d.countries.push('FRA');
    },
  ]) {
    const invalid = structuredClone(dataset);
    mutate(invalid);
    assert.throws(() => createTradeStore(invalid), /jeu de commerce est invalide/);
  }
});
