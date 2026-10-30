import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TradeApiService } from './trade-api.service';

const metadata = {
  sourceName: 'Source de test',
  sourceUrl: 'https://example.test/trade',
  version: 'fixture',
  retrievedAt: '2026-10-30T00:00:00Z',
  unit: 'USD',
  priceBasis: 'current',
  valuation: 'FOB',
  measure: 'goods_exports',
  coverage: { from: 2023, to: 2024 },
  countryCount: 2,
  observationCount: 3,
};
const countryA = {
  id: 'AAA',
  name: 'Pays A de test',
  nameEn: 'Fixture A',
  voteCount: 30,
  firstYear: 2000,
  lastYear: 2024,
};
const countryB = { ...countryA, id: 'BBB', name: 'Pays B de test' };
const filters = {
  countryA: 'AAA',
  countryB: 'BBB',
  from: 2023,
  to: 2024,
  theme: 'security',
  minVotes: 20,
};
const points = [
  {
    year: 2023,
    exportsAtoB: 0,
    exportsBtoA: null,
    totalTrade: null,
    balanceA: null,
    agreementPercent: null,
    commonVoteCount: 19,
  },
  {
    year: 2024,
    exportsAtoB: 100,
    exportsBtoA: 40,
    totalTrade: 140,
    balanceA: 60,
    agreementPercent: 75,
    commonVoteCount: 20,
  },
];
const response = () => ({
  ...filters,
  metadata,
  countryA,
  countryB,
  points: points.map((p) => ({ ...p })),
  summary: { latestCompleteYear: 2024, latest: { ...points[1] }, comparableYearCount: 1 },
});

describe('TradeApiService — contracts commerciaux', () => {
  let api: TradeApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TradeApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('transmet les filtres et distingue un zéro publié d’un flux manquant', () => {
    const next = vi.fn();
    api.compare(filters).subscribe(next);
    const request = http.expectOne((r) => r.url === '/api/trade/compare');
    expect(request.request.params.get('theme')).toBe('security');
    expect(request.request.params.get('minVotes')).toBe('20');
    request.flush(response());
    expect(next.mock.calls[0][0].points[0].exportsAtoB).toBe(0);
    expect(next.mock.calls[0][0].points[0].exportsBtoA).toBeNull();
    expect(next.mock.calls[0][0].points[0].totalTrade).toBeNull();
  });

  it.each([
    [
      'montant négatif',
      (data: ReturnType<typeof response>) => {
        data.points[0].exportsAtoB = -1;
      },
    ],
    [
      'total inventé malgré un sens manquant',
      (data: ReturnType<typeof response>) => {
        data.points[0].totalTrade = 0;
      },
    ],
    [
      'total incohérent',
      (data: ReturnType<typeof response>) => {
        data.points[1].totalTrade = 141;
      },
    ],
    [
      'solde inversé',
      (data: ReturnType<typeof response>) => {
        data.points[1].balanceA = -60;
      },
    ],
    [
      'année dupliquée',
      (data: ReturnType<typeof response>) => {
        data.points[1].year = 2023;
      },
    ],
    [
      'pourcentage au-dessous du seuil',
      (data: ReturnType<typeof response>) => {
        data.points[0].agreementPercent = 50;
      },
    ],
    [
      'résumé emprunté à une autre année',
      (data: ReturnType<typeof response>) => {
        data.summary.latest.year = 2023;
      },
    ],
  ])('rejette %s', (_, mutate) => {
    const error = vi.fn();
    api.compare(filters).subscribe({ error });
    const data = response();
    mutate(data);
    http.expectOne((r) => r.url === '/api/trade/compare').flush(data);
    expect(error).toHaveBeenCalledOnce();
  });

  it('refuse une source en milliers de dollars qui serait affichée comme des dollars', () => {
    const error = vi.fn();
    api.metadata().subscribe({ error });
    http.expectOne('/api/trade/metadata').flush({ ...metadata, unit: 'thousands USD' });
    expect(error).toHaveBeenCalledOnce();
  });

  it('conserve le statut estimé FMI et les codes de dérivation', () => {
    const next = vi.fn();
    api.compare(filters).subscribe(next);
    const data = response();
    const enriched = {
      ...data,
      points: data.points.map((p) => ({ ...p, statusAtoB: 'e', derivationAtoB: 'M' })),
      summary: {
        ...data.summary,
        latest: { ...data.summary.latest, statusAtoB: 'e', derivationAtoB: 'M' },
      },
    };
    http.expectOne((r) => r.url === '/api/trade/compare').flush(enriched);
    expect(next.mock.calls[0][0].points[1].statusAtoB).toBe('e');
  });

  it('rejette un panorama contenant deux fois le même partenaire', () => {
    const error = vi.fn();
    api.partners('AAA', 2024, 'all', 20).subscribe({ error });
    const partner = {
      country: countryB,
      exportsToPartner: 10,
      exportsFromPartner: 0,
      totalTrade: 10,
      agreementPercent: 50,
      commonVoteCount: 20,
    };
    http
      .expectOne((r) => r.url === '/api/trade/partners')
      .flush({
        metadata,
        country: countryA,
        year: 2024,
        theme: 'all',
        minVotes: 20,
        partners: [partner, partner],
      });
    expect(error).toHaveBeenCalledOnce();
  });
});
