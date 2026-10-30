import { Server } from 'miragejs';
import { GroupAnalysis, GroupReport, GroupReportSummary } from '../core/models/groups.models';
import { findGroup, MockError, MockState, readBody, requireRevision, respond } from './mock-store';

const MAX_REPORTS = 100;

// Résumé affiché dans l'historique : sans le détail des paires ni des résolutions.
export function reportSummary(report: GroupReport): GroupReportSummary {
  const { groupSnapshot, analysis } = report;
  return {
    id: report.id,
    groupId: report.groupId,
    createdAt: report.createdAt,
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

export function listReports(state: MockState, groupId: string): GroupReportSummary[] {
  findGroup(state, groupId);
  return state.reports
    .filter((report) => report.groupId === groupId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(reportSummary);
}

export function getReport(state: MockState, groupId: string, reportId: string): GroupReport {
  const report = state.reports.find((item) => item.groupId === groupId && item.id === reportId);
  if (!report) throw new MockError(404, 'Ce rapport n’existe pas pour ce groupe.');
  return report;
}

// Enregistre un instantané figé : la composition du groupe et l'analyse calculée par l'API Node.
export function saveReport(
  state: MockState,
  groupId: string,
  body: Record<string, unknown>,
  now = new Date().toISOString(),
): GroupReport {
  const group = findGroup(state, groupId);
  requireRevision(group, body['expectedRevision']);
  const analysis = body['analysis'] as GroupAnalysis | undefined;
  if (!analysis || !Array.isArray(analysis.memberIds) || !analysis.filters)
    throw new MockError(400, 'L’analyse à enregistrer est absente.');
  if (analysis.memberIds.join(',') !== group.memberIds.join(','))
    throw new MockError(400, 'L’analyse ne correspond pas à la version enregistrée du groupe.');
  if (state.reports.filter((report) => report.groupId === groupId).length >= MAX_REPORTS)
    throw new MockError(409, 'La limite de 100 rapports pour ce groupe est atteinte.');
  const report = {
    id: crypto.randomUUID(),
    groupId,
    createdAt: now,
    groupSnapshot: { ...group, memberIds: group.memberIds.slice() },
    analysis,
  };
  state.reports.push(report);
  return report;
}

// Appelé à la suppression d'un groupe : ses rapports disparaissent avec lui.
export function removeReports(state: MockState, groupId: string): void {
  state.reports = state.reports.filter((report) => report.groupId !== groupId);
}

// Routes /mock-api/groups/:id/reports (le préfixe est fixé dans mock-api.ts).
export function registerReportRoutes(server: Server): void {
  server.get('/groups/:id/reports', (_schema, request) =>
    respond(200, (state) => listReports(state, request.params['id']), false),
  );
  server.get('/groups/:id/reports/:reportId', (_schema, request) =>
    respond(
      200,
      (state) => getReport(state, request.params['id'], request.params['reportId']),
      false,
    ),
  );
  server.post('/groups/:id/reports', (_schema, request) =>
    respond(
      201,
      (state) => saveReport(state, request.params['id'], readBody(request.requestBody)),
      true,
    ),
  );
}
