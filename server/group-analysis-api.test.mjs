import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer, handleApi } from './api.mjs';
import { createStore } from './domain.mjs';
import { analyzeGroup } from './group-domain.mjs';
import { groupDataset, groupFilters } from './fixtures/group-dataset.mjs';

const store = createStore(groupDataset());
const request = (url, method = 'GET') => handleApi(store, { url, method });

test('GET /api/groups/analysis : même calcul que analyzeGroup pour les membres reçus', () => {
  const result = request('/api/groups/analysis?members=FRA,IND,BRA&from=2020&to=2022&minVotes=2');
  assert.deepEqual(result, analyzeGroup(store, ['FRA', 'IND', 'BRA'], groupFilters));
  assert.equal(result.cohesionPercent, (100 * 4) / 7);
  // Un scénario n'est qu'une autre liste de membres.
  const scenario = request('/api/groups/analysis?members=FRA,IND,CAN&from=2020&to=2022&minVotes=2');
  assert.deepEqual(scenario.memberIds, ['FRA', 'IND', 'CAN']);
  // Sans filtre : toute la couverture, tous les sujets, seuil 20.
  assert.deepEqual(request('/api/groups/analysis?members=FRA,IND').filters, {
    from: 2020,
    to: 2024,
    theme: 'all',
    minVotes: 20,
  });
});

for (const query of [
  '',
  'members=FRA',
  'members=FRA,FRA',
  'members=FRA,NON',
  'members=FRA,IND&theme=inconnu',
  'members=FRA,IND&from=2022&to=2020',
  'members=FRA,IND&minVotes=0',
  `members=${['FRA', 'IND', 'BRA', 'CAN', 'BEL', 'USA', 'ZZZ', 'A', 'B', 'C', 'D', 'E', 'F'].join(',')}`,
]) {
  test(`GET /api/groups/analysis refusé : ${query || '(sans membres)'}`, () =>
    assert.throws(() => request(`/api/groups/analysis?${query}`), { status: 400 }));
}

test('les calculs de groupe acceptent uniquement GET', () => {
  assert.throws(() => request('/api/groups/analysis?members=FRA,IND', 'POST'), { status: 405 });
});

test('le vrai serveur HTTP sert l’analyse et refuse les écritures sur les groupes', async (t) => {
  const server = createApiServer(store);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/groups/analysis?members=FRA,IND&minVotes=1`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).memberIds, ['FRA', 'IND']);
  const invalid = await fetch(`${base}/api/groups/analysis?members=FRA`);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /entre 2 et 12/);
  // Les anciennes routes d'écriture (SQLite) sont retirées : les écritures passent par Mirage.
  for (const [method, path] of [
    ['POST', '/api/groups'],
    ['PUT', '/api/groups/groupe'],
    ['PATCH', '/api/groups/groupe'],
    ['DELETE', '/api/groups/groupe'],
    ['POST', '/api/groups/groupe/reports'],
  ]) {
    const refused = await fetch(`${base}${path}`, {
      method,
      body: method === 'DELETE' ? undefined : '{}',
    });
    assert.equal(refused.status, 405, `${method} ${path}`);
  }
  assert.equal((await fetch(`${base}/api/groups`)).status, 404);
});
