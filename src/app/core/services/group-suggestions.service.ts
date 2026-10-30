import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CountryGroup, GroupAnalysisFilters, GroupSuggestions } from '../models/groups.models';

// Pays candidats à ajouter à un groupe, calculés par l'API Node (GET /api/groups/suggestions).
@Injectable({ providedIn: 'root' })
export class GroupSuggestionsService {
  private readonly http = inject(HttpClient);

  suggestions(
    group: CountryGroup,
    filters: GroupAnalysisFilters,
    includeHistorical: boolean,
  ): Observable<GroupSuggestions> {
    return this.http
      .get<Omit<GroupSuggestions, 'groupId' | 'groupRevision'>>('/api/groups/suggestions', {
        params: {
          members: group.memberIds.join(','),
          ...filters,
          includeHistorical: String(includeHistorical),
        },
      })
      .pipe(map((result) => ({ ...result, groupId: group.id, groupRevision: group.revision })));
  }
}
