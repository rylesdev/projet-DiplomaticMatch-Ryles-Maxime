import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ConcordanceRow, Country, Theme } from '../../core/models/api.models';
import { DataPeriodService } from '../../core/services/data-period.service';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { MapExplorerComponent } from './map-explorer.component';

// Données entièrement synthétiques (reprises de la spec de Maxime) : ces scores ne décrivent
// pas les votes de l'ONU. Chaque ligne donne la concordance d'un pays avec les quatre pays.
const ids = ['FRA', 'IND', 'USA', 'SUN'];
const names = ['France de test', 'Inde de test', 'États-Unis de test', 'Entité historique de test'];
const percents = [
  [100, 0, null, 50],
  [0, 100, 75, 100],
  [null, 75, 100, null],
  [50, 100, null, 100],
];
const commons = [
  [40, 20, 5, 20],
  [20, 40, 20, 20],
  [5, 20, 40, 0],
  [20, 20, 0, 40],
];
const themes: Theme[] = [
  {
    id: 'all',
    label: 'Tous les sujets de test',
    description: 'Fixture',
    resolutionCount: 40,
    recordedVoteResolutionCount: 40,
  },
];
function rowFor(id: string, from = 2000, to = 2025, minVotes = 20, theme = 'all'): ConcordanceRow {
  const row = ids.indexOf(id);
  const country: Country = {
    id,
    name: names[row],
    nameEn: names[row],
    voteCount: 40,
    firstYear: 1946,
    lastYear: 2025,
  };
  return {
    country,
    from,
    to,
    theme,
    minVotes,
    dataVersion: 'Fixture',
    entries: ids.map((other, column) => ({
      id: other,
      name: names[column],
      commonVoteCount: commons[row][column],
      matchingVoteCount: 0,
      agreementPercent: percents[row][column],
    })),
  };
}
const world = {
  width: 1200,
  height: 570,
  countries: [
    { id: 'FRA', name: 'France géographique', path: 'M0,0L10,0L10,10Z' },
    { id: 'IND', name: 'Inde géographique', path: 'M20,0L30,0L30,10Z' },
    { id: 'USA', name: 'États-Unis géographiques', path: 'M40,0L50,0L50,10Z' },
    { id: 'GRL', name: 'Territoire sans votes de test', path: 'M60,0L70,0L70,10Z' },
  ],
};

describe('MapExplorerComponent', () => {
  let fixture: ComponentFixture<MapExplorerComponent>;
  let page: MapExplorerComponent;
  let http: HttpTestingController;
  let concordances: ReturnType<typeof vi.fn>;

  function setup(query: Record<string, string> = {}): void {
    concordances = vi.fn((id: string, from: number, to: number, minVotes: number, theme: string) =>
      of(rowFor(id, from, to, minVotes, theme)),
    );
    TestBed.configureTestingModule({
      imports: [MapExplorerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DataPeriodService, useValue: { firstYear: 1946, lastYear: 2025 } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
        { provide: DiplomaticApiService, useValue: { concordances, themes: () => of(themes) } },
      ],
    });
    fixture = TestBed.createComponent(MapExplorerComponent);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/maps/world.json').flush(world);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    http?.verify();
  });

  function path(id: string): SVGPathElement {
    return (fixture.nativeElement as HTMLElement).querySelector<SVGPathElement>(
      `path[data-country="${id}"]`,
    )!;
  }

  it('requests the row of the reference country over 2000 to the last complete year', () => {
    setup();
    expect(concordances).toHaveBeenCalledWith('FRA', 2000, 2025, 20, 'all');
    expect(path('IND').getAttribute('fill')).toBe('rgb(190, 50, 50)');
    expect(path('USA').getAttribute('fill')).toBe('#e3e7eb');
  });

  it('asks the API for the row of a clicked country, with the same applied filters', () => {
    setup();
    path('IND').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(page.referenceId()).toBe('IND');
    expect(concordances).toHaveBeenLastCalledWith('IND', 2000, 2025, 20, 'all');
    expect(path('IND').getAttribute('aria-pressed')).toBe('true');
    expect(path('FRA').getAttribute('fill')).toBe('rgb(190, 50, 50)');
    expect(path('USA').getAttribute('fill')).toBe('rgb(142, 168, 207)');
    http.expectNone('/maps/world.json');
  });

  it('distinguishes a real zero score, an insufficient sample, and a territory without votes', () => {
    setup();
    path('IND').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(page.inspected()?.percentage).toBe(0);
    expect(page.inspected()?.common).toBe(20);
    path('USA').dispatchEvent(new MouseEvent('mouseenter'));
    expect(page.inspected()?.percentage).toBeNull();
    expect(page.description(page.inspected()!)).toContain('seuil non atteint');
    path('GRL').dispatchEvent(new MouseEvent('mouseenter'));
    expect(page.inspected()?.country).toBeNull();
    expect(page.description(page.inspected()!)).toContain('absent du jeu de votes');
  });

  it('opens a historical reference from the URL with its own period', () => {
    setup({ country: 'SUN', from: '1960', to: '1990' });
    expect(concordances).toHaveBeenCalledWith('SUN', 1960, 1990, 20, 'all');
    expect(page.reference()?.name).toBe('Entité historique de test');
  });

  it('collapses the filters when embedded on the home page', () => {
    setup();
    const details = (fixture.nativeElement as HTMLElement).querySelector<HTMLDetailsElement>(
      '.filter-panel',
    )!;
    expect(details.open).toBe(true);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(details.open).toBe(false);
  });

  it('rejects reversed years and fractional thresholds without a new request', () => {
    setup();
    page.form.patchValue({ from: 2025, to: 2000 });
    page.apply();
    page.form.patchValue({ from: 2000, to: 2025, minVotes: 2.5 });
    page.apply();
    expect(concordances).toHaveBeenCalledTimes(1);
  });

  it('cancels a stale request and never shows its colors', () => {
    setup();
    const first = new Subject<ConcordanceRow>();
    const second = new Subject<ConcordanceRow>();
    concordances.mockReturnValueOnce(first).mockReturnValueOnce(second);
    page.form.patchValue({ from: 2005 });
    page.apply();
    page.form.patchValue({ from: 2010 });
    page.apply();
    expect(first.observed).toBe(false);
    second.next(rowFor('FRA', 2010));
    expect(page.data()?.from).toBe(2010);
  });
});
