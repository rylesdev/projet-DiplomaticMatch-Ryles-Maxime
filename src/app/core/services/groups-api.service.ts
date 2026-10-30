import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, TimeoutError } from 'rxjs';
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
import { TIMEOUT_MESSAGE } from './diplomatic-api.service';

export function groupErrorMessage(error: unknown): string {
  if (error instanceof TimeoutError) return TIMEOUT_MESSAGE;
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

// Groupes de pays et rapports. Les réponses sont typées par les interfaces de groups.models.ts.
@Injectable({ providedIn: 'root' })
export class GroupsApiService {
  private readonly http = inject(HttpClient);
  getGroups(): Observable<CountryGroup[]> {
    return this.http.get<CountryGroup[]>('/api/groups');
  }
  getGroup(id: string): Observable<CountryGroup> {
    return this.http.get<CountryGroup>(this.path(id));
  }
  createGroup(draft: GroupDraft): Observable<CountryGroup> {
    return this.http.post<CountryGroup>('/api/groups', draft);
  }
  updateGroup(id: string, draft: GroupDraft, expectedRevision: number): Observable<CountryGroup> {
    return this.http.patch<CountryGroup>(this.path(id), { ...draft, expectedRevision });
  }
  deleteGroup(id: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(this.path(id), {
      params: new HttpParams().set('expectedRevision', expectedRevision),
    });
  }
  preview(id: string, input: GroupPreviewRequest): Observable<GroupAnalysis> {
    return this.http.post<GroupAnalysis>(`${this.path(id)}/preview`, input);
  }
  saveReport(id: string, input: GroupAnalysisRequest): Observable<GroupReport> {
    return this.http.post<GroupReport>(`${this.path(id)}/reports`, input);
  }
  reports(id: string): Observable<GroupReportSummary[]> {
    return this.http.get<GroupReportSummary[]>(`${this.path(id)}/reports`);
  }
  report(id: string, reportId: string): Observable<GroupReport> {
    return this.http.get<GroupReport>(`${this.path(id)}/reports/${encodeURIComponent(reportId)}`);
  }
  suggestions(id: string, input: GroupSuggestionsRequest): Observable<GroupSuggestions> {
    return this.http.post<GroupSuggestions>(`${this.path(id)}/suggestions`, input);
  }
  private path(id: string): string {
    return `/api/groups/${encodeURIComponent(id)}`;
  }
}
