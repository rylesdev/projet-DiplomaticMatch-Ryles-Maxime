import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CountryGroup } from '../models/groups.models';
import { GroupAnalysisService } from './group-analysis.service';

const group: CountryGroup = {
  id: 'groupe-test',
  name: 'Groupe de test',
  description: '',
  memberIds: ['FRA', 'IND'],
  revision: 4,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};
const filters = { from: 2000, to: 2025, theme: 'all', minVotes: 20 };

describe('GroupAnalysisService', () => {
  let service: GroupAnalysisService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GroupAnalysisService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('asks the Node API for the members and filters, then marks the result with the group revision', () => {
    const next = vi.fn();
    service.analyze(group, filters).subscribe(next);
    const request = http.expectOne((request) => request.url === '/api/groups/analysis');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('members')).toBe('FRA,IND');
    expect(request.request.params.get('minVotes')).toBe('20');
    request.flush({ memberIds: ['FRA', 'IND'], cohesionPercent: 55 });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'groupe-test', groupRevision: 4, cohesionPercent: 55 }),
    );
  });

  it('analyzes another composition for a scenario, without saving anything', () => {
    service.analyze(group, filters, ['FRA', 'IND', 'BRA']).subscribe();
    const request = http.expectOne((request) => request.url === '/api/groups/analysis');
    expect(request.request.params.get('members')).toBe('FRA,IND,BRA');
    request.flush({});
  });
});
