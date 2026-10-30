import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Country, DataMetadata } from '../../core/models/api.models';
import { DataPeriodService } from '../../core/services/data-period.service';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { MapExplorerComponent } from '../map/map-explorer.component';
import { HomePage } from './home.page';

@Component({ selector: 'app-map-explorer', template: '<div data-testid="embedded-map"></div>' })
class MapExplorerStub {
  readonly embedded = input(false);
}

// Fixtures synthétiques ; les tests ne dépendent pas du jeu de votes officiel.
const countries: Country[] = [
  ['FRA', 'France de test'],
  ['IND', 'Inde de test'],
  ['CAN', 'Canada de test'],
].map(([id, name]) => ({ id, name, nameEn: name, voteCount: 40, firstYear: 1946, lastYear: 2026 }));
const metadata: DataMetadata = {
  name: 'Archives de test',
  version: 'Fixture',
  publishedAt: '2026-10-15',
  downloadedAt: '2026-10-16',
  sourceUrl: 'https://example.test/source',
  coverage: { from: '1946-01-26', to: '2026-09-17' },
  countryCount: 3,
  resolutionCount: 1234,
  voteCount: 56789,
  license: 'Fixture',
  scope: 'Fixture',
  status: 'official',
};

describe('HomePage overview', () => {
  let fixture: ComponentFixture<HomePage>;
  let metadataResponse: Subject<DataMetadata>;
  let countriesResponse: Subject<Country[]>;
  let api: { metadata: ReturnType<typeof vi.fn>; countries: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    metadataResponse = new Subject<DataMetadata>();
    countriesResponse = new Subject<Country[]>();
    api = {
      metadata: vi.fn().mockReturnValue(metadataResponse),
      countries: vi.fn().mockReturnValue(countriesResponse),
    };
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        {
          provide: DataPeriodService,
          useValue: { defaultFrom: 2000, firstYear: 1946, lastYear: 2025 },
        },
        { provide: DiplomaticApiService, useValue: api },
      ],
    })
      .overrideComponent(HomePage, {
        remove: { imports: [MapExplorerComponent] },
        add: { imports: [MapExplorerStub] },
      })
      .compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  function select(selector: string): HTMLSelectElement {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(selector)!;
  }

  function choose(selector: string, value: string): void {
    const control = select(selector);
    const name = countries.find((country) => country.id === value)!.name;
    control.value = Array.from(control.options).find(
      (option) => option.textContent?.trim() === name,
    )!.value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  function submit(): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('embeds the interactive map directly in the overview', () => {
    const map = fixture.debugElement.query(By.directive(MapExplorerStub));
    expect(map).toBeTruthy();
    expect((map.componentInstance as MapExplorerStub).embedded()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#atlas app-map-explorer'),
    ).toBeTruthy();
  });

  it('renders source coverage before the country request finishes', () => {
    metadataResponse.next(metadata);
    fixture.detectChanges();

    const stats = (fixture.nativeElement as HTMLElement).querySelector('.archive-stats')!;
    expect(stats.querySelectorAll('.stat-value')[1].textContent?.replace(/\D/g, '')).toBe('1234');
    expect(stats.textContent).toContain('1946');
    expect(stats.textContent).toContain('2026');
    expect(fixture.componentInstance.loading()).toBe(true);
    expect(select('#home-country-a').options.length).toBe(0);
  });

  it('keeps the default France and India selections when options arrive asynchronously', async () => {
    expect(select('#home-country-a').options.length).toBe(0);
    countriesResponse.next(countries);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(select('#home-country-a').selectedOptions[0].textContent?.trim()).toBe('France de test');
    expect(select('#home-country-b').selectedOptions[0].textContent?.trim()).toBe('Inde de test');
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      countryA: 'FRA',
      countryB: 'IND',
    });
    expect(fixture.componentInstance.loading()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.archive-stats')).toBeNull();
  });

  it('still permits comparing countries when metadata cannot be loaded', () => {
    metadataResponse.error(new Error('Métadonnées indisponibles pour le test.'));
    countriesResponse.next(countries);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Recharger les informations des sources',
    );
    expect(select('#home-country-a').options.length).toBe(3);
    submit();
    expect(navigate).toHaveBeenCalledWith(['/comparer'], {
      queryParams: { countryA: 'FRA', countryB: 'IND', from: 2000, to: 2025 },
    });
  });

  it('shows source coverage and a country retry when only country loading fails', () => {
    metadataResponse.next(metadata);
    countriesResponse.error(new Error('Pays indisponibles pour le test.'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.archive-stats')).toBeTruthy();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.validation-message')?.textContent,
    ).toContain('Réessayer');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'form button[type="submit"]',
      )!.disabled,
    ).toBe(true);
    submit();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rejects comparing the same country twice without navigating', () => {
    countriesResponse.next(countries);
    fixture.detectChanges();
    choose('#home-country-b', 'FRA');
    submit();

    expect(navigate).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.validation-message')?.textContent,
    ).toContain('deux pays différents');
  });

  it('opens the detailed comparison with the actual selections and the stated initial period', () => {
    countriesResponse.next(countries);
    fixture.detectChanges();
    choose('#home-country-a', 'CAN');
    choose('#home-country-b', 'FRA');
    submit();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/comparer'], {
      queryParams: { countryA: 'CAN', countryB: 'FRA', from: 2000, to: 2025 },
    });
  });
});
