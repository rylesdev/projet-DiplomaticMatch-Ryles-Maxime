import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { CountryGroup, GroupAnalysis, GroupAnalysisFilters } from '../models/groups.models';

// Analyse d'un groupe calculée par l'API Node (GET /api/groups/analysis) à partir de la liste
// de ses membres. Le résultat est marqué avec le groupe et la version pour lesquels il a été
// demandé : l'interface vérifie ainsi qu'il correspond toujours au groupe enregistré.
@Injectable({ providedIn: 'root' })
export class GroupAnalysisService {
  private readonly http = inject(HttpClient);

  analyze(
    group: CountryGroup,
    filters: GroupAnalysisFilters,
    memberIds = group.memberIds,
  ): Observable<GroupAnalysis> {
    return this.http
      .get<Omit<GroupAnalysis, 'groupId' | 'groupRevision'>>('/api/groups/analysis', {
        params: { members: memberIds.join(','), ...filters },
      })
      .pipe(map((analysis) => ({ ...analysis, groupId: group.id, groupRevision: group.revision })));
  }
}
