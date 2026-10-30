import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ComparisonResult,
  ConcordanceMatrix,
  Country,
  CountryRankings,
  CountryVote,
  DataMetadata,
  Paginated,
  Resolution,
  ResolutionDetail,
  TrendResult,
  Theme,
} from '../models/api.models';

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

// Lectures de l'API Node (/api). Les réponses sont typées par les interfaces de api.models.ts.
@Injectable({ providedIn: 'root' })
export class DiplomaticApiService {
  private readonly http = inject(HttpClient);

  metadata(): Observable<DataMetadata> {
    return this.get<DataMetadata>('/metadata');
  }
  themes(): Observable<Theme[]> {
    return this.get<Theme[]>('/themes');
  }
  matrix(from: number, to: number, minVotes = 20, theme = 'all'): Observable<ConcordanceMatrix> {
    return this.get<ConcordanceMatrix>('/matrix', { from, to, minVotes, theme });
  }
  countries(search = ''): Observable<Country[]> {
    return this.get<Country[]>('/countries', { search });
  }
  country(id: string): Observable<Country> {
    return this.get<Country>(`/countries/${encodeURIComponent(id)}`);
  }
  rankings(
    id: string,
    from: number,
    to: number,
    minVotes = 20,
    theme = 'all',
  ): Observable<CountryRankings> {
    return this.get<CountryRankings>(`/countries/${encodeURIComponent(id)}/rankings`, {
      from,
      to,
      minVotes,
      theme,
    });
  }
  votes(
    id: string,
    from: number,
    to: number,
    pageNumber = 1,
    pageSize = 20,
  ): Observable<Paginated<CountryVote>> {
    return this.get<Paginated<CountryVote>>(`/countries/${encodeURIComponent(id)}/votes`, {
      from,
      to,
      page: pageNumber,
      pageSize,
    });
  }
  compare(
    countryA: string,
    countryB: string,
    from: number,
    to: number,
    theme = 'all',
  ): Observable<ComparisonResult> {
    return this.get<ComparisonResult>('/compare', { countryA, countryB, from, to, theme });
  }
  trend(
    countryA: string,
    countryB: string,
    from: number,
    to: number,
    interval: 'year' | 'decade' = 'year',
    theme = 'all',
  ): Observable<TrendResult> {
    return this.get<TrendResult>('/compare/trend', {
      countryA,
      countryB,
      from,
      to,
      interval,
      theme,
    });
  }
  resolutions(
    search = '',
    pageNumber = 1,
    pageSize = 20,
    from?: number,
    to?: number,
  ): Observable<Paginated<Resolution>> {
    return this.get<Paginated<Resolution>>('/resolutions', {
      search,
      page: pageNumber,
      pageSize,
      from,
      to,
    });
  }
  resolution(id: string): Observable<ResolutionDetail> {
    return this.get<ResolutionDetail>(`/resolutions/${encodeURIComponent(id)}`);
  }

  // Ajoute les paramètres définis à l'URL : /api/compare?countryA=FRA&...
  private get<T>(path: string, query: Record<string, string | number | undefined> = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params = params.set(key, value);
    }
    return this.http.get<T>(`/api${path}`, { params });
  }
}
