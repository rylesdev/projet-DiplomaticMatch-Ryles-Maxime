import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Server } from 'miragejs';
import { firstValueFrom } from 'rxjs';
import { CountryGroup } from '../core/models/groups.models';
import { startMockApi } from './mock-api';
import { STORAGE_KEY } from './mock-store';

// Requêtes HTTP réelles d'Angular, interceptées par Mirage : vérifie les routes /mock-api.
describe('mock API (MirageJS)', () => {
  let server: Server;
  let http: HttpClient;

  beforeEach(() => {
    localStorage.clear();
    server = startMockApi('test');
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    http = TestBed.inject(HttpClient);
  });
  afterEach(() => server.shutdown());

  it('serves the example groups and saves a new group in the localStorage', async () => {
    const groups = await firstValueFrom(http.get<CountryGroup[]>('/mock-api/groups'));
    expect(groups).toHaveLength(2);
    const created = await firstValueFrom(
      http.post<CountryGroup>('/mock-api/groups', {
        name: 'Nouveau',
        description: '',
        memberIds: ['FRA', 'IND'],
      }),
    );
    expect(created.revision).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Nouveau');
  });

  it('answers an outdated revision with 409 and the same error format as the Node API', async () => {
    const error = await firstValueFrom(
      http.put('/mock-api/groups/brics-fondateurs', {
        name: 'BRICS',
        description: '',
        memberIds: ['BRA', 'RUS'],
        expectedRevision: 5,
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(409);
    expect((error as HttpErrorResponse).error).toEqual({
      error: 'Le groupe a été modifié. Rechargez sa dernière version avant de continuer.',
    });
  });

  it('deletes a group with 204 at the expected revision', async () => {
    await firstValueFrom(
      http.delete('/mock-api/groups/membres-permanents', { params: { expectedRevision: 1 } }),
    );
    const groups = await firstValueFrom(http.get<CountryGroup[]>('/mock-api/groups'));
    expect(groups.map((group) => group.id)).toEqual(['brics-fondateurs']);
  });
});
