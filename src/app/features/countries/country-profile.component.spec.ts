import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CountryProfile } from '../../core/models/api.models';
import { DataPeriodService } from '../../core/services/data-period.service';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { CountryProfileComponent } from './country-profile.component';

const fixtureProfile: CountryProfile = {
  country: {
    id: 'FRA',
    name: 'France',
    nameEn: 'FRANCE',
    iso3: 'FRA',
    voteCount: 10,
    firstYear: 2000,
    lastYear: 2026,
  },
  from: 2000,
  to: 2026,
  theme: 'all',
  totals: { YES: 6, NO: 2, ABSTAIN: 2, NOT_VOTED: 1, UNKNOWN: 0 },
  recordedResolutionCount: 11,
  explicitVoteCount: 10,
  comparableWithMajorityCount: 10,
  alignedWithMajorityCount: 7,
  dissentingVoteCount: 3,
  tiedMajorityCount: 0,
  majorityAlignmentPercent: 70,
  strictMinorityVoteCount: 1,
  coverage: { from: '2000-01-01', to: '2026-01-01' },
  minorityVotes: [
    {
      resolution: {
        id: '101',
        symbol: 'A/RES/79/113',
        title: 'Résolution de test sur un vote isolé',
        date: '2024-12-04',
        sourceUrl: 'https://example.test/101',
      },
      choice: 'ABSTAIN',
      majorityChoice: 'YES',
      sameChoiceCount: 1,
      assemblyExplicitTotal: 182,
      assemblyTotals: { YES: 175, NO: 6, ABSTAIN: 1 },
    },
  ],
  dataVersion: 'Fixture de test',
};

describe('CountryProfileComponent', () => {
  let fixture: ComponentFixture<CountryProfileComponent>;
  let profile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    profile = vi.fn().mockReturnValue(of(fixtureProfile));
    await TestBed.configureTestingModule({
      imports: [CountryProfileComponent],
      providers: [
        provideRouter([]),
        {
          provide: DataPeriodService,
          useValue: { defaultFrom: 2000, firstYear: 1946, lastYear: 2025 },
        },
        {
          provide: DiplomaticApiService,
          useValue: {
            profile,
            themes: () =>
              of([
                {
                  id: 'all',
                  label: 'Tous les thèmes',
                  description: 'Fixture',
                  resolutionCount: 11,
                  recordedVoteResolutionCount: 11,
                },
              ]),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CountryProfileComponent);
    fixture.componentInstance.countryId = 'FRA';
    fixture.detectChanges();
  });

  it('requests the majority profile and displays alignment rate and isolated votes', () => {
    expect(profile).toHaveBeenCalledWith('FRA', 2000, 2025, 'all');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('70.0 %');
    expect(text).toContain('A/RES/79/113');
    expect(text).toContain('1 seul État sur 182');
  });
});
