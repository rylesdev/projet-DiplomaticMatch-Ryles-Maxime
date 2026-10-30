import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiErrorMessage, DiplomaticApiService } from './diplomatic-api.service';

// Fixtures fictives, réservées aux tests des requêtes HTTP.
const testCountry = {
  id: 'TST',
  name: 'État de test',
  nameEn: 'Test fixture',
  voteCount: 0,
  firstYear: 2000,
  lastYear: 2000,
};
const testResolution = {
  id: 'test/resolution',
  symbol: 'FIXTURE',
  title: 'Résolution fictive de test',
  date: '2000-01-01',
  sourceUrl: 'https://example.test/fixture',
};
const testRankings = {
  country: testCountry,
  from: 2000,
  to: 2026,
  minVotes: 20,
  eligibleCountryCount: 2,
  excludedCountryCount: 1,
  closest: [
    {
      country: { ...testCountry, id: 'CLOSE' },
      commonVoteCount: 30,
      matchingVoteCount: 27,
      differingVoteCount: 3,
      agreementPercent: 90,
      coverage: { from: '2000-01-01', to: '2026-01-01' },
    },
  ],
  furthest: [],
  dataVersion: 'Fixture de test',
  theme: 'security',
};
const testMatrix = {
  countries: [testCountry, { ...testCountry, id: 'OTHER' }],
  from: 2000,
  to: 2026,
  minVotes: 20,
  theme: 'environment',
  dataVersion: 'Fixture de test',
  agreementPercents: [
    [100, null],
    [null, 100],
  ],
  commonVoteCounts: [
    [30, 10],
    [10, 30],
  ],
  matchingVoteCounts: [
    [30, 5],
    [5, 30],
  ],
};

describe('DiplomaticApiService', () => {
  let api: DiplomaticApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DiplomaticApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends a country search as an HTTP query and returns the country list', () => {
    const next = vi.fn();
    api.countries('fra').subscribe(next);
    const request = http.expectOne(
      (request) => request.url === '/api/countries' && request.params.get('search') === 'fra',
    );
    expect(request.request.method).toBe('GET');
    request.flush([testCountry]);
    expect(next).toHaveBeenCalledWith([testCountry]);
  });

  it('requests a country history with its period and page', () => {
    const next = vi.fn();
    api.votes('TST', 2000, 2010, 3).subscribe(next);
    const request = http.expectOne((request) => request.url === '/api/countries/TST/votes');
    expect(request.request.params.get('from')).toBe('2000');
    expect(request.request.params.get('to')).toBe('2010');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('pageSize')).toBe('20');
    const page = {
      items: [{ resolution: testResolution, choice: 'YES', rawChoice: 'Y' }],
      page: 3,
      pageSize: 20,
      total: 41,
    };
    request.flush(page);
    expect(next).toHaveBeenCalledWith(page);
  });

  it('keeps a null concordance when there are no comparable votes', () => {
    const next = vi.fn();
    api.compare('TST', 'OTHER', 2000, 2000).subscribe(next);
    http
      .expectOne((request) => request.url === '/api/compare')
      .flush({
        countryA: testCountry,
        countryB: { ...testCountry, id: 'OTHER' },
        from: 2000,
        to: 2000,
        theme: 'all',
        commonVoteCount: 0,
        matchingVoteCount: 0,
        differingVoteCount: 0,
        nonComparableCount: 1,
        agreementPercent: null,
        coverage: { from: null, to: null },
        dataVersion: 'Fixture de test',
        divergences: [],
      });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ agreementPercent: null, commonVoteCount: 0 }),
    );
  });

  it('encodes resolution identifiers in the URL', () => {
    const next = vi.fn();
    api.resolution('test/resolution').subscribe(next);
    http.expectOne('/api/resolutions/test%2Fresolution').flush({
      ...testResolution,
      votes: [],
      totals: { YES: 0, NO: 0, ABSTAIN: 0, NOT_VOTED: 0, UNKNOWN: 0 },
    });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ id: 'test/resolution' }));
  });

  it('searches resolutions only within the requested period', () => {
    api.resolutions('climate', 2, 20, 1990, 2000).subscribe();
    const request = http.expectOne((request) => request.url === '/api/resolutions');
    expect(request.request.params.get('search')).toBe('climate');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('from')).toBe('1990');
    expect(request.request.params.get('to')).toBe('2000');
    request.flush({ items: [], total: 0, page: 2, pageSize: 20 });
  });

  it('requests rankings with encoded country, dates and the minimum sample size', () => {
    const next = vi.fn();
    api.rankings('test/source', 2000, 2026, 20, 'security').subscribe(next);
    const request = http.expectOne(
      (request) => request.url === '/api/countries/test%2Fsource/rankings',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2000');
    expect(request.request.params.get('to')).toBe('2026');
    expect(request.request.params.get('minVotes')).toBe('20');
    expect(request.request.params.get('theme')).toBe('security');
    request.flush(testRankings);
    expect(next).toHaveBeenCalledWith(testRankings);
  });

  it('loads theme choices and their recorded-vote counts', () => {
    const next = vi.fn();
    api.themes().subscribe(next);
    const fixture = [
      {
        id: 'environment',
        label: 'Écologie de test',
        description: 'Fixture, pas une classification officielle.',
        resolutionCount: 5,
        recordedVoteResolutionCount: 2,
      },
    ];
    http.expectOne('/api/themes').flush(fixture);
    expect(next).toHaveBeenCalledWith(fixture);
  });

  it('passes a theme and a granularity to comparisons and trends', () => {
    api.compare('TST', 'OTHER', 2000, 2026, 'security').subscribe();
    api.trend('TST', 'OTHER', 2000, 2026, 'decade', 'security').subscribe();
    const comparison = http.expectOne((request) => request.url === '/api/compare');
    const trend = http.expectOne((request) => request.url === '/api/compare/trend');
    expect(comparison.request.params.get('theme')).toBe('security');
    expect(trend.request.params.get('theme')).toBe('security');
    expect(trend.request.params.get('interval')).toBe('decade');
    comparison.flush({});
    trend.flush({});
  });

  it('requests the matrix with its filters and keeps null cells below the threshold', () => {
    const next = vi.fn();
    api.matrix(2000, 2026, 20, 'environment').subscribe(next);
    const request = http.expectOne((request) => request.url === '/api/matrix');
    expect(request.request.params.get('theme')).toBe('environment');
    expect(request.request.params.get('from')).toBe('2000');
    expect(request.request.params.get('to')).toBe('2026');
    expect(request.request.params.get('minVotes')).toBe('20');
    request.flush(testMatrix);
    expect(next).toHaveBeenCalledWith(testMatrix);
  });

  it('requests a matrix limited to the chosen countries, in their order', () => {
    api.matrixSelection(['IND', 'FRA', 'USA'], 2000, 2025, 50, 'security').subscribe();
    const request = http.expectOne((request) => request.url === '/api/matrix/selection');
    expect(request.request.params.get('countries')).toBe('IND,FRA,USA');
    expect(request.request.params.get('from')).toBe('2000');
    expect(request.request.params.get('to')).toBe('2025');
    expect(request.request.params.get('minVotes')).toBe('50');
    expect(request.request.params.get('theme')).toBe('security');
    request.flush(testMatrix);
  });

  it('turns HTTP failures into readable French messages', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain('indisponible');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 404 }))).toContain('pas été trouvée');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 400 }))).toContain('Vérifiez');
  });
});
