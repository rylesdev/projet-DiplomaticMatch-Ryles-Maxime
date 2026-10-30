import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, createApiServer } from './api.mjs';
import { createStore } from './domain.mjs';
import { syntheticDataset } from './fixtures/synthetic-dataset.mjs';
import { createTradeStore } from './trade-domain.mjs';

const voteStore = createStore(syntheticDataset());
const tradeStore = createTradeStore({
  schemaVersion: 1,
  metadata: {
    sourceName: 'Fixture inventée pour tests',
    sourceUrl: 'https://example.test/trade',
    version: 'test',
    retrievedAt: '2026-01-01T00:00:00Z',
    unit: 'USD',
    priceBasis: 'current',
    valuation: 'FOB',
    measure: 'goods_exports',
    coverage: { from: 2020, to: 2024 },
    countryCount: 2,
    observationCount: 2,
  },
  countries: ['FRA', 'IND'],
  flows: [
    [2020, 'FRA', 'IND', 100],
    [2020, 'IND', 'FRA', 60],
  ],
});
const request = (url, method = 'GET') => handleApi(voteStore, { url, method }, { tradeStore });

test('API commerce : métadonnées, période par défaut et paramètres du croisement annuel', () => {
  assert.equal(request('/api/trade/metadata').observationCount, 2);
  const result = request('/api/trade/compare?countryA=FRA&countryB=IND&minVotes=1');
  assert.equal(result.from, 2020);
  assert.equal(result.to, 2024);
  assert.equal(result.points[0].exportsAtoB, 100);
  assert.equal(result.points[0].agreementPercent, 50);
  assert.equal(
    request('/api/trade/compare?countryA=FRA&countryB=IND').points[0].agreementPercent,
    null,
  );
  const partners = request('/api/trade/partners?country=FRA&year=2020&minVotes=1');
  assert.equal(partners.partners[0].country.id, 'IND');
  assert.equal(partners.partners[0].totalTrade, 160);
  assert.deepEqual(request('/api/trade/partners?country=FRA').partners, []);
});

for (const url of [
  '/api/trade/compare',
  '/api/trade/compare?countryA=FRA',
  '/api/trade/compare?countryA=FRA&countryB=FRA',
  '/api/trade/compare?countryA=FRA&countryB=IND&from=2025&to=2020',
  '/api/trade/compare?countryA=FRA&countryB=IND&from=2020x',
  '/api/trade/compare?countryA=FRA&countryB=IND&to=2101',
  '/api/trade/compare?countryA=FRA&countryB=IND&minVotes=0',
  '/api/trade/compare?countryA=FRA&countryB=IND&minVotes=1.5',
  '/api/trade/compare?countryA=FRA&countryB=IND&theme=unknown',
  '/api/trade/partners',
  '/api/trade/partners?country=FRA&year=',
  '/api/trade/partners?country=FRA&year=1900.5',
  '/api/trade/partners?country=FRA&minVotes=100001',
  '/api/trade/partners?country=FRA&theme=',
]) {
  test(`API commerce : paramètre invalide refusé (${url})`, () => {
    assert.throws(() => request(url), { status: 400 });
  });
}

test('API commerce : pays inconnu 404, écriture 405 et absence de snapshot 503', () => {
  assert.throws(() => request('/api/trade/compare?countryA=FRA&countryB=ZZZ'), { status: 404 });
  assert.throws(() => request('/api/trade/partners?country=ZZZ'), { status: 404 });
  assert.throws(() => request('/api/trade/metadata', 'POST'), { status: 405 });
  assert.throws(() => handleApi(voteStore, { url: '/api/trade/metadata', method: 'GET' }), {
    status: 503,
  });
  assert.throws(() => handleApi(voteStore, { url: '/api/trade/unknown', method: 'GET' }), {
    status: 404,
  });
});

test('HTTP commerce : injection du snapshot, contrat JSON et statut 503 quand il manque', async (t) => {
  const servers = [createApiServer(voteStore, { tradeStore }), createApiServer(voteStore)];
  for (const server of servers) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
  }
  const response = await fetch(
    `http://127.0.0.1:${servers[0].address().port}/api/trade/compare?countryA=FRA&countryB=IND&from=2020&to=2020&minVotes=1`,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).points[0].totalTrade, 160);
  const invalid = await fetch(
    `http://127.0.0.1:${servers[0].address().port}/api/trade/compare?countryA=FRA&countryB=IND&from=2024&to=2020`,
  );
  assert.equal(invalid.status, 400);
  const missing = await fetch(`http://127.0.0.1:${servers[1].address().port}/api/trade/metadata`);
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /commerce/);
});
