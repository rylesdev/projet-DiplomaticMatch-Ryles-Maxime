import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from './domain.mjs';
import { analyzeGroup } from './group-domain.mjs';
import { createGroupRepository } from './group-repository.mjs';
import { groupDataset, groupFilters } from './fixtures/group-dataset.mjs';

const store = createStore(groupDataset());
const draft = {
  name: 'Groupe de test',
  description: 'Fixture uniquement',
  memberIds: ['FRA', 'IND', 'BRA'],
};

async function withTemporaryDatabase(work) {
  const root = resolve(tmpdir());
  const directory = await mkdtemp(join(root, 'diplomatic-group-test-'));
  try {
    await work(join(directory, 'groups.sqlite'));
  } finally {
    const target = resolve(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('diplomatic-group-test-'))
      throw new Error('Chemin temporaire de test invalide.');
    await rm(target, { recursive: true, force: true });
  }
}

test('SQLite groupes : persistance après fermeture/réouverture et cascade des rapports', async () => {
  await withTemporaryDatabase(async (path) => {
    let repository = createGroupRepository(path);
    let group;
    let report;
    try {
      group = repository.create(draft);
      report = repository.saveReport(group.id, 1, analyzeGroup(store, group, groupFilters));
    } finally {
      repository.close();
    }
    repository = createGroupRepository(path);
    try {
      assert.deepEqual(repository.get(group.id), group);
      assert.deepEqual(repository.getReport(group.id, report.id), report);
      repository.delete(group.id, 1);
      assert.equal(repository.get(group.id), null);
      assert.equal(repository.getReport(group.id, report.id), null);
    } finally {
      repository.close();
    }
    const database = new DatabaseSync(path);
    try {
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM group_reports').get().count, 0);
    } finally {
      database.close();
    }
  });
});

test('SQLite groupes : deux connexions ne peuvent écraser ni supprimer une révision obsolète', async () => {
  await withTemporaryDatabase(async (path) => {
    const first = createGroupRepository(path);
    const second = createGroupRepository(path);
    try {
      const group = first.create(draft);
      assert.equal(second.get(group.id).revision, 1);
      const changed = first.update(group.id, { ...draft, name: 'Version récente' }, 1);
      assert.equal(changed.revision, 2);
      assert.throws(() => second.update(group.id, { ...draft, name: 'Version perdue' }, 1), {
        status: 409,
      });
      assert.throws(() => second.delete(group.id, 1), { status: 409 });
      assert.equal(second.get(group.id).name, 'Version récente');
    } finally {
      first.close();
      second.close();
    }
  });
});

test('SQLite groupes : rapports et résumés figés, sans partage de références avec les appelants', () => {
  const repository = createGroupRepository();
  try {
    const group = repository.create(draft);
    const analysis = analyzeGroup(store, group, groupFilters);
    const report = repository.saveReport(group.id, 1, analysis);
    const frozen = JSON.parse(JSON.stringify(report));
    analysis.cohesionPercent = 999;
    report.groupSnapshot.name = 'Mutation locale';
    report.analysis.memberIds.push('USA');
    repository.update(group.id, { ...draft, name: 'Nouveau nom', memberIds: ['FRA', 'IND'] }, 1);
    assert.deepEqual(repository.getReport(group.id, report.id), frozen);
    const summary = repository.listReports(group.id)[0];
    assert.equal(summary.groupName, draft.name);
    assert.equal(summary.groupRevision, 1);
    assert.equal(summary.memberCount, 3);
    assert.equal(summary.methodVersion, frozen.analysis.methodVersion);
    assert.equal(summary.themeClassificationVersion, frozen.analysis.themeClassificationVersion);
    assert.ok(!Object.hasOwn(summary, 'analysis'));
    assert.throws(() => repository.saveReport(group.id, 1, frozen.analysis), { status: 409 });
  } finally {
    repository.close();
    repository.close();
  }
});

test('SQLite groupes : isolation mémoire et requêtes paramétrées pour les textes et identifiants', () => {
  const first = createGroupRepository();
  const second = createGroupRepository();
  try {
    const name = "Groupe'); DROP TABLE groups;--";
    const group = first.create({ ...draft, name });
    assert.equal(first.get(group.id).name, name);
    assert.equal(first.get("' OR 1=1--"), null);
    assert.equal(second.list().length, 0);
    assert.equal(first.list().length, 1);
  } finally {
    first.close();
    second.close();
  }
});

test('SQLite groupes : quotas explicites et aucun rapport pour une analyse d’un autre groupe', () => {
  const repository = createGroupRepository();
  try {
    const group = repository.create(draft);
    const analysis = analyzeGroup(store, group, groupFilters);
    assert.throws(() => repository.saveReport(group.id, 1, { ...analysis, groupId: 'other' }), {
      status: 400,
    });
    for (let index = 0; index < 100; index++) repository.saveReport(group.id, 1, analysis);
    assert.equal(repository.listReports(group.id).length, 100);
    assert.throws(() => repository.saveReport(group.id, 1, analysis), { status: 409 });
    for (let index = 1; index < 100; index++)
      repository.create({ ...draft, name: `Groupe ${index}` });
    assert.equal(repository.list().length, 100);
    assert.throws(() => repository.create(draft), { status: 409 });
  } finally {
    repository.close();
  }
});
