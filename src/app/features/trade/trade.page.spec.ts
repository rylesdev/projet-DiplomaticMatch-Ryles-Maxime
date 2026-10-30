import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { TradeComparison, TradeMetadata, TradePartners } from '../../core/models/trade.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { TradeApiService } from '../../core/services/trade-api.service';
import { TradePage, chartSegments, csvCell } from './trade.page';

const metadata: TradeMetadata = {
  sourceName: 'Fixture FMI',
  sourceUrl: 'https://example.test/trade',
  version: 'test',
  retrievedAt: '2026-10-30T00:00:00Z',
  unit: 'USD',
  priceBasis: 'current',
  valuation: 'FOB',
  measure: 'goods_exports',
  coverage: { from: 2023, to: 2024 },
  countryCount: 3,
  observationCount: 6,
};
const countryA = {
  id: 'AAA',
  name: 'Pays A fictif',
  nameEn: 'Test A',
  firstYear: 2000,
  lastYear: 2024,
  voteCount: 20,
};
const countryB = { ...countryA, id: 'BBB', name: 'Pays B fictif' };
const countryC = { ...countryA, id: 'CCC', name: 'Pays C fictif' };
const point = {
  year: 2024,
  exportsAtoB: 100,
  exportsBtoA: 40,
  totalTrade: 140,
  balanceA: 60,
  agreementPercent: 75,
  commonVoteCount: 20,
};
const comparison: TradeComparison = {
  metadata,
  countryA,
  countryB,
  from: 2024,
  to: 2024,
  theme: 'security',
  minVotes: 20,
  points: [point],
  summary: { latestCompleteYear: 2024, latest: point, comparableYearCount: 1 },
};
const panorama: TradePartners = {
  metadata,
  country: countryA,
  year: 2024,
  theme: 'security',
  minVotes: 20,
  partners: [
    {
      country: countryB,
      exportsToPartner: 100,
      exportsFromPartner: 40,
      totalTrade: 140,
      agreementPercent: 75,
      commonVoteCount: 20,
    },
    {
      country: countryC,
      exportsToPartner: 0,
      exportsFromPartner: null,
      totalTrade: null,
      agreementPercent: null,
      commonVoteCount: 2,
    },
  ],
};

describe('TradePage', () => {
  let fixture: ComponentFixture<TradePage>;
  let compare: ReturnType<typeof vi.fn>;
  let partners: ReturnType<typeof vi.fn>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    compare = vi.fn().mockReturnValue(of(comparison));
    partners = vi.fn().mockReturnValue(of(panorama));
    queryParams = new BehaviorSubject(
      convertToParamMap({
        countryA: 'AAA',
        countryB: 'BBB',
        from: '2024',
        to: '2024',
        theme: 'security',
      }),
    );
    await TestBed.configureTestingModule({
      imports: [TradePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams,
          },
        },
        { provide: TradeApiService, useValue: { metadata: () => of(metadata), compare, partners } },
        {
          provide: DiplomaticApiService,
          useValue: {
            countries: () => of([countryA, countryB, countryC]),
            themes: () =>
              of([
                { id: 'all', label: 'Tous les thèmes' },
                { id: 'security', label: 'Sécurité' },
              ]),
          },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  function create() {
    fixture = TestBed.createComponent(TradePage);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('reprend les paramètres du lien et compare commerce et votes sur la même année', () => {
    create();
    expect(compare).toHaveBeenCalledWith({
      countryA: 'AAA',
      countryB: 'BBB',
      from: 2024,
      to: 2024,
      theme: 'security',
      minVotes: 20,
    });
    expect(partners).toHaveBeenCalledWith('AAA', 2024, 'security', 20);
    expect(fixture.nativeElement.textContent).toContain('DERNIÈRE ANNÉE AVEC LES DEUX FLUX');
    expect(fixture.nativeElement.querySelectorAll('.scatter-point')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Pays C fictif');
  });

  it('annule une comparaison ancienne et une demande de partenaires anciennes', () => {
    const first = new Subject<TradeComparison>();
    const second = new Subject<TradeComparison>();
    const oldPartners = new Subject<TradePartners>();
    compare.mockReturnValueOnce(first).mockReturnValueOnce(second);
    partners.mockReturnValueOnce(oldPartners);
    const page = create();
    page.form.patchValue({ countryB: 'CCC', theme: 'all' });
    page.run();
    expect(first.observed).toBe(false);
    expect(oldPartners.observed).toBe(false);
    first.next(comparison);
    expect(page.result()).toBeNull();
    second.next({ ...comparison, countryB: countryC });
    expect(page.result()?.countryB.id).toBe('CCC');
  });

  it('change l’année des partenaires sans appliquer un brouillon de thème', () => {
    const page = create();
    page.form.patchValue({ theme: 'all' });
    page.partnerYear.set(2023);
    page.refreshPartners();
    expect(partners).toHaveBeenLastCalledWith('AAA', 2023, 'security', 20);
    expect(compare).toHaveBeenCalledOnce();
  });

  it('affiche l’année réellement analysée après création des options puis après sélection', () => {
    queryParams.next(
      convertToParamMap({
        countryA: 'AAA',
        countryB: 'BBB',
        from: '2020',
        to: '2024',
        theme: 'security',
      }),
    );
    const page = create();
    const select = fixture.nativeElement.querySelector('#partner-year') as HTMLSelectElement;
    expect(page.partnerYear()).toBe(2024);
    expect(select.value).toBe('2024');

    select.value = '2020';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(page.partnerYear()).toBe(2020);
    expect(select.value).toBe('2020');
    expect(partners).toHaveBeenLastCalledWith('AAA', 2020, 'security', 20);
  });

  it('permet de sélectionner un partenaire en conservant les filtres appliqués', () => {
    const page = create();
    page.form.patchValue({ theme: 'all', from: 2010 });
    page.choosePartner('CCC');
    expect(compare).toHaveBeenLastCalledWith({
      countryA: 'AAA',
      countryB: 'CCC',
      from: 2024,
      to: 2024,
      theme: 'security',
      minVotes: 20,
    });
  });

  it('conserve le panorama de 2020 lorsqu’un partenaire devient le second pays comparé', () => {
    const page = create();
    page.form.patchValue({ from: 2020 });
    page.run();
    const panorama2020 = { ...panorama, year: 2020 };
    partners.mockReturnValue(of(panorama2020));
    page.partnerYear.set(2020);
    page.refreshPartners();
    page.showAllPartners.set(true);
    const requestsBeforeSelection = partners.mock.calls.length;

    page.choosePartner('CCC');

    expect(compare).toHaveBeenLastCalledWith({
      countryA: 'AAA',
      countryB: 'CCC',
      from: 2020,
      to: 2024,
      theme: 'security',
      minVotes: 20,
    });
    expect(page.partnerYear()).toBe(2020);
    expect(page.partners()).toBe(panorama2020);
    expect(page.showAllPartners()).toBe(true);
    expect(partners).toHaveBeenCalledTimes(requestsBeforeSelection);
  });

  it('affiche les absences sans inventer de synthèse ni de point dans le nuage', () => {
    const missing = {
      ...point,
      exportsAtoB: null,
      exportsBtoA: null,
      totalTrade: null,
      balanceA: null,
      agreementPercent: null,
      commonVoteCount: 0,
    };
    compare.mockReturnValue(
      of({
        ...comparison,
        points: [missing],
        summary: { latestCompleteYear: null, latest: null, comparableYearCount: 0 },
      }),
    );
    partners.mockReturnValue(of({ ...panorama, partners: [] }));
    create();
    expect(fixture.nativeElement.textContent).toContain('Aucune année avec les deux flux');
    expect(fixture.nativeElement.querySelectorAll('.metric-card, .scatter-point')).toHaveLength(0);
  });

  it('une erreur partenaires ne masque pas la comparaison et reste relançable', () => {
    partners.mockReturnValueOnce(throwError(() => new Error('Erreur fixture')));
    const page = create();
    expect(page.result()).toBe(comparison);
    expect(page.partnersError()).not.toBe('');
    page.refreshPartners();
    expect(page.partners()).toBe(panorama);
  });

  it('réessaie les mêmes paramètres après une erreur de comparaison', () => {
    compare.mockReturnValueOnce(throwError(() => new Error('Erreur fixture')));
    const page = create();
    page.retryComparison();
    expect(compare).toHaveBeenCalledTimes(2);
    expect(page.result()).toBe(comparison);
  });
});

describe('Intégrité du graphique et du CSV', () => {
  it('ne relie pas les points séparés par une donnée absente', () => {
    expect(
      chartSegments([1, 2, null, 4], (value, i) => (value === null ? null : `${i},${value}`)),
    ).toEqual(['0,1 1,2', '3,4']);
  });
  it('neutralise les formules des cellules texte et conserve les soldes numériques négatifs', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(' +danger')).toBe('"\' +danger"');
    expect(csvCell(-42)).toBe('"-42"');
    expect(csvCell(null)).toBe('""');
  });
});
