import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from './api.mjs';
import { createStore } from './domain.mjs';
import { createGroupRepository } from './group-repository.mjs';
import { groupDataset, groupFilters } from './fixtures/group-dataset.mjs';

const draft = {
  name: 'Atelier test',
  description: 'Groupe fictif',
  memberIds: ['FRA', 'IND', 'BRA'],
};

async function start(t) {
  const repository = createGroupRepository();
  const server = createApiServer(createStore(groupDataset()), { groupRepository: repository });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: response.status === 204 ? null : await response.json(),
    };
  };
  return { repository, base, call };
}

test('HTTP groupes : CRUD, révisions, aperçu sans mutation, rapports figés et suppression en cascade', async (t) => {
  const { call } = await start(t);
  assert.deepEqual((await call('/api/groups')).body, []);
  const created = await call('/api/groups', 'POST', draft);
  assert.equal(created.status, 201);
  const group = created.body;
  assert.equal(group.revision, 1);
  assert.ok(!Number.isNaN(Date.parse(group.createdAt)));
  assert.deepEqual((await call(`/api/groups/${group.id}`)).body, group);
  const changed = await call(`/api/groups/${group.id}`, 'PATCH', {
    name: 'Nouveau groupe',
    expectedRevision: 1,
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.revision, 2);
  assert.deepEqual(changed.body.memberIds, draft.memberIds);
  assert.equal(
    (await call(`/api/groups/${group.id}`, 'PATCH', { name: 'Conflit', expectedRevision: 1 }))
      .status,
    409,
  );
  assert.equal((await call(`/api/groups/${group.id}?expectedRevision=1`, 'DELETE')).status, 409);
  const input = { ...groupFilters, expectedRevision: 2 };
  const preview = await call(`/api/groups/${group.id}/preview`, 'POST', {
    ...input,
    memberIds: ['FRA', 'IND', 'CAN'],
  });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.body.memberIds, ['FRA', 'IND', 'CAN']);
  assert.deepEqual((await call(`/api/groups/${group.id}`)).body.memberIds, draft.memberIds);
  assert.deepEqual((await call(`/api/groups/${group.id}/reports`)).body, []);
  const suggestions = await call(`/api/groups/${group.id}/suggestions`, 'POST', input);
  assert.equal(suggestions.status, 200);
  assert.equal(suggestions.body.includeHistorical, false);
  const saved = await call(`/api/groups/${group.id}/reports`, 'POST', input);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.groupSnapshot.revision, 2);
  assert.deepEqual(saved.body.analysis.memberIds, draft.memberIds);
  const list = await call(`/api/groups/${group.id}/reports`);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].groupName, 'Nouveau groupe');
  assert.ok(!Object.hasOwn(list.body[0], 'analysis'));
  const edited = await call(`/api/groups/${group.id}`, 'PATCH', {
    description: 'Après rapport',
    expectedRevision: 2,
  });
  assert.equal(edited.body.revision, 3);
  assert.deepEqual(
    (await call(`/api/groups/${group.id}/reports/${saved.body.id}`)).body,
    saved.body,
  );
  assert.equal((await call(`/api/groups/${group.id}/reports`, 'POST', input)).status, 409);
  const other = (await call('/api/groups', 'POST', { ...draft, name: 'Autre groupe' })).body;
  assert.equal((await call(`/api/groups/${other.id}/reports/${saved.body.id}`)).status, 404);
  assert.equal((await call(`/api/groups/${group.id}?expectedRevision=3`, 'DELETE')).status, 204);
  assert.equal((await call(`/api/groups/${group.id}`)).status, 404);
  assert.equal((await call(`/api/groups/${group.id}/reports/${saved.body.id}`)).status, 404);
  assert.equal((await call('/api/groups')).body.length, 1);
  assert.equal((await call('/api/countries')).status, 200);
  assert.equal((await call('/api/compare?countryA=FRA&countryB=IND')).status, 200);
  assert.equal((await call('/api/compare', 'POST', {})).status, 405);
});

test('HTTP groupes : validation JSON, bornes du corps, états inconnus et types de contenu', async (t) => {
  const { base, call } = await start(t);
  for (const input of [
    null,
    [],
    { ...draft, memberIds: ['FRA'] },
    { ...draft, memberIds: ['FRA', 'FRA'] },
    { ...draft, memberIds: ['FRA', 'NON'] },
    { ...draft, memberIds: Array(13).fill('FRA') },
    { ...draft, name: 'x' },
    { ...draft, description: 'x'.repeat(501) },
  ]) {
    assert.equal((await call('/api/groups', 'POST', input)).status, 400);
  }
  assert.equal(
    (
      await fetch(base + '/api/groups', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(draft),
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await fetch(base + '/api/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      })
    ).status,
    400,
  );
  assert.equal(
    (await call('/api/groups', 'POST', { ...draft, description: 'x'.repeat(40000) })).status,
    413,
  );
  const group = (await call('/api/groups', 'POST', draft)).body;
  assert.equal(
    (await call(`/api/groups/${group.id}`, 'PATCH', { name: 'Sans révision' })).status,
    400,
  );
  assert.equal((await call(`/api/groups/${group.id}`, 'DELETE')).status, 400);
  assert.equal(
    (
      await call(`/api/groups/${group.id}/preview`, 'POST', {
        ...groupFilters,
        expectedRevision: 1,
        from: 2025,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/api/groups/${group.id}/preview`, 'POST', {
        ...groupFilters,
        expectedRevision: 1,
        theme: 'unknown',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/api/groups/${group.id}/reports`, 'POST', {
        ...groupFilters,
        expectedRevision: 1,
        memberIds: ['FRA', 'CAN'],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/api/groups/${group.id}/suggestions`, 'POST', {
        ...groupFilters,
        expectedRevision: 1,
        includeHistorical: 'true',
      })
    ).status,
    400,
  );
  assert.equal((await call('/api/groups/unknown')).status, 404);
  assert.equal((await call(`/api/groups/${group.id}/reports/unknown`)).status, 404);
  assert.equal((await call(`/api/groups/${group.id}/reports/unknown`, 'PATCH', {})).status, 405);
});

test('HTTP groupes : ports localhost personnalisés autorisés sans CORS public', async (t) => {
  const { call } = await start(t);
  for (const origin of ['http://localhost:4201', 'http://127.0.0.1:9876', 'http://[::1]:5000']) {
    const response = await call('/api/groups', 'POST', draft, { origin });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(
    (await call('/api/groups', 'POST', draft, { origin: 'https://external.example' })).status,
    403,
  );
});

test('HTTP groupes : quota et isolation des sessions serveur mémoire', async (t) => {
  const first = await start(t);
  const second = await start(t);
  for (let index = 0; index < 100; index++)
    first.repository.create({ ...draft, name: `Groupe ${index}` });
  assert.equal((await first.call('/api/groups', 'POST', draft)).status, 409);
  assert.deepEqual((await second.call('/api/groups')).body, []);
});
