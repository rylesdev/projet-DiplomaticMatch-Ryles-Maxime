import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CountryGroup } from '../models/groups.models';
import { GroupSuggestionsService } from './group-suggestions.service';

const group: CountryGroup = {
  id: 'groupe-test',
  name: 'Groupe de test',
  description: '',
  memberIds: ['FRA', 'IND'],
  revision: 3,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};

describe('GroupSuggestionsService', () => {
  it('asks the Node API for candidates with the historical option', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(GroupSuggestionsService);
    const http = TestBed.inject(HttpTestingController);
    const next = vi.fn();
    service
      .suggestions(group, { from: 2000, to: 2025, theme: 'all', minVotes: 20 }, true)
      .subscribe(next);
    const request = http.expectOne((request) => request.url === '/api/groups/suggestions');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('members')).toBe('FRA,IND');
    expect(request.request.params.get('includeHistorical')).toBe('true');
    request.flush({ suggestions: [], includeHistorical: true });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'groupe-test', groupRevision: 3 }),
    );
    http.verify();
  });
});
