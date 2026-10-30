import { Server } from 'miragejs';
import { CountryGroup, GroupDraft } from '../core/models/groups.models';
import { findGroup, MockError, MockState, readBody, requireRevision, respond } from './mock-store';
import { removeReports } from './reports.routes';

const MAX_GROUPS = 100;

// Mêmes règles que l'ancienne API : nom de 2 à 80 caractères, description de 500 au plus,
// 2 à 12 codes pays distincts. Les codes existants sont contrôlés par l'API Node à l'analyse.
function validateDraft(body: Record<string, unknown>): GroupDraft {
  const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
  const description = body['description'] ?? '';
  const memberIds = body['memberIds'];
  if (name.length < 2 || name.length > 80)
    throw new MockError(400, 'Le nom du groupe doit contenir entre 2 et 80 caractères.');
  if (typeof description !== 'string' || description.length > 500)
    throw new MockError(400, 'La description est limitée à 500 caractères.');
  if (
    !Array.isArray(memberIds) ||
    memberIds.length < 2 ||
    memberIds.length > 12 ||
    memberIds.some((id) => typeof id !== 'string' || !/^[A-Z]{3}$/.test(id))
  )
    throw new MockError(400, 'Un groupe doit contenir entre 2 et 12 États.');
  if (new Set(memberIds).size !== memberIds.length)
    throw new MockError(400, 'Chaque État doit apparaître une seule fois dans le groupe.');
  return { name, description: description.trim(), memberIds: memberIds as string[] };
}

export function listGroups(state: MockState): CountryGroup[] {
  return state.groups.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createGroup(
  state: MockState,
  body: Record<string, unknown>,
  now = new Date().toISOString(),
): CountryGroup {
  const draft = validateDraft(body);
  if (state.groups.length >= MAX_GROUPS)
    throw new MockError(409, 'La limite de 100 groupes est atteinte.');
  const group = { id: crypto.randomUUID(), ...draft, revision: 1, createdAt: now, updatedAt: now };
  state.groups.push(group);
  return group;
}

export function updateGroup(
  state: MockState,
  id: string,
  body: Record<string, unknown>,
  now = new Date().toISOString(),
): CountryGroup {
  const group = findGroup(state, id);
  requireRevision(group, body['expectedRevision']);
  Object.assign(group, validateDraft(body), { revision: group.revision + 1, updatedAt: now });
  return group;
}

export function deleteGroup(state: MockState, id: string, expectedRevision: unknown): void {
  const group = findGroup(state, id);
  requireRevision(group, Number(expectedRevision));
  state.groups = state.groups.filter((item) => item.id !== id);
  removeReports(state, id);
}

// Routes /mock-api/groups (le préfixe est fixé dans mock-api.ts).
export function registerGroupRoutes(server: Server): void {
  server.get('/groups', () => respond(200, (state) => listGroups(state), false));
  server.get('/groups/:id', (_schema, request) =>
    respond(200, (state) => findGroup(state, request.params['id']), false),
  );
  server.post('/groups', (_schema, request) =>
    respond(201, (state) => createGroup(state, readBody(request.requestBody)), true),
  );
  server.put('/groups/:id', (_schema, request) =>
    respond(
      200,
      (state) => updateGroup(state, request.params['id'], readBody(request.requestBody)),
      true,
    ),
  );
  server.delete('/groups/:id', (_schema, request) =>
    respond(
      204,
      (state) => deleteGroup(state, request.params['id'], request.queryParams['expectedRevision']),
      true,
    ),
  );
}
