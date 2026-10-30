import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  CountryGroup,
  GroupAnalysis,
  GroupAnalysisRequest,
  GroupReport,
} from '../models/groups.models';
import { GroupsApiService, groupErrorMessage } from './groups-api.service';

// Fixtures fictives : uniquement destinées aux tests de contrat HTTP.
const fixtureCountry = {
  id: 'TST',
  name: 'Pays de test',
  nameEn: 'Test fixture',
  voteCount: 0,
  firstYear: 2000,
  lastYear: 2025,
};
const fixtureGroup: CountryGroup = {
  id: 'group/test',
  name: 'Groupe de test',
  description: 'Fixture',
  memberIds: ['TST', 'OTHER'],
  revision: 1,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};
const fixtureInput: GroupAnalysisRequest = {
  from: 2000,
  to: 2025,
  theme: 'all',
  minVotes: 20,
  expectedRevision: 1,
};
const fixtureAnalysis: GroupAnalysis = {
  groupId: fixtureGroup.id,
  groupRevision: 1,
  memberIds: fixtureGroup.memberIds,
  members: [fixtureCountry, { ...fixtureCountry, id: 'OTHER' }],
  filters: { from: 2000, to: 2025, theme: 'all', minVotes: 20 },
  totalPairCount: 1,
  eligiblePairCount: 0,
  commonPairVotes: 0,
  matchingPairVotes: 0,
  cohesionPercent: null,
  observedResolutionCount: 0,
  coverage: { from: null, to: null },
  pairs: [
    {
      countryA: fixtureCountry,
      countryB: { ...fixtureCountry, id: 'OTHER' },
      commonVoteCount: 0,
      matchingVoteCount: 0,
      agreementPercent: null,
    },
  ],
  trend: [],
  divisiveResolutions: [],
  dataVersion: 'Fixture',
  themeClassificationVersion: 'Fixture-thèmes',
  methodVersion: 'Fixture-méthode',
};
const fixtureReport: GroupReport = {
  id: 'report/test',
  groupId: fixtureGroup.id,
  createdAt: '2026-10-28T12:01:00.000Z',
  groupSnapshot: fixtureGroup,
  analysis: fixtureAnalysis,
};

describe('GroupsApiService', () => {
  let api: GroupsApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GroupsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads a typed group list and encodes a selected group identifier', () => {
    const list = vi.fn();
    const selected = vi.fn();
    api.getGroups().subscribe(list);
    api.getGroup(fixtureGroup.id).subscribe(selected);
    http.expectOne('/api/groups').flush([fixtureGroup]);
    http.expectOne('/api/groups/group%2Ftest').flush(fixtureGroup);
    expect(list).toHaveBeenCalledWith([fixtureGroup]);
    expect(selected).toHaveBeenCalledWith(fixtureGroup);
  });

  it('creates a group with a JSON draft and returns the created group', () => {
    const next = vi.fn();
    const draft = {
      name: 'Nouveau groupe',
      description: 'Description',
      memberIds: ['TST', 'OTHER'],
    };
    api.createGroup(draft).subscribe(next);
    const request = http.expectOne('/api/groups');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(draft);
    request.flush({ ...fixtureGroup, ...draft }, { status: 201, statusText: 'Created' });
    expect(next).toHaveBeenCalledWith({ ...fixtureGroup, ...draft });
  });

  it('patches the draft with its expected revision and deletes through a revision query', () => {
    const draft = { name: 'Nom modifié', description: '', memberIds: ['TST', 'OTHER'] };
    api.updateGroup(fixtureGroup.id, draft, 7).subscribe();
    const update = http.expectOne('/api/groups/group%2Ftest');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ ...draft, expectedRevision: 7 });
    update.flush({ ...fixtureGroup, ...draft, revision: 8 });
    api.deleteGroup(fixtureGroup.id, 8).subscribe();
    const remove = http.expectOne((request) => request.url === '/api/groups/group%2Ftest');
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.params.get('expectedRevision')).toBe('8');
    expect(remove.request.body).toBeNull();
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('allows a temporary composition only in a preview request', () => {
    const next = vi.fn();
    const input = { ...fixtureInput, memberIds: ['TST', 'THIRD'] };
    api.preview(fixtureGroup.id, input).subscribe(next);
    const request = http.expectOne('/api/groups/group%2Ftest/preview');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush(fixtureAnalysis);
    expect(next).toHaveBeenCalledWith(fixtureAnalysis);
  });

  it('saves and retrieves a report with a frozen group and analysis', () => {
    const next = vi.fn();
    api.saveReport(fixtureGroup.id, fixtureInput).subscribe(next);
    const request = http.expectOne('/api/groups/group%2Ftest/reports');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(fixtureInput);
    expect(request.request.body.memberIds).toBeUndefined();
    request.flush(fixtureReport, { status: 201, statusText: 'Created' });
    expect(next).toHaveBeenCalledWith(fixtureReport);
    api.report(fixtureGroup.id, fixtureReport.id).subscribe(next);
    http.expectOne('/api/groups/group%2Ftest/reports/report%2Ftest').flush(fixtureReport);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('loads report history summaries', () => {
    const next = vi.fn();
    api.reports(fixtureGroup.id).subscribe(next);
    const summary = {
      id: fixtureReport.id,
      groupId: fixtureGroup.id,
      createdAt: fixtureReport.createdAt,
      groupName: fixtureGroup.name,
      groupRevision: 1,
      memberCount: 2,
      filters: fixtureAnalysis.filters,
      cohesionPercent: null,
      eligiblePairCount: 0,
      totalPairCount: 1,
      commonPairVotes: 0,
      dataVersion: 'Fixture',
      themeClassificationVersion: 'Fixture-thèmes',
      methodVersion: 'Fixture-méthode',
    };
    http.expectOne('/api/groups/group%2Ftest/reports').flush([summary]);
    expect(next).toHaveBeenCalledWith([summary]);
  });

  it('sends the historical-candidate choice and returns its response flag', () => {
    const next = vi.fn();
    const input = { ...fixtureInput, includeHistorical: true };
    api.suggestions(fixtureGroup.id, input).subscribe(next);
    const request = http.expectOne('/api/groups/group%2Ftest/suggestions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({
      groupId: fixtureGroup.id,
      groupRevision: 1,
      filters: fixtureAnalysis.filters,
      suggestions: [],
      eligibleCandidateCount: 0,
      excludedCandidateCount: 200,
      dataVersion: 'Fixture',
      methodVersion: 'Fixture-méthode',
      includeHistorical: true,
    });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ includeHistorical: true, suggestions: [] }),
    );
  });

  it('turns a conflict into an explicit reload instruction without retrying the write', () => {
    const error = vi.fn();
    api
      .updateGroup(
        fixtureGroup.id,
        { name: 'Draft', description: '', memberIds: fixtureGroup.memberIds },
        1,
      )
      .subscribe({ error });
    http
      .expectOne('/api/groups/group%2Ftest')
      .flush({ error: 'Stale revision' }, { status: 409, statusText: 'Conflict' });
    const failure = error.mock.calls[0][0];
    expect(groupErrorMessage(failure)).toContain('Rechargez-le');
    expect(groupErrorMessage(failure)).toContain('pas écrasées automatiquement');
    http.expectNone('/api/groups/group%2Ftest');
  });

  it('keeps server validation messages as text for 400, 413 and 415 responses', () => {
    expect(
      groupErrorMessage(
        new HttpErrorResponse({
          status: 400,
          error: { error: 'Nom invalide <script>fixture</script>' },
        }),
      ),
    ).toBe('Nom invalide <script>fixture</script>');
    expect(
      groupErrorMessage(
        new HttpErrorResponse({ status: 413, error: { message: 'Corps trop volumineux' } }),
      ),
    ).toBe('Corps trop volumineux');
    expect(
      groupErrorMessage(new HttpErrorResponse({ status: 415, error: { error: 'JSON requis' } })),
    ).toBe('JSON requis');
  });
});
