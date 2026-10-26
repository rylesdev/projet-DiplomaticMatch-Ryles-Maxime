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
});
