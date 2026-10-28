import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ConcordanceMatrix, Country, Theme } from '../../core/models/api.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { MapPage } from './map.page';

// Données entièrement synthétiques : ces scores ne décrivent pas les votes de l'ONU.
const countries: Country[] = [
  ['FRA', 'France de test'],
  ['IND', 'Inde de test'],
  ['USA', 'États-Unis de test'],
  ['SUN', 'Entité historique de test'],
].map(([id, name]) => ({ id, name, nameEn: name, voteCount: 40, firstYear: 1946, lastYear: 2025 }));
const themes: Theme[] = [
  {
    id: 'all',
    label: 'Tous les sujets de test',
    description: 'Fixture',
    resolutionCount: 40,
    recordedVoteResolutionCount: 40,
  },
  {
    id: 'environment',
    label: 'Environnement de test',
    description: 'Fixture',
    resolutionCount: 10,
    recordedVoteResolutionCount: 10,
  },
];
const matrixData: ConcordanceMatrix = {
  countries,
  from: 2000,
  to: 2025,
  minVotes: 20,
  theme: 'all',
  dataVersion: 'Fixture',
  agreementPercents: [
    [100, 0, null, 50],
    [0, 100, 75, 100],
    [null, 75, 100, null],
    [50, 100, null, 100],
  ],
  commonVoteCounts: [
    [40, 20, 5, 20],
    [20, 40, 20, 20],
    [5, 20, 40, 0],
    [20, 20, 0, 40],
  ],
  matchingVoteCounts: [
    [40, 0, 2, 10],
    [0, 40, 15, 20],
    [2, 15, 40, 0],
    [10, 20, 0, 40],
  ],
};
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

describe('MapPage interactions', () => {
  let fixture: ComponentFixture<MapPage>;
  let page: MapPage;
  let http: HttpTestingController;
  let matrix: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    matrix = vi.fn().mockReturnValue(of(matrixData));
    await TestBed.configureTestingModule({
      imports: [MapPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DiplomaticApiService, useValue: { matrix, themes: () => of(themes) } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    http?.verify();
    vi.restoreAllMocks();
  });

  function createPage(): void {
    fixture = TestBed.createComponent(MapPage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/maps/world.json').flush(world);
    fixture.detectChanges();
  }

  function path(id: string): SVGPathElement {
    return (fixture.nativeElement as HTMLElement).querySelector<SVGPathElement>(
      `path[data-country="${id}"]`,
    )!;
  }

  it('recolors the other countries on click using the selected API row without another request', () => {
    createPage();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#map-reference')!
        .value,
    ).toBe('FRA');
    expect(path('IND').getAttribute('fill')).toBe('rgb(190, 50, 50)');
    expect(path('USA').getAttribute('fill')).toBe('#e3e7eb');

    path('IND').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(page.referenceId()).toBe('IND');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#map-reference')!
        .value,
    ).toBe('IND');
    expect(path('IND').getAttribute('aria-pressed')).toBe('true');
    expect(path('FRA').getAttribute('fill')).toBe('rgb(190, 50, 50)');
    expect(path('USA').getAttribute('fill')).toBe('rgb(142, 168, 207)');
    expect(matrix).toHaveBeenCalledTimes(1);
    http.expectNone('/maps/world.json');
  });

  it('distinguishes a real zero score, an insufficient sample, and a territory without votes', () => {
    createPage();
    path('IND').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(page.inspected()?.percentage).toBe(0);
    expect(page.inspected()?.common).toBe(20);
    expect((fixture.nativeElement as HTMLElement).querySelector('.country-rate')).not.toBeNull();

    path('USA').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.no-score')?.textContent,
    ).toContain('Seuil non atteint');
    expect(path('USA').getAttribute('fill')).toBe('#e3e7eb');
    expect(path('GRL').getAttribute('fill')).toBe('#e3e7eb');
    expect(path('GRL').getAttribute('role')).toBeNull();
    path('GRL').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.referenceId()).toBe('FRA');
  });

  it('keeps a historical country without a geographic outline selectable by its own ID', () => {
    createPage();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#map-reference',
    )!;
    expect(Array.from(select.options).some((option) => option.value === 'SUN')).toBe(true);
    select.value = 'SUN';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(page.referenceId()).toBe('SUN');
    expect(page.reference()?.name).toBe('Entité historique de test');
    expect(page.referenceOnMap()).toBe(false);
    expect(path('IND').getAttribute('fill')).toBe('rgb(36, 89, 171)');
    expect(path('USA').getAttribute('fill')).toBe('#e3e7eb');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('sans le fusionner');
    expect(matrix).toHaveBeenCalledTimes(1);
  });

  it('opens a linked historical reference with its requested period rather than substituting a modern country', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          queryParamMap: convertToParamMap({ country: 'SUN', from: '1960', to: '1990' }),
        },
      },
    });
    createPage();
    expect(matrix).toHaveBeenCalledWith(1960, 1990, 20, 'all');
    expect(page.referenceId()).toBe('SUN');
    expect(page.referenceOnMap()).toBe(false);
  });

  it.each(['Enter', ' '])('selects a focused country with the %j key', (key) => {
    createPage();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    path('USA').dispatchEvent(event);
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(page.referenceId()).toBe('USA');
    expect(matrix).toHaveBeenCalledTimes(1);
  });

  it('rejects reversed years and fractional vote thresholds without requesting new results', () => {
    createPage();
    page.form.patchValue({ from: 2025, to: 2000 });
    page.apply();
    expect(page.error()).toContain('dans l’ordre');
    page.form.patchValue({ from: 2000, to: 2025, minVotes: 2.5 });
    page.apply();
    expect(matrix).toHaveBeenCalledTimes(1);
    expect(page.form.invalid).toBe(true);
  });

  it('cancels stale filter requests and never reapplies their matrix', () => {
    const first = new Subject<ConcordanceMatrix>();
    const second = new Subject<ConcordanceMatrix>();
    matrix.mockReturnValueOnce(first).mockReturnValueOnce(second);
    createPage();
    page.form.patchValue({ from: 2010, minVotes: 5, theme: 'environment' });
    page.apply();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    expect(matrix).toHaveBeenLastCalledWith(2010, 2025, 5, 'environment');
    expect(page.loading()).toBe(true);
    expect(page.data()).toBeNull();

    first.next(matrixData);
    expect(page.data()).toBeNull();
    const fresh = { ...matrixData, from: 2010, minVotes: 5, theme: 'environment' };
    second.next(fresh);
    second.complete();
    fixture.detectChanges();
    expect(page.data()).toBe(fresh);
    expect(page.loading()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Environnement de test');
  });
});
