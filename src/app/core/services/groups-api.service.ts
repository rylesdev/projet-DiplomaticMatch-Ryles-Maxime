import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  CountryGroup,
  GroupAnalysis,
  GroupAnalysisRequest,
  GroupDraft,
  GroupPreviewRequest,
  GroupReport,
  GroupReportSummary,
  GroupSuggestions,
  GroupSuggestionsRequest,
} from '../models/groups.models';
import {
  countryGroup,
  groupAnalysis,
  groupList,
  groupReport,
  groupReportSummary,
  groupSuggestions,
} from './groups-api.validation';

export function groupErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409)
      return 'Ce groupe a été modifié depuis son ouverture. Rechargez-le avant de réessayer : vos modifications ne seront pas écrasées automatiquement.';
    if (error.status === 0 || error.status >= 500)
      return 'Le service des groupes est indisponible. Réessayez dans un instant.';
    if (error.status === 404)
      return 'Ce groupe ou ce rapport n’existe plus. Rechargez la liste des groupes.';
    const body: unknown = error.error;
    if ([400, 413, 415, 422].includes(error.status) && body && typeof body === 'object') {
      const item = body as Record<string, unknown>;
      const message = typeof item['message'] === 'string' ? item['message'] : item['error'];
      if (typeof message === 'string') return message;
    }
    if (error.status === 413) return 'La demande est trop volumineuse. Réduisez son contenu.';
    if (error.status === 415) return 'Le format de la demande n’est pas accepté par le serveur.';
  }
  return error instanceof Error ? error.message : 'La demande concernant ce groupe a échoué.';
}

@Injectable({ providedIn: 'root' })
export class GroupsApiService {
  private readonly http = inject(HttpClient);
  getGroups(): Observable<CountryGroup[]> {
    return this.http
      .get<unknown>('/api/groups')
      .pipe(map((value) => groupList(value, countryGroup)));
  }
  getGroup(id: string): Observable<CountryGroup> {
    return this.http.get<unknown>(this.path(id)).pipe(map(countryGroup));
  }
  createGroup(draft: GroupDraft): Observable<CountryGroup> {
    return this.http.post<unknown>('/api/groups', draft).pipe(map(countryGroup));
  }
  updateGroup(id: string, draft: GroupDraft, expectedRevision: number): Observable<CountryGroup> {
    return this.http
      .patch<unknown>(this.path(id), { ...draft, expectedRevision })
      .pipe(map(countryGroup));
  }
  deleteGroup(id: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(this.path(id), {
      params: new HttpParams().set('expectedRevision', expectedRevision),
    });
  }
  preview(id: string, input: GroupPreviewRequest): Observable<GroupAnalysis> {
    return this.http.post<unknown>(`${this.path(id)}/preview`, input).pipe(map(groupAnalysis));
  }
  saveReport(id: string, input: GroupAnalysisRequest): Observable<GroupReport> {
    return this.http.post<unknown>(`${this.path(id)}/reports`, input).pipe(map(groupReport));
  }
  reports(id: string): Observable<GroupReportSummary[]> {
    return this.http
      .get<unknown>(`${this.path(id)}/reports`)
      .pipe(map((value) => groupList(value, groupReportSummary)));
  }
  report(id: string, reportId: string): Observable<GroupReport> {
    return this.http
      .get<unknown>(`${this.path(id)}/reports/${encodeURIComponent(reportId)}`)
      .pipe(map(groupReport));
  }
  suggestions(id: string, input: GroupSuggestionsRequest): Observable<GroupSuggestions> {
    return this.http
      .post<unknown>(`${this.path(id)}/suggestions`, input)
      .pipe(map(groupSuggestions));
  }
  private path(id: string): string {
    return `/api/groups/${encodeURIComponent(id)}`;
  }
}
