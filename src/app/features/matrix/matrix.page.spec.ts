import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ConcordanceMatrix, Country, Theme } from '../../core/models/api.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { MatrixPage } from './matrix.page';
import { DataPeriodService } from '../../core/services/data-period.service';

// Fixtures synthétiques de test : elles ne proviennent pas de l’ONU.
const fixtureCountries: Country[] = [
  ['AAA', 'Alpha de test'],
  ['FRA', 'France de test'],
  ['IND', 'Inde de test'],
  ['ZZZ', 'Zulu de test'],
].map(([id, name]) => ({ id, name, nameEn: name, voteCount: 40, firstYear: 2000, lastYear: 2025 }));
const fixtureThemes: Theme[] = [
  {
    id: 'environment',
    label: 'Écologie de test',
    description: 'Fixture de classement thématique',
    resolutionCount: 40,
    recordedVoteResolutionCount: 40,
  },
];
const fixtureMatrix: ConcordanceMatrix = {
  countries: fixtureCountries,
  from: 2000,
  to: 2025,
  minVotes: 20,
  theme: 'environment',
  dataVersion: 'Fixture de test',
  agreementPercents: [
    [100, 75, null, 0],
    [75, 100, 50, null],
    [null, 50, 100, 100],
    [0, null, 100, 100],
  ],
  commonVoteCounts: [
    [40, 20, 0, 20],
    [20, 40, 20, 5],
    [0, 20, 40, 20],
    [20, 5, 20, 40],
  ],
  matchingVoteCounts: [
    [40, 15, 0, 0],
    [15, 40, 10, 2],
    [0, 10, 40, 20],
    [0, 2, 20, 40],
  ],
};

describe('MatrixPage interaction', () => {
  let fixture: ComponentFixture<MatrixPage>;
  let page: MatrixPage;
  let matrix: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const canvasContext = {
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
    matrix = vi.fn().mockReturnValue(of(fixtureMatrix));
    await TestBed.configureTestingModule({
      imports: [MatrixPage],
      providers: [
        { provide: DataPeriodService, useValue: { firstYear: 1946, lastYear: 2025 } },
        provideRouter([]),
        { provide: DiplomaticApiService, useValue: { matrix, themes: () => of(fixtureThemes) } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  function createPage(): void {
    fixture = TestBed.createComponent(MatrixPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    const viewport = (fixture.nativeElement as HTMLElement).querySelector('.matrix-scroll')!;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 300 },
    });
  }

  function key(value: string, ctrlKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: value,
      ctrlKey,
      bubbles: true,
      cancelable: true,
    });
    (fixture.nativeElement as HTMLElement).querySelector('.matrix-scroll')!.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  it('looks up the selected countries by ID and reads their exact score and counts', () => {
    createPage();
    const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#matrix-row',
    )!;
    const column = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#matrix-column',
    )!;
    row.value = 'AAA';
    row.dispatchEvent(new Event('change', { bubbles: true }));
    column.value = 'ZZZ';
    column.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(page.selected()).toEqual(
      expect.objectContaining({
        a: fixtureCountries[0],
        b: fixtureCountries[3],
        percentage: 0,
        common: 20,
        matching: 0,
      }),
    );
    expect(page.selectedText()).toContain('0 % de concordance');
  });

  it('distinguishes a zero score, an insufficient sample, and no common vote', () => {
    createPage();
    page.selectCell(0, 3);
    fixture.detectChanges();
    expect(page.selected()?.percentage).toBe(0);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.cell-readout')?.textContent,
    ).not.toContain('Seuil non atteint');
    page.selectCell(1, 3);
    fixture.detectChanges();
    expect(page.selected()?.percentage).toBeNull();
    expect(page.selected()?.common).toBe(5);
    expect(page.selectedText()).toContain('seuil non atteint');
    page.selectCell(0, 2);
    fixture.detectChanges();
    expect(page.selected()?.percentage).toBeNull();
    expect(page.selected()?.common).toBe(0);
    expect(page.selectedText()).toContain('aucun vote commun');
  });

  it('moves with arrow keys and clamps selection within the matrix bounds', () => {
    createPage();
    page.selectCell(0, 0);
    expect(key('ArrowLeft').defaultPrevented).toBe(true);
    key('ArrowUp');
    expect([page.activeRow(), page.activeColumn()]).toEqual([0, 0]);
    key('ArrowRight');
    key('ArrowDown');
    expect([page.activeRow(), page.activeColumn()]).toEqual([1, 1]);
    page.selectCell(3, 3);
    key('ArrowRight');
    key('ArrowDown');
    expect([page.activeRow(), page.activeColumn()]).toEqual([3, 3]);
    key('ArrowLeft');
    key('ArrowUp');
    expect([page.activeRow(), page.activeColumn()]).toEqual([2, 2]);
  });

  it('supports Home, End, control shortcuts, and page navigation', () => {
    createPage();
    page.selectCell(1, 2);
    key('Home');
    expect([page.activeRow(), page.activeColumn()]).toEqual([1, 0]);
    key('End');
    expect([page.activeRow(), page.activeColumn()]).toEqual([1, 3]);
    key('Home', true);
    expect([page.activeRow(), page.activeColumn()]).toEqual([0, 0]);
    key('End', true);
    expect([page.activeRow(), page.activeColumn()]).toEqual([3, 3]);
    key('PageUp');
    expect(page.activeRow()).toBe(0);
    key('PageDown');
    expect(page.activeRow()).toBe(3);
  });

  it('opens the selected pair with Enter and keeps the applied theme in links', () => {
    createPage();
    page.selectCell(0, 3);
    page.form.patchValue({ theme: 'security' });
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.cell-readout a',
    )!;
    expect(link.getAttribute('href')).toContain('theme=environment');
    expect(key('Enter').defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith(['/comparer'], {
      queryParams: { countryA: 'AAA', countryB: 'ZZZ', from: 2000, to: 2025, theme: 'environment' },
    });
    navigate.mockClear();
    page.selectCell(1, 1);
    key('Enter');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uses click coordinates before opening a comparison, without requiring a prior hover', () => {
    createPage();
    page.selectCell(1, 2);
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 16, 16));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 114, clientY: 52, bubbles: true }));
    fixture.detectChanges();
    expect(page.selected()).toEqual(expect.objectContaining({ row: 0, column: 3, percentage: 0 }));
    expect(navigate).toHaveBeenLastCalledWith(['/comparer'], {
      queryParams: { countryA: 'AAA', countryB: 'ZZZ', from: 2000, to: 2025, theme: 'environment' },
    });
  });

  it('cancels obsolete matrix requests when new filters are submitted', () => {
    const first = new Subject<ConcordanceMatrix>();
    const second = new Subject<ConcordanceMatrix>();
    matrix.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture = TestBed.createComponent(MatrixPage);
    page = fixture.componentInstance;
    page.form.patchValue({ theme: 'environment', minVotes: 5 });
    page.apply();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(true);
    expect(matrix).toHaveBeenLastCalledWith(2000, 2025, 5, 'environment');
  });
});
