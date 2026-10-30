import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, switchMap, throwError, TimeoutError } from 'rxjs';
import { CountryGroup, GroupDraft } from '../models/groups.models';
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
    // 400 : message de validation renvoyé par l'API mockée ou l'API Node ({ error: '...' }).
    const body: unknown = error.error;
    if (error.status === 400 && body && typeof body === 'object') {
      const message = (body as Record<string, unknown>)['error'];
      if (typeof message === 'string') return message;
    }
  }
  return error instanceof Error ? error.message : 'La demande concernant ce groupe a échoué.';
}

// Groupes de pays, enregistrés par l'API mockée (MirageJS, /mock-api, localStorage).
@Injectable({ providedIn: 'root' })
export class GroupsApiService {
  private readonly http = inject(HttpClient);
  getGroups(): Observable<CountryGroup[]> {
    return this.http.get<CountryGroup[]>('/mock-api/groups');
  }
  getGroup(id: string): Observable<CountryGroup> {
    return this.http.get<CountryGroup>(this.path(id));
  }
  createGroup(draft: GroupDraft): Observable<CountryGroup> {
    return this.http.post<CountryGroup>('/mock-api/groups', draft);
  }
  updateGroup(id: string, draft: GroupDraft, expectedRevision: number): Observable<CountryGroup> {
    return this.http.put<CountryGroup>(this.path(id), { ...draft, expectedRevision });
  }
  deleteGroup(id: string, expectedRevision: number): Observable<void> {
    return this.http.delete<void>(this.path(id), {
      params: new HttpParams().set('expectedRevision', expectedRevision),
    });
  }
  // Révisions : avant un calcul, vérifie que le groupe affiché est toujours la dernière
  // version enregistrée (un autre onglet a pu le modifier). Sinon, erreur 409 comme une écriture.
  checkRevision(group: CountryGroup): Observable<CountryGroup> {
    return this.getGroup(group.id).pipe(
      switchMap((current) =>
        current.revision === group.revision
          ? of(current)
          : throwError(() => new HttpErrorResponse({ status: 409, url: this.path(group.id) })),
      ),
    );
  }
  private path(id: string): string {
    return `/mock-api/groups/${encodeURIComponent(id)}`;
  }
}
