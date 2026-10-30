import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, TimeoutError } from 'rxjs';
import {
  ComparisonResult,
  ConcordanceMatrix,
  ConcordanceRow,
  Country,
  CountryProfile,
  CountryRankings,
  CountryVote,
  DataMetadata,
  Paginated,
  Resolution,
  ResolutionDetail,
  TrendResult,
  Theme,
} from '../models/api.models';

// Message affiché quand une requête dépasse le délai maximal (http-timeout.interceptor.ts).
export const TIMEOUT_MESSAGE =
  'Le serveur ne répond pas (plus de 15 secondes). Vérifiez que l’API est lancée avec npm start, puis réessayez.';

export function apiErrorMessage(error: unknown): string {
  if (error instanceof TimeoutError) return TIMEOUT_MESSAGE;
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
  // Matrice limitée aux pays choisis (2 à 15), dans l'ordre de la liste.
  matrixSelection(
    countries: string[],
    from: number,
    to: number,
    minVotes = 20,
    theme = 'all',
  ): Observable<ConcordanceMatrix> {
    return this.get<ConcordanceMatrix>('/matrix/selection', {
      countries: countries.join(','),
      from,
      to,
      minVotes,
      theme,
    });
  }
  // Fiche pays : répartition des votes et alignement sur la majorité de séance.
  profile(id: string, from: number, to: number, theme = 'all'): Observable<CountryProfile> {
    return this.get<CountryProfile>(`/countries/${encodeURIComponent(id)}/profile`, {
      from,
      to,
      theme,
    });
  }
  // Ligne du pays de référence (carte) : environ 25 Ko au lieu de la matrice complète.
  concordances(
    id: string,
    from: number,
    to: number,
    minVotes = 20,
    theme = 'all',
  ): Observable<ConcordanceRow> {
    return this.get<ConcordanceRow>(`/countries/${encodeURIComponent(id)}/concordances`, {
      from,
      to,
      minVotes,
      theme,
    });
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
    search = '',
  ): Observable<ComparisonResult> {
    // Mot-clé facultatif : non envoyé quand il est vide.
    return this.get<ComparisonResult>('/compare', {
      countryA,
      countryB,
      from,
      to,
      theme,
      search: search || undefined,
    });
  }
  trend(
    countryA: string,
    countryB: string,
    from: number,
    to: number,
    interval: 'year' | 'decade' = 'year',
    theme = 'all',
    search = '',
  ): Observable<TrendResult> {
    return this.get<TrendResult>('/compare/trend', {
      countryA,
      countryB,
      from,
      to,
      interval,
      theme,
      search: search || undefined,
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
