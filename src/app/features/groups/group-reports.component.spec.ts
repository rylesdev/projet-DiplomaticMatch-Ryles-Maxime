import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Country } from '../../core/models/api.models';
import { GroupAnalysis, GroupReport, GroupReportSummary } from '../../core/models/groups.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { GroupAnalysisViewComponent } from './group-analysis-view.component';
import { GroupReportsComponent } from './group-reports.component';

// Instantanés entièrement fictifs pour ces tests, sans accès à une API réelle ou une base.
const fixtureCountries: Country[] = ['AAA', 'BBB'].map((id) => ({
  id,
  name: `Membre fictif enregistré ${id}`,
  nameEn: `Saved fixture ${id}`,
  voteCount: 5,
  firstYear: 2001,
  lastYear: 2004,
}));

function report(id: string, score: number | null, groupId = 'fixture-group'): GroupReport {
  const coverage =
    score === null ? { from: null, to: null } : { from: '2001-01-01', to: '2004-12-31' };
  const commonVotes = score === null ? 0 : 5;
  const matchingVotes = score === null ? 0 : score / 20;
  const revision = id === 'a' ? 1 : 2;
  return {
    id,
    groupId,
    createdAt: `2026-10-28T${id === 'a' ? '10' : '11'}:00:00.000Z`,
    groupSnapshot: {
      id: groupId,
      name: `Nom du snapshot ${id}`,
      description: 'Groupe fictif enregistré',
      memberIds: ['AAA', 'BBB'],
      revision,
      createdAt: '2026-10-28T09:00:00.000Z',
      updatedAt: '2026-10-28T09:00:00.000Z',
    },
    analysis: {
      groupId,
      groupRevision: revision,
      memberIds: ['AAA', 'BBB'],
      members: fixtureCountries,
      filters: { from: 2001, to: 2004, theme: 'fixture', minVotes: 3 },
      totalPairCount: 1,
      eligiblePairCount: score === null ? 0 : 1,
      commonPairVotes: commonVotes,
      matchingPairVotes: matchingVotes,
      cohesionPercent: score,
      observedResolutionCount: 5,
      coverage,
      pairs: [
        {
          countryA: fixtureCountries[0],
          countryB: fixtureCountries[1],
          commonVoteCount: commonVotes,
          matchingVoteCount: matchingVotes,
          agreementPercent: score,
        },
      ],
      trend: [],
      divisiveResolutions: [],
      dataVersion: 'Fixture dataset v1',
      themeClassificationVersion: 'Fixture themes v1',
      methodVersion: 'Fixture method v1',
    },
  };
}

function summary(value: GroupReport): GroupReportSummary {
  return {
    id: value.id,
    groupId: value.groupId,
    createdAt: value.createdAt,
    groupName: value.groupSnapshot.name,
    groupRevision: value.groupSnapshot.revision,
    memberCount: value.analysis.memberIds.length,
    filters: value.analysis.filters,
    cohesionPercent: value.analysis.cohesionPercent,
    eligiblePairCount: value.analysis.eligiblePairCount,
    totalPairCount: value.analysis.totalPairCount,
    commonPairVotes: value.analysis.commonPairVotes,
    dataVersion: value.analysis.dataVersion,
    themeClassificationVersion: value.analysis.themeClassificationVersion,
    methodVersion: value.analysis.methodVersion,
  };
}

const incompatibleAnalyses: {
  name: string;
  change: (value: GroupAnalysis) => GroupAnalysis;
}[] = [
  { name: 'from', change: (a) => ({ ...a, filters: { ...a.filters, from: 2002 } }) },
  { name: 'to', change: (a) => ({ ...a, filters: { ...a.filters, to: 2003 } }) },
  { name: 'theme', change: (a) => ({ ...a, filters: { ...a.filters, theme: 'another-fixture' } }) },
  { name: 'minVotes', change: (a) => ({ ...a, filters: { ...a.filters, minVotes: 4 } }) },
  { name: 'dataVersion', change: (a) => ({ ...a, dataVersion: 'Fixture dataset v2' }) },
  { name: 'methodVersion', change: (a) => ({ ...a, methodVersion: 'Fixture method v2' }) },
  {
    name: 'themeClassificationVersion',
    change: (a) => ({ ...a, themeClassificationVersion: 'Fixture themes v2' }),
  },
];

describe('GroupReportsComponent', () => {
  let fixture: ComponentFixture<GroupReportsComponent>;
  let component: GroupReportsComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    const diplomatic = {
      themes: vi.fn<DiplomaticApiService['themes']>().mockReturnValue(of([])),
    } satisfies Pick<DiplomaticApiService, 'themes'>;
    await TestBed.configureTestingModule({
      imports: [GroupReportsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DiplomaticApiService, useValue: diplomatic },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupReportsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('groupId', 'fixture-group');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function load(first: GroupReport, second: GroupReport): void {
    const list = http.expectOne(`/api/groups/${first.groupId}/reports`);
    expect(list.request.method).toBe('GET');
    list.flush([summary(second), summary(first)]);
    http.expectOne(`/api/groups/${first.groupId}/reports/${first.id}`).flush(first);
    http.expectOne(`/api/groups/${second.groupId}/reports/${second.id}`).flush(second);
    fixture.detectChanges();
  }

  it.each([
    { a: 20, b: 80, expected: 60 },
    { a: 80, b: 20, expected: -60 },
    { a: 0, b: 0, expected: 0 },
    { a: 0, b: 20, expected: 20 },
  ])('calculates B minus A for compatible reports ($a → $b)', ({ a, b, expected }) => {
    load(report('a', a), report('b', b));

    expect(component.comparable()).toBe(true);
    expect(component.delta()).toBe(expected);
  });

  it.each(incompatibleAnalyses)('refuses a delta when $name differs', ({ change }) => {
    const second = report('b', 80);
    second.analysis = change(second.analysis);
    load(report('a', 20), second);

    expect(component.comparable()).toBe(false);
    expect(component.delta()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.comparison-note')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.report-delta')).toBeNull();
  });

  it.each([
    { a: null, b: 80 },
    { a: 20, b: null },
    { a: null, b: null },
  ])('does not convert a missing percentage to zero ($a → $b)', ({ a, b }) => {
    load(report('a', a), report('b', b));

    expect(component.comparable()).toBe(true);
    expect(component.delta()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.report-delta')).toBeNull();
  });

  it('cancels an obsolete report-list GET when the group changes', () => {
    const obsolete = http.expectOne('/api/groups/fixture-group/reports');
    expect(obsolete.request.method).toBe('GET');

    fixture.componentRef.setInput('groupId', 'other-fixture-group');
    fixture.detectChanges();

    expect(obsolete.cancelled).toBe(true);
    const current = http.expectOne('/api/groups/other-fixture-group/reports');
    current.flush([]);
    expect(component.reports()).toEqual([]);
    expect(component.first()).toBeNull();
    expect(component.second()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('cancels both obsolete detail GETs when another group is selected', () => {
    http
      .expectOne('/api/groups/fixture-group/reports')
      .flush([summary(report('b', 80)), summary(report('a', 20))]);
    const oldFirst = http.expectOne('/api/groups/fixture-group/reports/a');
    const oldSecond = http.expectOne('/api/groups/fixture-group/reports/b');
    expect(component.detailLoading()).toBe(true);

    fixture.componentRef.setInput('groupId', 'other-fixture-group');
    fixture.detectChanges();

    expect(oldFirst.cancelled).toBe(true);
    expect(oldSecond.cancelled).toBe(true);
    expect(component.first()).toBeNull();
    expect(component.second()).toBeNull();
    expect(component.detailLoading()).toBe(false);
    load(report('a', 80, 'other-fixture-group'), report('b', 20, 'other-fixture-group'));
    expect(component.first()?.groupId).toBe('other-fixture-group');
    expect(component.delta()).toBe(-60);
  });

  it('renders the saved snapshots and passes their analyses to the report views', () => {
    const first = report('a', 20);
    const second = report('b', 80);
    const list = http.expectOne('/api/groups/fixture-group/reports');
    list.flush([
      { ...summary(second), groupName: 'Nom courant à ignorer', groupRevision: 99 },
      { ...summary(first), groupName: 'Nom courant à ignorer', groupRevision: 99 },
    ]);
    http.expectOne('/api/groups/fixture-group/reports/a').flush(first);
    http.expectOne('/api/groups/fixture-group/reports/b').flush(second);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Nom du snapshot a');
    expect(text).toContain('Nom du snapshot b');
    expect(text).toContain('Membre fictif enregistré AAA');
    expect(text).not.toContain('Nom courant à ignorer');
    const views = fixture.debugElement.queryAll(By.directive(GroupAnalysisViewComponent));
    expect(
      views.map((view) => (view.componentInstance as GroupAnalysisViewComponent).analysis),
    ).toEqual([first.analysis, second.analysis]);
    http.expectNone('/api/groups/fixture-group');
    http.expectNone((request) => request.method !== 'GET');
  });
});
