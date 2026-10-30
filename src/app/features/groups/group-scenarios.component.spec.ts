import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Country } from '../../core/models/api.models';
import { CountryGroup, GroupAnalysis, GroupAnalysisFilters } from '../../core/models/groups.models';
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

// Réponse de l'API Node : sans groupId ni groupRevision, ajoutés par GroupAnalysisService.
function analysis(memberIds: string[]): Omit<GroupAnalysis, 'groupId' | 'groupRevision'> {
  const members = memberIds.map((id) => countries.find((country) => country.id === id)!);
  const coverage = { from: '2001-01-01', to: '2004-12-31' };
  const pairs = members.flatMap((countryA, index) =>
    members.slice(index + 1).map((countryB) => ({
      countryA,
      countryB,
      commonVoteCount: 5,
      matchingVoteCount: 3,
      agreementPercent: 60,
    })),
  );
  return {
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

  // L'aperçu vérifie la version enregistrée (API mockée), puis analyse la composition (API Node).
  function answerPreview(memberIds: string[], savedRevision = savedGroup.revision): void {
    http
      .expectOne('/mock-api/groups/fixture-group')
      .flush({ ...savedGroup, revision: savedRevision });
    if (savedRevision !== savedGroup.revision) return;
    const request = http.expectOne((request) => request.url === '/api/groups/analysis');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('members')).toBe(memberIds.join(','));
    expect(request.request.params.get('theme')).toBe(filters.theme);
    expect(request.request.params.get('minVotes')).toBe(String(filters.minVotes));
    request.flush(analysis(memberIds));
  }

  it('only previews the proposed members with the applied filters until apply', () => {
    const update = vi.spyOn(api, 'updateGroup');
    const applied = vi.fn<(ids: string[]) => void>();
    component.applyMembers.subscribe(applied);
    component.form.controls.countryId.setValue('CCC');

    component.simulate();
    answerPreview(['AAA', 'BBB', 'CCC']);

    expect(component.group.memberIds).toEqual(['AAA', 'BBB']);
    expect(component.preview()?.groupRevision).toBe(7);
    expect(applied).not.toHaveBeenCalled();
    component.apply();

    expect(applied).toHaveBeenCalledExactlyOnceWith(['AAA', 'BBB', 'CCC']);
    expect(update).not.toHaveBeenCalled();
    expect(component.group.memberIds).toEqual(['AAA', 'BBB']);
  });

  it('previews removal without mutating the saved composition', () => {
    fixture.componentRef.setInput('group', { ...savedGroup, memberIds: ['AAA', 'BBB', 'CCC'] });
    fixture.detectChanges();
    component.form.patchValue({ mode: 'remove', countryId: 'BBB' });

    component.simulate();
    answerPreview(['AAA', 'CCC']);

    expect(component.group.memberIds).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('cancels an in-flight preview when the selected country changes', () => {
    component.form.controls.countryId.setValue('CCC');
    component.simulate();
    const obsolete = http.expectOne('/mock-api/groups/fixture-group');
    expect(component.loading()).toBe(true);

    component.form.controls.countryId.setValue('DDD');

    expect(obsolete.cancelled).toBe(true);
    expect(component.preview()).toBeNull();
    expect(component.loading()).toBe(false);
    component.simulate();
    answerPreview(['AAA', 'BBB', 'DDD']);
    expect(component.preview()?.memberIds).toEqual(['AAA', 'BBB', 'DDD']);
  });

  it('refuses a preview when the group was modified elsewhere', () => {
    const applied = vi.fn<(ids: string[]) => void>();
    component.applyMembers.subscribe(applied);
    component.form.controls.countryId.setValue('CCC');
    component.simulate();
    answerPreview(['AAA', 'BBB', 'CCC'], 8);

    expect(component.preview()).toBeNull();
    expect(component.error()).toContain('a été modifié');
    component.apply();
    expect(applied).not.toHaveBeenCalled();
  });
});
