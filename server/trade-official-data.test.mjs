import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { compareCountries, createStore } from './domain.mjs';
import { compareTrade, createTradeStore } from './trade-domain.mjs';

const [rawTrade, rawManifest, rawVotes] = await Promise.all([
  readFile(new URL('../data/trade-dataset.json', import.meta.url)),
  readFile(new URL('../data/trade-manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../data/dataset.json', import.meta.url), 'utf8'),
]);
const dataset = JSON.parse(rawTrade.toString('utf8'));
const manifest = JSON.parse(rawManifest);
const voteDataset = JSON.parse(rawVotes);
const voteStore = createStore(voteDataset);
const tradeStore = createTradeStore(dataset);
const historicalCodes = new Set(['SUN', 'DDR', 'GER', 'CSK', 'YUG', 'SCG', 'YMD', 'EAT', 'EAZ']);

test('commerce officiel : l’empreinte SHA-256 et la taille du snapshot correspondent au manifeste', () => {
  assert.equal(createHash('sha256').update(rawTrade).digest('hex'), manifest.output.sha256);
  assert.equal(rawTrade.byteLength, manifest.output.bytes);
  assert.equal(manifest.output.path, 'data/trade-dataset.json');
  assert.deepEqual(dataset.metadata, manifest.metadata);
  assert.equal(dataset.metadata.unit, 'USD');
  assert.equal(dataset.metadata.priceBasis, 'current');
  assert.equal(dataset.metadata.valuation, 'FOB');
  assert.equal(dataset.metadata.measure, 'goods_exports');
});

test('commerce officiel : effectifs, années, dérivations et estimations correspondent à l’extraction auditée', () => {
  assert.equal(dataset.countries.length, 190);
  assert.equal(dataset.flows.length, 524840);
  assert.equal(dataset.flows.length, manifest.counts.retained);
  assert.equal(dataset.flows.length, dataset.metadata.observationCount);
  assert.equal(dataset.countries.length, dataset.metadata.countryCount);
  assert.equal(manifest.counts.source, 792827);
  assert.equal(
    manifest.counts.retained +
      manifest.counts.outsideCountryScope +
      manifest.counts.selfFlows +
      manifest.counts.missingValues +
      manifest.counts.outsidePeriod,
    manifest.counts.source,
  );
  const derivations = {};
  const statuses = {};
  let firstYear = Infinity;
  let lastYear = -Infinity;
  for (const [year, , , , derivation, status] of dataset.flows) {
    firstYear = Math.min(firstYear, year);
    lastYear = Math.max(lastYear, year);
    derivations[derivation ?? 'unspecified'] = (derivations[derivation ?? 'unspecified'] ?? 0) + 1;
    statuses[status ?? 'unspecified'] = (statuses[status ?? 'unspecified'] ?? 0) + 1;
  }
  assert.deepEqual({ from: firstYear, to: lastYear }, { from: 2000, to: 2024 });
  assert.deepEqual(dataset.metadata.coverage, { from: firstYear, to: lastYear });
  assert.deepEqual(derivations, manifest.derivations);
  assert.deepEqual(statuses, manifest.statuses);
  assert.equal(statuses.e, 37366);
  assert.equal(statuses.unspecified, 487474);
});

test('commerce officiel : le périmètre ne contient aucun agrégat ni code historique', () => {
  const allowedCountries = new Set(
    voteDataset.countries
      .filter((country) => !historicalCodes.has(country.id))
      .map((country) => country.iso3 ?? country.id),
  );
  const actualCountries = new Set(dataset.countries);
  assert.equal(actualCountries.size, dataset.countries.length);
  for (const code of dataset.countries) {
    assert.ok(allowedCountries.has(code), `Code hors périmètre ONU actuel : ${code}`);
    assert.ok(!historicalCodes.has(code));
  }
  for (const [, exporter, importer] of dataset.flows) {
    assert.ok(actualCountries.has(exporter));
    assert.ok(actualCountries.has(importer));
    assert.notEqual(exporter, importer);
  }
});

// Montants vérifiés séparément dans les observations XML de l’API officielle FMI.
// Ils empêchent notamment une seconde multiplication erronée par SCALE=6.
test('commerce officiel : France → Inde conserve les USD source de 2020 et 2024', () => {
  const result = compareTrade(voteStore, tradeStore, {
    countryA: 'FRA',
    countryB: 'IND',
    from: 2020,
    to: 2024,
  });
  assert.equal(result.points.find((point) => point.year === 2020).exportsAtoB, 6562106659);
  const latest = result.points.find((point) => point.year === 2024);
  assert.equal(latest.exportsAtoB, 8165623321);
  assert.equal(latest.exportsBtoA, 7978340000);
  assert.equal(latest.totalTrade, 16143963321);
  assert.equal(latest.balanceA, 187283321);
  assert.equal(latest.derivationAtoB, 'M');
  assert.equal(latest.statusAtoB, null);
});

test('commerce officiel : votes de la même année, total symétrique et écart inversé France / Inde', () => {
  const params = { from: 2020, to: 2024, minVotes: 20, theme: 'all' };
  const forward = compareTrade(voteStore, tradeStore, {
    ...params,
    countryA: 'FRA',
    countryB: 'IND',
  });
  const reverse = compareTrade(voteStore, tradeStore, {
    ...params,
    countryA: 'IND',
    countryB: 'FRA',
  });
  for (const [index, point] of forward.points.entries()) {
    const votes = compareCountries(voteStore, 'FRA', 'IND', point.year, point.year, 'all');
    assert.equal(point.commonVoteCount, votes.commonVoteCount);
    assert.equal(
      point.agreementPercent,
      votes.commonVoteCount >= 20 ? votes.agreementPercent : null,
    );
    assert.equal(point.exportsAtoB, reverse.points[index].exportsBtoA);
    assert.equal(point.exportsBtoA, reverse.points[index].exportsAtoB);
    assert.equal(point.totalTrade, reverse.points[index].totalTrade);
    assert.equal(point.balanceA, -reverse.points[index].balanceA);
    assert.equal(point.agreementPercent, reverse.points[index].agreementPercent);
  }
});
