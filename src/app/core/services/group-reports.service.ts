import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CountryGroup,
  GroupAnalysis,
  GroupReport,
  GroupReportSummary,
} from '../models/groups.models';

// Rapports enregistrés par l'API mockée (MirageJS, /mock-api, localStorage) : un instantané
// du groupe et de l'analyse affichée, calculée auparavant par l'API Node.
@Injectable({ providedIn: 'root' })
export class GroupReportsService {
  private readonly http = inject(HttpClient);

  reports(groupId: string): Observable<GroupReportSummary[]> {
    return this.http.get<GroupReportSummary[]>(`${this.path(groupId)}/reports`);
  }
  report(groupId: string, reportId: string): Observable<GroupReport> {
    return this.http.get<GroupReport>(
      `${this.path(groupId)}/reports/${encodeURIComponent(reportId)}`,
    );
  }
  // La version attendue refuse un rapport si le groupe a changé entre-temps (409).
  saveReport(group: CountryGroup, analysis: GroupAnalysis): Observable<GroupReport> {
    return this.http.post<GroupReport>(`${this.path(group.id)}/reports`, {
      expectedRevision: group.revision,
      analysis,
    });
  }
  private path(groupId: string): string {
    return `/mock-api/groups/${encodeURIComponent(groupId)}`;
  }
}
