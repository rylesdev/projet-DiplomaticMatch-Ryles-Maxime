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
test('classement pays : seuil par défaut et seuil explicite, sans duplicata', () => {
  const empty = request('/api/countries/FRA/rankings?from=2020&to=2024');
  assert.equal(empty.country.id, 'FRA');
  assert.equal(empty.minVotes, 20);
  assert.equal(empty.eligibleCountryCount, 0);
  assert.equal(empty.excludedCountryCount, 1);
  const result = request('/api/countries/FRA/rankings?from=2020&to=2024&minVotes=1');
  assert.equal(result.closest[0].country.id, 'IND');
  assert.equal(result.closest[0].commonVoteCount, 3);
  assert.equal(result.closest[0].agreementPercent, (100 * 2) / 3);
  assert.deepEqual(result.furthest, []);
  assert.equal(result.dataVersion, 'test');
});
test('profil pays : distribution, majorité de séance et filtrage thématique', () => {
  const profile = request('/api/countries/FRA/profile?from=2020&to=2024');
  assert.equal(profile.country.id, 'FRA');
  assert.equal(profile.recordedResolutionCount, 6);
  assert.equal(profile.explicitVoteCount, 4);
  assert.deepEqual(profile.totals, { YES: 1, NO: 1, ABSTAIN: 2, NOT_VOTED: 1, UNKNOWN: 1 });
  assert.equal(profile.comparableWithMajorityCount, 3);
  assert.equal(profile.alignedWithMajorityCount, 3);
  assert.equal(profile.tiedMajorityCount, 1);
  assert.equal(profile.majorityAlignmentPercent, 100);
  const emptyTheme = request('/api/countries/FRA/profile?from=2020&to=2024&theme=environment');
  assert.equal(emptyTheme.explicitVoteCount, 0);
  assert.equal(emptyTheme.majorityAlignmentPercent, null);
});
test('API thèmes : catalogue explicite et absence de sujets classée sans inférence', () => {
  const themes = request('/api/themes');
  assert.equal(themes.length, 8);
  assert.equal(themes.find((theme) => theme.id === 'all').resolutionCount, 6);
  assert.equal(themes.find((theme) => theme.id === 'unclassified').recordedVoteResolutionCount, 6);
  assert.equal(themes.find((theme) => theme.id === 'environment').resolutionCount, 0);
});
test('API comparaison, tendance et classement acceptent le thème et renvoient des états vides exacts', () => {
  const comparison = request('/api/compare?countryA=FRA&countryB=IND&theme=environment');
  assert.equal(comparison.theme, 'environment');
  assert.equal(comparison.commonVoteCount, 0);
  assert.equal(comparison.agreementPercent, null);
  const trend = request(
    '/api/compare/trend?countryA=FRA&countryB=IND&from=2020&to=2021&theme=environment',
  );
  assert.equal(trend.theme, 'environment');
  assert.deepEqual(
    trend.points.map((point) => point.agreementPercent),
    [null, null],
  );
  const ranking = request('/api/countries/FRA/rankings?minVotes=1&theme=environment');
  assert.equal(ranking.theme, 'environment');
  assert.deepEqual(ranking.closest, []);
  assert.deepEqual(ranking.furthest, []);
  assert.equal(
    request('/api/compare?countryA=FRA&countryB=IND&theme=unclassified').commonVoteCount,
    3,
  );
});
test('API matrice : tous les pays, seuil par défaut et matrices numériques typées', () => {
  const matrix = request('/api/matrix?from=2020&to=2024&minVotes=1');
  assert.equal(matrix.theme, 'all');
  assert.deepEqual(
    matrix.countries.map((country) => country.id),
    ['FRA', 'IND'],
  );
  assert.deepEqual(matrix.commonVoteCounts, [
    [4, 3],
    [3, 4],
  ]);
  assert.deepEqual(matrix.matchingVoteCounts, [
    [4, 2],
    [2, 4],
  ]);
  assert.equal(matrix.agreementPercents[0][1], (100 * 2) / 3);
  const defaultThreshold = request('/api/matrix');
  assert.equal(defaultThreshold.minVotes, 20);
  assert.equal(defaultThreshold.agreementPercents[0][1], null);
  assert.equal(defaultThreshold.commonVoteCounts[0][1], 3);
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
  '/api/countries/FRA/rankings?minVotes=0',
  '/api/countries/FRA/rankings?minVotes=-1',
  '/api/countries/FRA/rankings?minVotes=1.5',
  '/api/countries/FRA/rankings?minVotes=100001',
  '/api/countries/FRA/rankings?minVotes=non',
  '/api/countries/FRA/rankings?from=2025&to=2020',
  '/api/compare?countryA=FRA&countryB=IND&theme=unknown',
  '/api/compare/trend?countryA=FRA&countryB=IND&theme=unknown',
  '/api/countries/FRA/rankings?theme=unknown',
  '/api/countries/FRA/profile?theme=unknown',
  '/api/countries/FRA/profile?from=2025&to=2020',
  '/api/matrix?theme=unknown',
  '/api/matrix?theme=',
  '/api/matrix?minVotes=0',
  '/api/matrix?minVotes=100001',
  '/api/matrix?minVotes=1.5',
  '/api/matrix?from=2025&to=2020',
  '/api/matrix?from=invalid',
]) {
  test(`paramètres invalides refusés : ${url}`, () =>
    assert.throws(() => request(url), { status: 400 }));
}
test('pays et résolutions inconnus donnent 404, les écritures 405', () => {
  assert.throws(() => request('/api/countries/ZZZ'), { status: 404 });
  assert.throws(() => request('/api/countries/ZZZ/rankings'), { status: 404 });
  assert.throws(() => request('/api/countries/ZZZ/profile'), { status: 404 });
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
  const ranking = await fetch(`${base}/api/countries/FRA/rankings?minVotes=1`);
  assert.equal(ranking.status, 200);
  assert.equal((await ranking.json()).closest[0].country.id, 'IND');
  const matrixResponse = await fetch(`${base}/api/matrix?minVotes=1&theme=all`);
  assert.equal(matrixResponse.status, 200);
  assert.equal((await matrixResponse.json()).commonVoteCounts[0][1], 3);
  const themesResponse = await fetch(`${base}/api/themes`);
  assert.equal(themesResponse.status, 200);
  assert.equal((await themesResponse.json())[0].id, 'all');
  const error = await fetch(`${base}/api/countries/ZZZ`);
  assert.equal(error.status, 404);
  assert.match((await error.json()).error, /État/);
});
