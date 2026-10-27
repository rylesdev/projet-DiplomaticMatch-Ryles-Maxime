import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { CountryRankings } from '../../core/models/api.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { CountryRankingsComponent } from './country-rankings.component';

// Données fictives isolées : aucun résultat de test ne rejoint le jeu officiel.
function testResult(id: string): CountryRankings {
  return {
    country: {
      id,
      name: 'Pays fictif de test',
      nameEn: 'Test fixture',
      voteCount: 0,
      firstYear: 2000,
      lastYear: 2026,
    },
    from: 2000,
    to: 2026,
    minVotes: 20,
    eligibleCountryCount: 0,
    excludedCountryCount: 2,
    closest: [],
    furthest: [],
    dataVersion: 'Fixture de test',
  };
}

describe('CountryRankingsComponent', () => {
  let fixture: ComponentFixture<CountryRankingsComponent>;
  let rankings: ReturnType<typeof vi.fn>;
  let themes: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    rankings = vi.fn().mockReturnValue(of(testResult('TST')));
    themes = vi.fn().mockReturnValue(
      of([
        {
          id: 'all',
          label: 'Tous les thèmes',
          description: 'Fixture',
          resolutionCount: 10,
          recordedVoteResolutionCount: 2,
        },
        {
          id: 'environment',
          label: 'Écologie de test',
          description: 'Fixture',
          resolutionCount: 5,
          recordedVoteResolutionCount: 2,
        },
      ]),
    );
    await TestBed.configureTestingModule({
      imports: [CountryRankingsComponent],
      providers: [
        provideRouter([]),
        { provide: DiplomaticApiService, useValue: { rankings, themes } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CountryRankingsComponent);
  });

  it('cancels the old country request when the selection changes', () => {
    const first = new Subject<CountryRankings>();
    const second = new Subject<CountryRankings>();
    rankings.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.componentRef.setInput('countryId', 'FIRST');
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBe(true);
    expect(first.observed).toBe(true);
    fixture.componentRef.setInput('countryId', 'SECOND');
    fixture.detectChanges();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    second.next(testResult('SECOND'));
    second.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.result()?.country.id).toBe('SECOND');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('does not send reversed or fractional periods to the API', () => {
    fixture.componentRef.setInput('countryId', 'TST');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ from: 2025, to: 2000 });
    fixture.componentInstance.apply();
    expect(rankings).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.result()).toBeNull();
    expect(fixture.componentInstance.error()).toContain('années entières');
    fixture.componentInstance.form.patchValue({ from: 2000.5, to: 2026 });
    fixture.componentInstance.apply();
    expect(rankings).toHaveBeenCalledTimes(1);
  });

  it('requests the submitted period and threshold and handles an empty ranking', () => {
    fixture.componentRef.setInput('countryId', 'TST');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ from: 2010, to: 2020, minVotes: 50 });
    fixture.componentInstance.apply();
    fixture.detectChanges();
    expect(rankings).toHaveBeenLastCalledWith('TST', 2010, 2020, 50, 'all');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Aucun autre pays n’atteint ce seuil',
    );
  });

  it('cancels the old request when a new theme is applied', () => {
    const first = new Subject<CountryRankings>();
    const second = new Subject<CountryRankings>();
    rankings.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.componentRef.setInput('countryId', 'TST');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ theme: 'environment', minVotes: 5 });
    fixture.componentInstance.apply();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    expect(rankings).toHaveBeenLastCalledWith('TST', 2000, 2026, 5, 'environment');
  });

  it('keeps the returned theme in comparison links and warns on a low threshold', () => {
    const response: CountryRankings = {
      ...testResult('TST'),
      theme: 'environment',
      minVotes: 1,
      eligibleCountryCount: 1,
      closest: [
        {
          country: { ...testResult('OTHER').country, name: 'Autre fixture' },
          commonVoteCount: 2,
          matchingVoteCount: 2,
          differingVoteCount: 0,
          agreementPercent: 100,
          coverage: { from: '2000-01-01', to: '2001-01-01' },
        },
      ],
    };
    rankings.mockReturnValue(of(response));
    fixture.componentRef.setInput('countryId', 'TST');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ theme: 'security' });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.ranking-entry')?.getAttribute('href')).toContain(
      'theme=environment',
    );
    expect(compiled.textContent).toContain('Interprétation limitée');
    expect(compiled.querySelector('.rankings-summary')?.textContent).toContain('Écologie de test');
  });

  it('shows a failed theme list request and can reload its options', () => {
    themes.mockReturnValueOnce(throwError(() => new Error('Échec des thèmes de test')));
    fixture = TestBed.createComponent(CountryRankingsComponent);
    fixture.componentRef.setInput('countryId', 'TST');
    fixture.detectChanges();
    expect(fixture.componentInstance.themesError()).toBe('Échec des thèmes de test');
    fixture.componentInstance.loadThemes();
    expect(fixture.componentInstance.themesError()).toBe('');
    expect(fixture.componentInstance.themes().length).toBe(2);
  });
});
