import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  ComparedResolution,
  ComparisonResult,
  Country,
  CountryVote,
  DataMetadata,
  Paginated,
  Resolution,
  ResolutionDetail,
  TrendPoint,
  TrendResult,
  VoteChoice,
} from '../models/api.models';

type JsonObject = Record<string, unknown>;
const voteChoices: VoteChoice[] = ['YES', 'NO', 'ABSTAIN', 'NOT_VOTED', 'UNKNOWN'];

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La réponse de l’API ne respecte pas le format attendu.');
  }
  return value as JsonObject;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Un texte attendu est absent de la réponse API.');
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Une valeur numérique reçue de l’API est invalide.');
  }
  return value;
}

function percentage(value: unknown): number | null {
  if (value === null) return null;
  const result = number(value);
  if (result < 0 || result > 100) throw new Error('Le taux reçu de l’API est invalide.');
  return result;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('La liste reçue de l’API est invalide.');
  return value.map(parse);
}

function choice(value: unknown): VoteChoice {
  if (!voteChoices.includes(value as VoteChoice))
    throw new Error('Un type de vote reçu est inconnu.');
  return value as VoteChoice;
}

function sourceUrl(value: unknown): string {
  const result = string(value);
  if (!/^https:\/\//i.test(result)) throw new Error('Le lien de source reçu est invalide.');
  return result;
}

function country(value: unknown): Country {
  const item = object(value);
  return {
    id: string(item['id']),
    name: string(item['name']),
    nameEn: string(item['nameEn']),
    ...(item['iso3'] === undefined ? {} : { iso3: string(item['iso3']) }),
    voteCount: number(item['voteCount']),
    firstYear: number(item['firstYear']),
    lastYear: number(item['lastYear']),
  };
}

function resolution(value: unknown): Resolution {
  const item = object(value);
  return {
    id: string(item['id']),
    symbol: string(item['symbol']),
    title: string(item['title']),
    date: string(item['date']),
    sourceUrl: sourceUrl(item['sourceUrl']),
  };
}

function page<T>(value: unknown, parse: (item: unknown) => T): Paginated<T> {
  const result = object(value);
  return {
    items: array(result['items'], parse),
    total: number(result['total']),
    page: number(result['page']),
    pageSize: number(result['pageSize']),
  };
}

function countryVote(value: unknown): CountryVote {
  const item = object(value);
  return {
    resolution: resolution(item['resolution']),
    choice: choice(item['choice']),
    rawChoice: string(item['rawChoice']),
  };
}

function comparedResolution(value: unknown): ComparedResolution {
  const item = object(value);
  return {
    resolution: resolution(item['resolution']),
    choiceA: choice(item['choiceA']),
    choiceB: choice(item['choiceB']),
  };
}

function comparison(value: unknown): ComparisonResult {
  const item = object(value);
  const coverage = object(item['coverage']);
  return {
    countryA: country(item['countryA']),
    countryB: country(item['countryB']),
    from: number(item['from']),
    to: number(item['to']),
    commonVoteCount: number(item['commonVoteCount']),
    matchingVoteCount: number(item['matchingVoteCount']),
    differingVoteCount: number(item['differingVoteCount']),
    nonComparableCount: number(item['nonComparableCount']),
    agreementPercent: percentage(item['agreementPercent']),
    dataVersion: string(item['dataVersion']),
    coverage: {
      from: coverage['from'] === null ? null : string(coverage['from']),
      to: coverage['to'] === null ? null : string(coverage['to']),
    },
    divergences: array(item['divergences'], comparedResolution),
  };
}

function trendPoint(value: unknown): TrendPoint {
  const item = object(value);
  return {
    year: number(item['year']),
    commonVoteCount: number(item['commonVoteCount']),
    matchingVoteCount: number(item['matchingVoteCount']),
    agreementPercent: percentage(item['agreementPercent']),
  };
}

function trend(value: unknown): TrendResult {
  const item = object(value);
  const interval = item['interval'];
  if (interval !== 'year' && interval !== 'decade')
    throw new Error('La granularité reçue est invalide.');
  return {
    countryA: country(item['countryA']),
    countryB: country(item['countryB']),
    from: number(item['from']),
    to: number(item['to']),
    interval,
    points: array(item['points'], trendPoint),
    dataVersion: string(item['dataVersion']),
  };
}

function detail(value: unknown): ResolutionDetail {
  const item = object(value);
  const rawTotals = object(item['totals']);
  const totals = Object.fromEntries(
    voteChoices.map((vote) => [vote, number(rawTotals[vote])]),
  ) as Record<VoteChoice, number>;
  return {
    ...resolution(item),
    totals,
    votes: array(item['votes'], (value) => {
      const vote = object(value);
      return {
        country: country(vote['country']),
        choice: choice(vote['choice']),
        rawChoice: string(vote['rawChoice']),
      };
    }),
  };
}

function metadata(value: unknown): DataMetadata {
  const item = object(value);
  const coverage = object(item['coverage']);
  const status = item['status'];
  if (status !== 'official' && status !== 'verified-sample')
    throw new Error('La provenance des données est invalide.');
  return {
    name: string(item['name']),
    version: string(item['version']),
    publishedAt: string(item['publishedAt']),
    downloadedAt: string(item['downloadedAt']),
    sourceUrl: sourceUrl(item['sourceUrl']),
    coverage: { from: string(coverage['from']), to: string(coverage['to']) },
    countryCount: number(item['countryCount']),
    resolutionCount: number(item['resolutionCount']),
    voteCount: number(item['voteCount']),
    license: string(item['license']),
    scope: string(item['scope']),
    status,
  };
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status >= 500)
      return 'Le service de données est indisponible. Réessayez dans un instant.';
    if (error.status === 404) return 'Cette donnée n’a pas été trouvée dans le jeu disponible.';
    if (error.status === 400)
      return 'Vérifiez les pays, les dates et les filtres de votre recherche.';
  }
  return error instanceof Error ? error.message : 'La recherche a échoué. Réessayez.';
}

@Injectable({ providedIn: 'root' })
export class DiplomaticApiService {
  private readonly http = inject(HttpClient);

  metadata(): Observable<DataMetadata> {
    return this.get('/metadata', metadata);
  }
  countries(search = ''): Observable<Country[]> {
    return this.get('/countries', (value) => array(value, country), { search });
  }
  country(id: string): Observable<Country> {
    return this.get(`/countries/${encodeURIComponent(id)}`, country);
  }
  votes(
    id: string,
    from: number,
    to: number,
    pageNumber = 1,
    pageSize = 20,
  ): Observable<Paginated<CountryVote>> {
    return this.get(
      `/countries/${encodeURIComponent(id)}/votes`,
      (value) => page(value, countryVote),
      { from, to, page: pageNumber, pageSize },
    );
  }
  compare(
    countryA: string,
    countryB: string,
    from: number,
    to: number,
  ): Observable<ComparisonResult> {
    return this.get('/compare', comparison, { countryA, countryB, from, to });
  }
  trend(
    countryA: string,
    countryB: string,
    from: number,
    to: number,
    interval: 'year' | 'decade' = 'year',
  ): Observable<TrendResult> {
    return this.get('/compare/trend', trend, { countryA, countryB, from, to, interval });
  }
  resolutions(
    search = '',
    pageNumber = 1,
    pageSize = 20,
    from?: number,
    to?: number,
  ): Observable<Paginated<Resolution>> {
    return this.get('/resolutions', (value) => page(value, resolution), {
      search,
      page: pageNumber,
      pageSize,
      from,
      to,
    });
  }
  resolution(id: string): Observable<ResolutionDetail> {
    return this.get(`/resolutions/${encodeURIComponent(id)}`, detail);
  }

  private get<T>(
    path: string,
    parse: (value: unknown) => T,
    query: Record<string, string | number | undefined> = {},
  ): Observable<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params = params.set(key, value);
    }
    return this.http.get<unknown>(`/api${path}`, { params }).pipe(map(parse));
  }
}
