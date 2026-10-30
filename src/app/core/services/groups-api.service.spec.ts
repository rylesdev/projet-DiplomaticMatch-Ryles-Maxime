import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CountryGroup } from '../models/groups.models';
import { GroupsApiService, groupErrorMessage } from './groups-api.service';

// Groupe fictif : uniquement destiné aux tests des requêtes vers l'API mockée.
const fixtureGroup: CountryGroup = {
  id: 'group/test',
  name: 'Groupe de test',
  description: 'Fixture',
  memberIds: ['TST', 'OTHER'],
  revision: 1,
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};

describe('GroupsApiService', () => {
  let api: GroupsApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GroupsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads the groups from the mock API and encodes a group identifier', () => {
    const list = vi.fn();
    api.getGroups().subscribe(list);
    api.getGroup(fixtureGroup.id).subscribe();
    http.expectOne('/mock-api/groups').flush([fixtureGroup]);
    http.expectOne('/mock-api/groups/group%2Ftest').flush(fixtureGroup);
    expect(list).toHaveBeenCalledWith([fixtureGroup]);
  });

  it('creates with POST, replaces with PUT and deletes with the expected revision', () => {
    const draft = { name: 'Nouveau', description: '', memberIds: ['TST', 'OTHER'] };
    api.createGroup(draft).subscribe();
    const create = http.expectOne('/mock-api/groups');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(draft);
    create.flush(fixtureGroup, { status: 201, statusText: 'Created' });

    api.updateGroup(fixtureGroup.id, draft, 3).subscribe();
    const update = http.expectOne('/mock-api/groups/group%2Ftest');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ ...draft, expectedRevision: 3 });
    update.flush(fixtureGroup);

    api.deleteGroup(fixtureGroup.id, 3).subscribe();
    const remove = http.expectOne((request) => request.url === '/mock-api/groups/group%2Ftest');
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.params.get('expectedRevision')).toBe('3');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('accepts a calculation only for the saved revision, and answers 409 otherwise', () => {
    const next = vi.fn();
    const error = vi.fn();
    api.checkRevision(fixtureGroup).subscribe(next);
    http.expectOne('/mock-api/groups/group%2Ftest').flush(fixtureGroup);
    expect(next).toHaveBeenCalledWith(fixtureGroup);

    api.checkRevision(fixtureGroup).subscribe({ error });
    http.expectOne('/mock-api/groups/group%2Ftest').flush({ ...fixtureGroup, revision: 2 });
    expect((error.mock.calls[0][0] as HttpErrorResponse).status).toBe(409);
    expect(groupErrorMessage(error.mock.calls[0][0])).toContain('a été modifié');
  });

  it('shows the validation message sent with a 400 response', () => {
    expect(
      groupErrorMessage(
        new HttpErrorResponse({
          status: 400,
          error: { error: 'Le nom du groupe doit contenir entre 2 et 80 caractères.' },
        }),
      ),
    ).toBe('Le nom du groupe doit contenir entre 2 et 80 caractères.');
    expect(groupErrorMessage(new HttpErrorResponse({ status: 404 }))).toContain('n’existe plus');
  });
});
