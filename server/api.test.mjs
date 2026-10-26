import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer, handleApi } from './api.mjs';
import { createStore } from './domain.mjs';
import { syntheticDataset } from './fixtures/synthetic-dataset.mjs';

const store = createStore(syntheticDataset());
const request = (url, method = 'GET') => handleApi(store, { url, method });

test('recherche pays en français/anglais et sélection de fiche', () => {
  assert.equal(request('/api/countries?search=fra')[0].id, 'FRA');
  assert.equal(request('/api/countries?search=india')[0].name, 'Inde');
  assert.equal(request('/api/countries?search=inexistant').length, 0);
  assert.equal(request('/api/countries/FRA').name, 'France');
});
test('historique filtré paginé, total avant découpage et ordre récent', () => {
  const result = request('/api/countries/FRA/votes?from=2020&to=2021&page=2&pageSize=2');
  assert.equal(result.total, 4);
  assert.equal(result.items.length, 2);
  assert.deepEqual(
    result.items.map((item) => item.resolution.id),
    ['2', '1'],
  );
  assert.equal(result.items[0].rawChoice, 'N');
});
test('recherche des résolutions et détail sourcé', () => {
  const result = request('/api/resolutions?search=TEST%2F3&from=2020&to=2022');
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, '3');
  const detail = request('/api/resolutions/3');
  assert.equal(detail.votes.length, 2);
  assert.equal(detail.totals.ABSTAIN, 2);
});
test('comparaison et évolution exposent le même contrat mathématique', () => {
  assert.equal(
    request('/api/compare?countryA=FRA&countryB=IND&from=2020&to=2020').agreementPercent,
    50,
  );
  assert.equal(
    request('/api/compare/trend?countryA=FRA&countryB=IND&from=2020&to=2020&interval=year')
      .points[0].agreementPercent,
    50,
  );
});
for (const url of [
  '/api/countries/FRA/votes?page=-1',
  '/api/countries/FRA/votes?pageSize=101',
  '/api/countries/FRA/votes?page=1.5',
  '/api/compare?countryA=FRA&countryB=IND&from=2025&to=2020',
  '/api/compare?countryA=FRA',
  '/api/compare?countryA=FRA&countryB=FRA',
  '/api/compare/trend?countryA=FRA&countryB=IND&interval=month',
  '/api/resolutions?from=2020oops',
]) {
  test(`paramètres invalides refusés : ${url}`, () =>
    assert.throws(() => request(url), { status: 400 }));
}
test('pays et résolutions inconnus donnent 404, les écritures 405', () => {
  assert.throws(() => request('/api/countries/ZZZ'), { status: 404 });
  assert.throws(() => request('/api/resolutions/99999'), { status: 404 });
  assert.throws(() => request('/api/metadata', 'POST'), { status: 405 });
});
test('le véritable serveur HTTP renvoie JSON, statuts et erreurs lisibles', async (t) => {
  const server = createApiServer(store);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/metadata`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).version, 'test');
  const error = await fetch(`${base}/api/countries/ZZZ`);
  assert.equal(error.status, 404);
  assert.match((await error.json()).error, /État/);
});
