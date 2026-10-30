import { GroupAnalysis } from '../core/models/groups.models';
import { createGroup, updateGroup } from './groups.routes';
import { MockError, MockState } from './mock-store';
import { getReport, listReports, saveReport } from './reports.routes';

// Analyse fictive : seuls les champs utiles au rapport et à son résumé sont renseignés.
function analysis(memberIds: string[]): GroupAnalysis {
  return {
    memberIds,
    filters: { from: 2000, to: 2025, theme: 'all', minVotes: 20 },
    cohesionPercent: 55.1,
    eligiblePairCount: 1,
    totalPairCount: 1,
    commonPairVotes: 10,
    dataVersion: 'Fixture',
    themeClassificationVersion: 'Fixture-thèmes',
    methodVersion: 'Fixture-méthode',
  } as GroupAnalysis;
}

function statusOf(work: () => unknown): number | undefined {
  try {
    work();
  } catch (error) {
    if (error instanceof MockError) return error.status;
    throw error;
  }
  return undefined;
}

describe('mock API: report rules', () => {
  let state: MockState;
  let groupId: string;

  beforeEach(() => {
    state = { groups: [], reports: [] };
    groupId = createGroup(state, { name: 'Groupe', memberIds: ['FRA', 'IND'] }).id;
  });

  it('saves a frozen snapshot of the group and of the analysis', () => {
    const report = saveReport(state, groupId, {
      expectedRevision: 1,
      analysis: analysis(['FRA', 'IND']),
    });
    updateGroup(state, groupId, {
      name: 'Renommé',
      memberIds: ['FRA', 'IND'],
      expectedRevision: 1,
    });
    const saved = getReport(state, groupId, report.id);
    expect(saved.groupSnapshot.name).toBe('Groupe');
    expect(saved.groupSnapshot.revision).toBe(1);
    expect(saved.analysis.cohesionPercent).toBe(55.1);
  });

  it('refuses an outdated revision or an analysis of other members', () => {
    expect(
      statusOf(() =>
        saveReport(state, groupId, { expectedRevision: 2, analysis: analysis(['FRA', 'IND']) }),
      ),
    ).toBe(409);
    expect(
      statusOf(() =>
        saveReport(state, groupId, { expectedRevision: 1, analysis: analysis(['FRA', 'USA']) }),
      ),
    ).toBe(400);
    expect(statusOf(() => saveReport(state, groupId, { expectedRevision: 1 }))).toBe(400);
  });

  it('lists summaries from the newest and returns 404 for an unknown report', () => {
    saveReport(
      state,
      groupId,
      { expectedRevision: 1, analysis: analysis(['FRA', 'IND']) },
      '2026-01-01',
    );
    saveReport(
      state,
      groupId,
      { expectedRevision: 1, analysis: analysis(['FRA', 'IND']) },
      '2026-02-01',
    );
    const summaries = listReports(state, groupId);
    expect(summaries.map((summary) => summary.createdAt)).toEqual(['2026-02-01', '2026-01-01']);
    expect(summaries[0]).toEqual(
      expect.objectContaining({ groupName: 'Groupe', memberCount: 2, cohesionPercent: 55.1 }),
    );
    expect(statusOf(() => getReport(state, groupId, 'inconnu'))).toBe(404);
  });
});
