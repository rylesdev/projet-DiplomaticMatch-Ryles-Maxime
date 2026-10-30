import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CountryGroup, GroupAnalysis } from '../models/groups.models';
import { GroupReportsService } from './group-reports.service';

const group: CountryGroup = {
  id: 'group/test',
  name: 'Groupe de test',
  description: '',
  memberIds: ['FRA', 'IND'],
  revision: 2,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};

describe('GroupReportsService', () => {
  let service: GroupReportsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GroupReportsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('saves the displayed analysis with the expected revision in the mock API', () => {
    const analysis = { memberIds: ['FRA', 'IND'], cohesionPercent: 55 } as GroupAnalysis;
    service.saveReport(group, analysis).subscribe();
    const request = http.expectOne('/mock-api/groups/group%2Ftest/reports');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ expectedRevision: 2, analysis });
    request.flush({}, { status: 201, statusText: 'Created' });
  });

  it('lists the summaries and reads one report', () => {
    service.reports(group.id).subscribe();
    service.report(group.id, 'rapport/1').subscribe();
    http.expectOne('/mock-api/groups/group%2Ftest/reports').flush([]);
    http.expectOne('/mock-api/groups/group%2Ftest/reports/rapport%2F1').flush({});
  });
});
