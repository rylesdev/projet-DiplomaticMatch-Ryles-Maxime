import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Country } from '../../core/models/api.models';
import {
  CountryGroup,
  GroupAnalysis,
  GroupAnalysisFilters,
  GroupSuggestions,
} from '../../core/models/groups.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { GroupsApiService } from '../../core/services/groups-api.service';
import { GroupScenariosComponent } from './group-scenarios.component';

// Fixtures fictives réservées aux tests : aucun vote ONU ni groupe persistant.
const countries: Country[] = ['AAA', 'BBB', 'CCC', 'DDD'].map((id) => ({
  id,
  name: `Pays fictif ${id}`,
  nameEn: `Test fixture ${id}`,
  voteCount: 5,
  firstYear: 2001,
  lastYear: 2004,
}));
const filters: GroupAnalysisFilters = { from: 2001, to: 2004, theme: 'fixture', minVotes: 3 };
const savedGroup: CountryGroup = {
  id: 'fixture-group',
  name: 'Groupe fictif',
  description: 'Fixture de test',
  memberIds: ['AAA', 'BBB'],
  revision: 7,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
};

function analysis(memberIds: string[]): GroupAnalysis {
  const members = memberIds.map((id) => countries.find((country) => country.id === id)!);
  const coverage = { from: '2001-01-01', to: '2004-12-31' };
  const pairs = members.flatMap((countryA, index) =>
    members.slice(index + 1).map((countryB) => ({
      countryA,
      countryB,
      commonVoteCount: 5,
      matchingVoteCount: 3,
      agreementPercent: 60,
      coverage,
    })),
  );
  return {
    groupId: savedGroup.id,
    groupRevision: savedGroup.revision,
    memberIds,
    members,
    filters: { ...filters },
    totalPairCount: pairs.length,
    eligiblePairCount: pairs.length,
    commonPairVotes: pairs.length * 5,
    matchingPairVotes: pairs.length * 3,
    cohesionPercent: 60,
    observedResolutionCount: 5,
    coverage,
    pairs,
    trend: [],
    divisiveResolutions: [],
    dataVersion: 'Fixture dataset v1',
    themeClassificationVersion: 'Fixture themes v1',
    methodVersion: 'Fixture method v1',
  };
}

describe('GroupScenariosComponent', () => {
  let fixture: ComponentFixture<GroupScenariosComponent>;
  let component: GroupScenariosComponent;
  let http: HttpTestingController;
  let api: GroupsApiService;

  beforeEach(async () => {
    const diplomatic = {
      countries: vi.fn<DiplomaticApiService['countries']>().mockReturnValue(of(countries)),
    } satisfies Pick<DiplomaticApiService, 'countries'>;
    await TestBed.configureTestingModule({
      imports: [GroupScenariosComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DiplomaticApiService, useValue: diplomatic },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(GroupsApiService);
    fixture = TestBed.createComponent(GroupScenariosComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', { ...savedGroup, memberIds: [...savedGroup.memberIds] });
    fixture.componentRef.setInput('filters', { ...filters });
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
  });

  it('posts only a preview with the proposed members, revision and applied filters until apply', () => {
    const update = vi.spyOn(api, 'updateGroup');
    const applied = vi.fn<(ids: string[]) => void>();
    component.applyMembers.subscribe(applied);
    component.form.controls.countryId.setValue('CCC');

    component.simulate();

    const request = http.expectOne('/api/groups/fixture-group/preview');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ...filters,
      expectedRevision: 7,
      memberIds: ['AAA', 'BBB', 'CCC'],
    });
    expect(component.group.memberIds).toEqual(['AAA', 'BBB']);
    expect(update).not.toHaveBeenCalled();
    expect(applied).not.toHaveBeenCalled();

    // L'ordre retourné diffère volontairement de celui du formulaire.
    request.flush(analysis(['CCC', 'AAA', 'BBB']));
    expect(applied).not.toHaveBeenCalled();
    component.apply();

    expect(applied).toHaveBeenCalledExactlyOnceWith(['CCC', 'AAA', 'BBB']);
    expect(update).not.toHaveBeenCalled();
    expect(component.group.memberIds).toEqual(['AAA', 'BBB']);
  });

  it('previews removal without mutating the saved composition', () => {
    fixture.componentRef.setInput('group', { ...savedGroup, memberIds: ['AAA', 'BBB', 'CCC'] });
    fixture.detectChanges();
    component.form.patchValue({ mode: 'remove', countryId: 'BBB' });

    component.simulate();

    const request = http.expectOne('/api/groups/fixture-group/preview');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ...filters,
      expectedRevision: 7,
      memberIds: ['AAA', 'CCC'],
    });
    request.flush(analysis(['AAA', 'CCC']));
    expect(component.group.memberIds).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('cancels an in-flight preview when the selected country changes', () => {
    component.form.controls.countryId.setValue('CCC');
    component.simulate();
    const obsolete = http.expectOne('/api/groups/fixture-group/preview');
    expect(component.loading()).toBe(true);

    component.form.controls.countryId.setValue('DDD');

    expect(obsolete.cancelled).toBe(true);
    expect(component.preview()).toBeNull();
    expect(component.loading()).toBe(false);
    component.simulate();
    const current = http.expectOne('/api/groups/fixture-group/preview');
    current.flush(analysis(['AAA', 'BBB', 'DDD']));
    expect(component.preview()?.memberIds).toEqual(['AAA', 'BBB', 'DDD']);
  });

  it('does not apply a preview calculated for an obsolete group revision', () => {
    const applied = vi.fn<(ids: string[]) => void>();
    component.applyMembers.subscribe(applied);
    component.form.controls.countryId.setValue('CCC');
    component.simulate();
    http.expectOne('/api/groups/fixture-group/preview').flush({
      ...analysis(['AAA', 'BBB', 'CCC']),
      groupRevision: 6,
    });

    component.apply();

    expect(applied).not.toHaveBeenCalled();
  });

  it('passes includeHistorical and cancels the obsolete suggestions when it changes', () => {
    component.requestSuggestions();
    const obsolete = http.expectOne('/api/groups/fixture-group/suggestions');
    expect(obsolete.request.method).toBe('POST');
    expect(obsolete.request.body).toEqual({
      ...filters,
      expectedRevision: 7,
      includeHistorical: false,
    });

    component.historicalChanged(true);

    expect(obsolete.cancelled).toBe(true);
    const current = http.expectOne('/api/groups/fixture-group/suggestions');
    expect(current.request.method).toBe('POST');
    expect(current.request.body).toEqual({
      ...filters,
      expectedRevision: 7,
      includeHistorical: true,
    });
    const response: GroupSuggestions = {
      groupId: savedGroup.id,
      groupRevision: 7,
      filters,
      suggestions: [],
      eligibleCandidateCount: 0,
      excludedCandidateCount: 2,
      dataVersion: 'Fixture dataset v1',
      methodVersion: 'Fixture method v1',
      includeHistorical: true,
    };
    current.flush(response);
    expect(component.suggestions()).toEqual(response);
    expect(component.suggesting()).toBe(false);
  });
});
