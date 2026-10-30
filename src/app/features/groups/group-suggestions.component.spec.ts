import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CountryGroup, GroupAnalysisFilters } from '../../core/models/groups.models';
import { GroupSuggestionsComponent } from './group-suggestions.component';

// Fixtures fictives réservées aux tests.
const filters: GroupAnalysisFilters = { from: 2001, to: 2004, theme: 'fixture', minVotes: 3 };
const savedGroup: CountryGroup = {
  id: 'fixture-group',
  name: 'Groupe fictif',
  description: '',
  memberIds: ['AAA', 'BBB'],
  revision: 7,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
};
const response = {
  filters,
  suggestions: [],
  eligibleCandidateCount: 0,
  excludedCandidateCount: 2,
  dataVersion: 'Fixture dataset v1',
  methodVersion: 'Fixture method v1',
  includeHistorical: true,
};

describe('GroupSuggestionsComponent', () => {
  let fixture: ComponentFixture<GroupSuggestionsComponent>;
  let component: GroupSuggestionsComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupSuggestionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupSuggestionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', savedGroup);
    fixture.componentRef.setInput('filters', filters);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('checks the saved revision, passes includeHistorical and cancels obsolete suggestions', () => {
    component.request();
    const obsolete = http.expectOne('/mock-api/groups/fixture-group');

    component.historicalChanged(true);

    expect(obsolete.cancelled).toBe(true);
    http.expectOne('/mock-api/groups/fixture-group').flush(savedGroup);
    const current = http.expectOne((request) => request.url === '/api/groups/suggestions');
    expect(current.request.method).toBe('GET');
    expect(current.request.params.get('members')).toBe('AAA,BBB');
    expect(current.request.params.get('includeHistorical')).toBe('true');
    current.flush(response);
    expect(component.suggestions()).toEqual({
      ...response,
      groupId: 'fixture-group',
      groupRevision: 7,
    });
    expect(component.suggesting()).toBe(false);
  });

  it('shows the conflict message when the group was modified elsewhere', () => {
    component.request();
    http.expectOne('/mock-api/groups/fixture-group').flush({ ...savedGroup, revision: 8 });
    expect(component.suggestions()).toBeNull();
    expect(component.error()).toContain('a été modifié');
  });

  it('keeps the list while a scenario is calculated, and clears it for another group', () => {
    component.request();
    http.expectOne('/mock-api/groups/fixture-group').flush(savedGroup);
    http.expectOne((request) => request.url === '/api/groups/suggestions').flush(response);

    fixture.componentRef.setInput('testing', true);
    fixture.detectChanges();
    expect(component.suggestions()).not.toBeNull();

    fixture.componentRef.setInput('group', { ...savedGroup, id: 'other-group' });
    fixture.detectChanges();
    expect(component.suggestions()).toBeNull();
  });
});
