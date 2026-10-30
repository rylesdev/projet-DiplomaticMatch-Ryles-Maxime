import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConcordanceMatrix } from '../../core/models/api.models';
import { DataPeriodService } from '../../core/services/data-period.service';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { MatrixSelectionPage } from './matrix-selection.page';

// Même locale que l'application (app.config.ts) : 45,3 % et 2 218.
registerLocaleData(localeFr);

// Données fictives, réservées à ce test.
const country = (id: string, name: string) => ({
  id,
  name,
  nameEn: name,
  voteCount: 10,
  firstYear: 2000,
  lastYear: 2025,
});
const fixture: ConcordanceMatrix = {
  countries: [country('FRA', 'France'), country('IND', 'Inde')],
  from: 2000,
  to: 2025,
  minVotes: 20,
  theme: 'all',
  dataVersion: 'Fixture',
  agreementPercents: [
    [100, 45.3],
    [45.3, 100],
  ],
  commonVoteCounts: [
    [30, 2218],
    [2218, 30],
  ],
  matchingVoteCounts: [
    [30, 1005],
    [1005, 30],
  ],
};

describe('MatrixSelectionPage', () => {
  let page: ComponentFixture<MatrixSelectionPage>;
  const matrixSelection = vi.fn();

  beforeEach(async () => {
    matrixSelection.mockReset().mockReturnValue(of(fixture));
    await TestBed.configureTestingModule({
      imports: [MatrixSelectionPage],
      providers: [
        { provide: DataPeriodService, useValue: { firstYear: 1946, lastYear: 2025 } },
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'fr-FR' },
        {
          provide: DiplomaticApiService,
          useValue: {
            matrixSelection,
            countries: () => of(fixture.countries),
            themes: () => of([]),
          },
        },
      ],
    }).compileComponents();
    page = TestBed.createComponent(MatrixSelectionPage);
    page.detectChanges();
  });

  it('requests the default countries over 2000 to the last complete year', () => {
    expect(matrixSelection).toHaveBeenLastCalledWith(
      ['FRA', 'USA', 'GBR', 'CHN', 'RUS', 'IND'],
      2000,
      2025,
      20,
      'all',
    );
  });

  it('shows the rate and the number of common votes in each cell, with a comparison link', () => {
    const cells = (page.nativeElement as HTMLElement).querySelectorAll('tbody td a');
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toContain('45,3 %');
    // Le séparateur de milliers français est une espace fine insécable.
    expect(cells[0].textContent?.replace(/\s/g, ' ')).toContain('2 218 votes');
    expect(cells[0].getAttribute('href')).toContain('/comparer?countryA=FRA&countryB=IND');
  });

  it('refuses fewer than 2 countries without calling the API', () => {
    const calls = matrixSelection.mock.calls.length;
    page.componentInstance.selectedIds.set(['FRA']);
    page.componentInstance.apply();
    expect(matrixSelection.mock.calls.length).toBe(calls);
    expect(page.componentInstance.data()).toBeNull();
    expect(page.componentInstance.error()).toContain('entre 2 et 15 pays');
  });

  it('sends the chosen countries, theme and threshold when the form is applied', () => {
    page.componentInstance.selectedIds.set(['IND', 'FRA']);
    page.componentInstance.form.patchValue({ theme: 'security', minVotes: 5 });
    page.componentInstance.apply();
    expect(matrixSelection).toHaveBeenLastCalledWith(['IND', 'FRA'], 2000, 2025, 5, 'security');
  });
});
