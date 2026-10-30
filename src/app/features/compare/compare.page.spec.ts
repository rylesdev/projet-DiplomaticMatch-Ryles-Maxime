import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ComparisonResult } from '../../core/models/api.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { ComparePage } from './compare.page';
import { DataPeriodService } from '../../core/services/data-period.service';

// Fixtures fictives pour les parcours du formulaire, jamais affichées dans l’application réelle.
const fixtureCountry = {
  id: 'TST',
  name: 'Pays fictif',
  nameEn: 'Test fixture',
  voteCount: 0,
  firstYear: 2000,
  lastYear: 2025,
};
const fixtureComparison: ComparisonResult = {
  countryA: fixtureCountry,
  countryB: { ...fixtureCountry, id: 'OTHER' },
  from: 2000,
  to: 2025,
  agreementPercent: null,
  commonVoteCount: 0,
  matchingVoteCount: 0,
  differingVoteCount: 0,
  nonComparableCount: 0,
  coverage: { from: null, to: null },
  divergences: [],
  dataVersion: 'Fixture de test',
  theme: 'security',
};

describe('ComparePage theme filters', () => {
  let fixture: ComponentFixture<ComparePage>;
  let compare: ReturnType<typeof vi.fn>;
  let trend: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    compare = vi.fn().mockReturnValue(of(fixtureComparison));
    trend = vi.fn().mockReturnValue(
      of({
        countryA: fixtureCountry,
        countryB: { ...fixtureCountry, id: 'OTHER' },
        from: 2000,
        to: 2025,
        interval: 'year',
        points: [],
        dataVersion: 'Fixture de test',
        theme: 'security',
      }),
    );
    await TestBed.configureTestingModule({
      imports: [ComparePage],
      providers: [
        { provide: DataPeriodService, useValue: { firstYear: 1946, lastYear: 2025 } },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ theme: 'security' })) },
        },
        {
          provide: DiplomaticApiService,
          useValue: {
            compare,
            trend,
            countries: () => of([fixtureCountry, { ...fixtureCountry, id: 'OTHER' }]),
            metadata: () => of(null),
            themes: () =>
              of([
                {
                  id: 'all',
                  label: 'Tous les thèmes',
                  description: 'Fixture',
                  resolutionCount: 2,
                  recordedVoteResolutionCount: 2,
                },
                {
                  id: 'security',
                  label: 'Sécurité de test',
                  description: 'Fixture',
                  resolutionCount: 2,
                  recordedVoteResolutionCount: 2,
                },
                {
                  id: 'environment',
                  label: 'Écologie de test',
                  description: 'Fixture',
                  resolutionCount: 2,
                  recordedVoteResolutionCount: 1,
                },
              ]),
          },
        },
      ],
    }).compileComponents();
  });

  it('reads the initial theme from the URL and sends it to comparison and trend requests', () => {
    fixture = TestBed.createComponent(ComparePage);
    fixture.detectChanges();
    expect(compare).toHaveBeenLastCalledWith('FRA', 'IND', 2000, 2025, 'security');
    expect(trend).toHaveBeenLastCalledWith('FRA', 'IND', 2000, 2025, 'year', 'security');
    expect(fixture.componentInstance.form.controls.theme.value).toBe('security');
  });

  it('refreshes trend granularity using the applied theme rather than an unsubmitted draft', () => {
    fixture = TestBed.createComponent(ComparePage);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ theme: 'environment' });
    fixture.componentInstance.compare();
    fixture.componentInstance.form.patchValue({ theme: 'security' });
    fixture.componentInstance.refreshTrend('decade');
    expect(trend).toHaveBeenLastCalledWith('FRA', 'IND', 2000, 2025, 'decade', 'environment');
  });

  it('cancels an earlier comparison when a new theme is submitted', () => {
    const first = new Subject<ComparisonResult>();
    const second = new Subject<ComparisonResult>();
    compare.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture = TestBed.createComponent(ComparePage);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ theme: 'environment' });
    fixture.componentInstance.compare();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    second.next({ ...fixtureComparison, theme: 'environment' });
    second.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.result()?.theme).toBe('environment');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.agreement-card')?.textContent,
    ).toContain('Écologie de test');
  });

  it('accepts the same year range as matrix and ranking links without inventing future votes', () => {
    fixture = TestBed.createComponent(ComparePage);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ from: 1946, to: 2100 });
    fixture.componentInstance.compare();
    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(compare).toHaveBeenLastCalledWith('FRA', 'IND', 1946, 2100, 'security');
    expect(fixture.componentInstance.result()?.agreementPercent).toBeNull();
  });
});
