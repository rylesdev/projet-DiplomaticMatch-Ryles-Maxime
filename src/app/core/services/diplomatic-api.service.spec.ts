import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DiplomaticApiService } from './diplomatic-api.service';

// Fixtures fictives, réservées aux tests de validation des réponses HTTP.
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
  furthest: [
    {
      country: { ...testCountry, id: 'FAR' },
      commonVoteCount: 30,
      matchingVoteCount: 3,
      differingVoteCount: 27,
      agreementPercent: 10,
      coverage: { from: '2000-01-01', to: '2026-01-01' },
    },
  ],
  dataVersion: 'Fixture de test',
};
const testMatrix = {
  countries: [testCountry, { ...testCountry, id: 'OTHER' }],
  from: 2000,
  to: 2026,
  minVotes: 20,
  theme: 'environment',
  dataVersion: 'Fixture de test',
  agreementPercents: [
    [100, 50],
    [50, 100],
  ],
  commonVoteCounts: [
    [30, 20],
    [20, 30],
  ],
  matchingVoteCounts: [
    [30, 10],
    [10, 30],
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

  it('sends a country search as an HTTP query and validates the country list', () => {
    const next = vi.fn();
    api.countries('fra').subscribe(next);
    const request = http.expectOne(
      (request) => request.url === '/api/countries' && request.params.get('search') === 'fra',
    );
    expect(request.request.method).toBe('GET');
    request.flush([testCountry]);
    expect(next).toHaveBeenCalledWith([testCountry]);
  });

  it('rejects an unknown vote choice instead of treating it as an abstention', () => {
    const next = vi.fn();
    const error = vi.fn();
    api.votes('TST', 2000, 2000).subscribe({ next, error });
    const request = http.expectOne((request) => request.url === '/api/countries/TST/votes');
    expect(request.request.params.get('from')).toBe('2000');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush({
      items: [{ resolution: testResolution, choice: 'MAYBE', rawChoice: '?' }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(Error));
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

  it('encodes resolution identifiers and rejects unsafe source links', () => {
    const error = vi.fn();
    api.resolution('test/resolution').subscribe({ error });
    const request = http.expectOne('/api/resolutions/test%2Fresolution');
    request.flush({
      ...testResolution,
      sourceUrl: 'javascript:alert(1)',
      votes: [],
      totals: { YES: 0, NO: 0, ABSTAIN: 0, NOT_VOTED: 0, UNKNOWN: 0 },
    });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });

  it('requests a new trend granularity from the API', () => {
    const next = vi.fn();
    api.trend('TST', 'OTHER', 2000, 2020, 'decade').subscribe(next);
    const request = http.expectOne(
      (request) =>
        request.url === '/api/compare/trend' && request.params.get('interval') === 'decade',
    );
    request.flush({
      countryA: testCountry,
      countryB: { ...testCountry, id: 'OTHER' },
      from: 2000,
      to: 2020,
      interval: 'decade',
      points: [],
      dataVersion: 'Fixture de test',
    });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ interval: 'decade', points: [] }));
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
    expect(next).toHaveBeenCalledWith({ ...testRankings, theme: 'all' });
  });

  it('rejects ranking entries without a real concordance percentage', () => {
    const error = vi.fn();
    api.rankings('TST', 2000, 2026).subscribe({ error });
    http
      .expectOne((request) => request.url === '/api/countries/TST/rankings')
      .flush({
        ...testRankings,
        closest: [{ ...testRankings.closest[0], agreementPercent: null }],
      });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects a duplicate country across both ranking lists', () => {
    const error = vi.fn();
    api.rankings('TST', 2000, 2026).subscribe({ error });
    http
      .expectOne((request) => request.url === '/api/countries/TST/rankings')
      .flush({
        ...testRankings,
        furthest: testRankings.closest,
      });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });

  it('loads typed theme choices and their recorded-vote counts', () => {
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

  it('passes a theme to comparisons and trends and preserves the returned theme', () => {
    const comparison = vi.fn();
    const trend = vi.fn();
    api.compare('TST', 'OTHER', 2000, 2026, 'security').subscribe(comparison);
    api.trend('TST', 'OTHER', 2000, 2026, 'decade', 'security').subscribe(trend);
    const comparisonRequest = http.expectOne((request) => request.url === '/api/compare');
    const trendRequest = http.expectOne((request) => request.url === '/api/compare/trend');
    expect(comparisonRequest.request.params.get('theme')).toBe('security');
    expect(trendRequest.request.params.get('theme')).toBe('security');
    comparisonRequest.flush({
      countryA: testCountry,
      countryB: { ...testCountry, id: 'OTHER' },
      from: 2000,
      to: 2026,
      commonVoteCount: 0,
      matchingVoteCount: 0,
      differingVoteCount: 0,
      nonComparableCount: 0,
      agreementPercent: null,
      coverage: { from: null, to: null },
      divergences: [],
      dataVersion: 'Fixture de test',
      theme: 'security',
    });
    trendRequest.flush({
      countryA: testCountry,
      countryB: { ...testCountry, id: 'OTHER' },
      from: 2000,
      to: 2026,
      interval: 'decade',
      points: [],
      dataVersion: 'Fixture de test',
      theme: 'security',
    });
    expect(comparison).toHaveBeenCalledWith(expect.objectContaining({ theme: 'security' }));
    expect(trend).toHaveBeenCalledWith(expect.objectContaining({ theme: 'security' }));
  });

  it('requests and validates the matrix and its query filters', () => {
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

  it('rejects matrix dimensions that do not match the countries', () => {
    const error = vi.fn();
    api.matrix(2000, 2026).subscribe({ error });
    http
      .expectOne((request) => request.url === '/api/matrix')
      .flush({ ...testMatrix, agreementPercents: [[100]] });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects non-numeric matrix counts instead of casting strings', () => {
    const error = vi.fn();
    api.matrix(2000, 2026).subscribe({ error });
    http
      .expectOne((request) => request.url === '/api/matrix')
      .flush({
        ...testMatrix,
        commonVoteCounts: [
          [30, '20'],
          [20, 30],
        ],
      });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
  });

  it('keeps null matrix values below the requested minimum sample size', () => {
    const next = vi.fn();
    api.matrix(2000, 2026, 50).subscribe(next);
    http
      .expectOne((request) => request.url === '/api/matrix')
      .flush({
        ...testMatrix,
        minVotes: 50,
        agreementPercents: [
          [null, null],
          [null, null],
        ],
      });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementPercents: [
          [null, null],
          [null, null],
        ],
      }),
    );
  });
});
