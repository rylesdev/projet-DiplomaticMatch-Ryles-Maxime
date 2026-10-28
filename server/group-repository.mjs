import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { GroupError } from './group-domain.mjs';

const MAX_GROUPS = 100;
const MAX_REPORTS = 100;

function groupFromRow(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        description: row.description,
        memberIds: JSON.parse(row.member_ids),
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

export function reportSummary(report) {
  const { id, groupId, createdAt, groupSnapshot, analysis } = report;
  return {
    id,
    groupId,
    createdAt,
    groupName: groupSnapshot.name,
    groupRevision: groupSnapshot.revision,
    memberCount: groupSnapshot.memberIds.length,
    filters: analysis.filters,
    cohesionPercent: analysis.cohesionPercent,
    eligiblePairCount: analysis.eligiblePairCount,
    totalPairCount: analysis.totalPairCount,
    commonPairVotes: analysis.commonPairVotes,
    dataVersion: analysis.dataVersion,
    themeClassificationVersion: analysis.themeClassificationVersion,
    methodVersion: analysis.methodVersion,
  };
}

export function createGroupRepository(path = ':memory:') {
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      member_ids TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_reports (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      document TEXT NOT NULL,
      summary TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS group_reports_group_date ON group_reports(group_id, created_at);
  `);
  const queries = {
    group: db.prepare('SELECT * FROM groups WHERE id = ?'),
    groups: db.prepare('SELECT * FROM groups ORDER BY updated_at DESC, id ASC'),
    groupCount: db.prepare('SELECT COUNT(*) AS count FROM groups'),
    insertGroup: db.prepare(
      'INSERT INTO groups (id,name,description,member_ids,revision,created_at,updated_at) VALUES (?,?,?,?,1,?,?)',
    ),
    updateGroup: db.prepare(
      'UPDATE groups SET name=?,description=?,member_ids=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
    ),
    deleteGroup: db.prepare('DELETE FROM groups WHERE id=? AND revision=?'),
    reportCount: db.prepare('SELECT COUNT(*) AS count FROM group_reports WHERE group_id=?'),
    insertReport: db.prepare(
      'INSERT INTO group_reports (id,group_id,created_at,document,summary) VALUES (?,?,?,?,?)',
    ),
    reports: db.prepare(
      'SELECT summary FROM group_reports WHERE group_id=? ORDER BY created_at DESC,id ASC',
    ),
    report: db.prepare('SELECT document FROM group_reports WHERE group_id=? AND id=?'),
  };
  let closed = false;
  const get = (id) => groupFromRow(queries.group.get(id));
  function requireCurrent(id, expectedRevision) {
    const group = get(id);
    if (!group) throw new GroupError(404, 'Ce groupe n’existe pas.');
    if (group.revision !== expectedRevision)
      throw new GroupError(
        409,
        'Le groupe a été modifié. Rechargez sa dernière version avant de continuer.',
      );
    return group;
  }
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return {
    list: () => queries.groups.all().map(groupFromRow),
    get,
    requireCurrent,
    create: (draft) =>
      transaction(() => {
        if (queries.groupCount.get().count >= MAX_GROUPS)
          throw new GroupError(
            409,
            'La limite de 100 groupes est atteinte. Supprimez un groupe avant d’en créer un autre.',
          );
        const id = randomUUID();
        const now = new Date().toISOString();
        queries.insertGroup.run(
          id,
          draft.name,
          draft.description,
          JSON.stringify(draft.memberIds),
          now,
          now,
        );
        return get(id);
      }),
    update: (id, draft, expectedRevision) =>
      transaction(() => {
        requireCurrent(id, expectedRevision);
        queries.updateGroup.run(
          draft.name,
          draft.description,
          JSON.stringify(draft.memberIds),
          new Date().toISOString(),
          id,
          expectedRevision,
        );
        return get(id);
      }),
    delete: (id, expectedRevision) =>
      transaction(() => {
        requireCurrent(id, expectedRevision);
        queries.deleteGroup.run(id, expectedRevision);
      }),
    saveReport: (id, expectedRevision, analysis) =>
      transaction(() => {
        const groupSnapshot = requireCurrent(id, expectedRevision);
        if (
          analysis.groupId !== id ||
          analysis.groupRevision !== expectedRevision ||
          JSON.stringify(analysis.memberIds) !== JSON.stringify(groupSnapshot.memberIds)
        )
          throw new GroupError(
            400,
            'L’analyse ne correspond pas à la version enregistrée du groupe.',
          );
        if (queries.reportCount.get(id).count >= MAX_REPORTS)
          throw new GroupError(409, 'La limite de 100 rapports pour ce groupe est atteinte.');
        const report = {
          id: randomUUID(),
          groupId: id,
          createdAt: new Date().toISOString(),
          groupSnapshot,
          analysis,
        };
        queries.insertReport.run(
          report.id,
          id,
          report.createdAt,
          JSON.stringify(report),
          JSON.stringify(reportSummary(report)),
        );
        // Relire le JSON stocké empêche un appelant de modifier l'instantané par référence.
        return JSON.parse(queries.report.get(id, report.id).document);
      }),
    listReports: (id) => queries.reports.all(id).map((row) => JSON.parse(row.summary)),
    getReport: (id, reportId) => {
      const row = queries.report.get(id, reportId);
      return row ? JSON.parse(row.document) : null;
    },
    close: () => {
      if (!closed) {
        db.close();
        closed = true;
      }
    },
  };
}
