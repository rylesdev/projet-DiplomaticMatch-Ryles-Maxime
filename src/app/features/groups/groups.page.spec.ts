import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { CountryGroup, GroupAnalysis, GroupAnalysisFilters } from '../../core/models/groups.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { GroupsApiService } from '../../core/services/groups-api.service';
import { GroupAnalysisViewComponent } from './group-analysis-view.component';
import { GroupReportsComponent } from './group-reports.component';
import { GroupScenariosComponent } from './group-scenarios.component';
import { GroupsPage } from './groups.page';

@Component({ selector: 'app-group-analysis-view', template: '' })
class AnalysisStub {
  @Input() analysis!: GroupAnalysis;
  @Input() themeLabel = '';
}
@Component({ selector: 'app-group-scenarios', template: '' })
class ScenariosStub {
  @Input() group!: CountryGroup;
  @Input() filters!: GroupAnalysisFilters;
  @Input() baseAnalysis: GroupAnalysis | null = null;
  @Input() disabled = false;
  @Output() applyMembers = new EventEmitter<string[]>();
}
@Component({ selector: 'app-group-reports', template: '' })
class ReportsStub {
  @Input() groupId = '';
  @Input() refreshKey = 0;
}

// Fixtures de test uniquement : aucune donnée fictive dans la base de l’application.
const savedGroup: CountryGroup = {
  id: 'saved',
  name: 'Groupe de test',
  description: 'Description enregistrée',
  memberIds: ['TST', 'OTHER'],
  revision: 1,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};
const fixtureCountry = {
  id: 'TST',
  name: 'Pays de test',
  nameEn: 'Test fixture',
  voteCount: 0,
  firstYear: 2000,
  lastYear: 2025,
};
function analysis(filters: GroupAnalysisFilters): GroupAnalysis {
  return {
    groupId: savedGroup.id,
    groupRevision: 1,
    memberIds: savedGroup.memberIds,
    members: [fixtureCountry, { ...fixtureCountry, id: 'OTHER' }],
    filters,
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
        differingVoteCount: 0,
        agreementPercent: null,
        eligible: false,
        coverage: { from: null, to: null },
      },
    ],
    trend: [],
    divisiveResolutions: [],
    dataVersion: 'Fixture',
    themeClassificationVersion: 'Fixture',
    methodVersion: 'Fixture',
  };
}

describe('GroupsPage saved-state actions', () => {
  let fixture: ComponentFixture<GroupsPage>;
  let page: GroupsPage;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let api: {
    getGroups: ReturnType<typeof vi.fn>;
    getGroup: ReturnType<typeof vi.fn>;
    createGroup: ReturnType<typeof vi.fn>;
    updateGroup: ReturnType<typeof vi.fn>;
    deleteGroup: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
    saveReport: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ id: 'saved' }));
    api = {
      getGroups: vi.fn().mockReturnValue(of([savedGroup])),
      getGroup: vi.fn().mockReturnValue(of(savedGroup)),
      createGroup: vi.fn().mockReturnValue(of({ ...savedGroup, id: 'created' })),
      updateGroup: vi.fn().mockReturnValue(of({ ...savedGroup, revision: 2 })),
      deleteGroup: vi.fn().mockReturnValue(of(undefined)),
      preview: vi.fn().mockImplementation((_id, request) =>
        of(
          analysis({
            from: request.from,
            to: request.to,
            theme: request.theme,
            minVotes: request.minVotes,
          }),
        ),
      ),
      saveReport: vi.fn().mockReturnValue(of({ id: 'report' })),
    };
    TestBed.configureTestingModule({
      imports: [GroupsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: GroupsApiService, useValue: api },
        {
          provide: DiplomaticApiService,
          useValue: {
            countries: () => of([fixtureCountry, { ...fixtureCountry, id: 'OTHER' }]),
            themes: () =>
              of([
                {
                  id: 'all',
                  label: 'Tous les thèmes',
                  description: 'Fixture',
                  resolutionCount: 0,
                  recordedVoteResolutionCount: 0,
                },
                {
                  id: 'environment',
                  label: 'Écologie de test',
                  description: 'Fixture',
                  resolutionCount: 0,
                  recordedVoteResolutionCount: 0,
                },
              ]),
          },
        },
      ],
    });
    TestBed.overrideComponent(GroupsPage, {
      remove: {
        imports: [GroupAnalysisViewComponent, GroupScenariosComponent, GroupReportsComponent],
      },
      add: { imports: [AnalysisStub, ScenariosStub, ReportsStub] },
    });
    await TestBed.compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  function create(): void {
    fixture = TestBed.createComponent(GroupsPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('blocks analyses and new reports while the group has unsaved edits', () => {
    create();
    expect(page.dirty()).toBe(false);
    page.editor.controls.name.setValue('Brouillon non enregistré');
    page.analyze();
    page.saveReport();
    fixture.detectChanges();
    expect(page.dirty()).toBe(true);
    expect(api.preview).not.toHaveBeenCalled();
    expect(api.saveReport).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enregistrez les modifications du groupe',
    );
  });

  it('preserves a conflicting draft until the user explicitly reloads the saved revision', () => {
    create();
    api.updateGroup.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { error: 'Stale revision' } })),
    );
    page.editor.controls.name.setValue('Mon brouillon');
    page.save();
    fixture.detectChanges();
    expect(page.conflict()).toBe(true);
    expect(page.editor.controls.name.value).toBe('Mon brouillon');
    expect(page.group()?.revision).toBe(1);
    expect(api.getGroup).toHaveBeenCalledTimes(1);
    api.getGroup.mockReturnValue(of({ ...savedGroup, name: 'Version récente', revision: 2 }));
    page.reloadGroup();
    fixture.detectChanges();
    expect(page.editor.controls.name.value).toBe('Version récente');
    expect(page.group()?.revision).toBe(2);
    expect(page.conflict()).toBe(false);
    expect(page.dirty()).toBe(false);
  });

  it('previews saved members and saves reports only with the applied filter snapshot', () => {
    create();
    page.filters.setValue({ from: 2010, to: 2020, theme: 'environment', minVotes: 5 });
    page.analyze();
    fixture.detectChanges();
    expect(api.preview).toHaveBeenLastCalledWith('saved', {
      from: 2010,
      to: 2020,
      theme: 'environment',
      minVotes: 5,
      expectedRevision: 1,
    });
    expect(page.appliedFilters()).toEqual({
      from: 2010,
      to: 2020,
      theme: 'environment',
      minVotes: 5,
    });
    page.filters.controls.theme.setValue('all');
    page.saveReport();
    expect(api.saveReport).not.toHaveBeenCalled();
    page.filters.controls.theme.setValue('environment');
    page.saveReport();
    expect(api.saveReport).toHaveBeenLastCalledWith('saved', {
      from: 2010,
      to: 2020,
      theme: 'environment',
      minVotes: 5,
      expectedRevision: 1,
    });
    expect(page.reportRefresh()).toBe(1);
  });

  it('creates a group only after a name and at least two countries are selected', () => {
    create();
    page.startNew();
    page.editor.controls.name.setValue('Nouveau groupe');
    page.changeMembers(['TST']);
    page.save();
    expect(api.createGroup).not.toHaveBeenCalled();
    page.changeMembers(['TST', 'OTHER']);
    page.save();
    expect(api.createGroup).toHaveBeenLastCalledWith({
      name: 'Nouveau groupe',
      description: '',
      memberIds: ['TST', 'OTHER'],
    });
    expect(navigate).toHaveBeenLastCalledWith(['/groupes', 'created']);
  });

  it('refuses a name shorter than 2 characters once trimmed, like the server', () => {
    create();
    page.startNew();
    page.changeMembers(['TST', 'OTHER']);
    page.editor.controls.name.setValue('  A  ');
    page.save();
    expect(api.createGroup).not.toHaveBeenCalled();
    page.editor.controls.name.setValue('AB');
    page.save();
    expect(api.createGroup).toHaveBeenCalled();
  });

  it('requires the inline delete confirmation and announces removal of saved reports', () => {
    create();
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.delete-button')!.click();
    fixture.detectChanges();
    expect(api.deleteGroup).not.toHaveBeenCalled();
    expect(compiled.querySelector('.delete-confirmation')?.textContent).toContain(
      'tous ses rapports enregistrés',
    );
    api.getGroups.mockReturnValue(of([]));
    Array.from(compiled.querySelectorAll<HTMLButtonElement>('.delete-confirmation button'))
      .find((button) => button.textContent?.includes('Confirmer la suppression'))!
      .click();
    fixture.detectChanges();
    expect(api.deleteGroup).toHaveBeenLastCalledWith('saved', 1);
    expect(page.group()).toBeNull();
    expect(page.groups()).toEqual([]);
    expect(navigate).toHaveBeenLastCalledWith(['/groupes']);
  });

  it('applies a scenario through the saved revision and reloads the group', () => {
    create();
    api.getGroup.mockReturnValue(of({ ...savedGroup, memberIds: ['TST', 'THIRD'], revision: 2 }));
    page.applyMembers(['TST', 'THIRD']);
    expect(api.updateGroup).toHaveBeenLastCalledWith(
      'saved',
      { name: savedGroup.name, description: savedGroup.description, memberIds: ['TST', 'THIRD'] },
      1,
    );
    expect(api.getGroup).toHaveBeenCalledTimes(2);
    expect(page.group()?.memberIds).toEqual(['TST', 'THIRD']);
    expect(page.group()?.revision).toBe(2);
  });

  it('cancels an obsolete selection request when the route changes', () => {
    const first = new Subject<CountryGroup>();
    const second = new Subject<CountryGroup>();
    api.getGroup.mockReturnValueOnce(first).mockReturnValueOnce(second);
    create();
    params.next(convertToParamMap({ id: 'other-group' }));
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    second.next({ ...savedGroup, id: 'other-group' });
    second.complete();
    fixture.detectChanges();
    expect(page.group()?.id).toBe('other-group');
  });
});
