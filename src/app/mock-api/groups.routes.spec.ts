import { createGroup, deleteGroup, listGroups, updateGroup } from './groups.routes';
import { exampleGroups, loadState, MockError, MockState, STORAGE_KEY } from './mock-store';

// États fictifs, réservés aux tests des règles de l'API mockée.
function emptyState(): MockState {
  return { groups: [], reports: [] };
}
const draft = { name: '  Groupe de test  ', description: '', memberIds: ['FRA', 'IND'] };

function statusOf(work: () => unknown): number | undefined {
  try {
    work();
  } catch (error) {
    if (error instanceof MockError) return error.status;
    throw error;
  }
  return undefined;
}

describe('mock API: saved state', () => {
  beforeEach(() => localStorage.clear());

  it('creates the two example groups on the first launch only', () => {
    const first = loadState();
    expect(first.groups.map((group) => group.name)).toEqual([
      'Membres permanents du Conseil de sécurité',
      'BRICS (membres fondateurs)',
    ]);
    expect(first.groups[1].memberIds).toEqual(['BRA', 'RUS', 'IND', 'CHN', 'ZAF']);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyState()));
    expect(loadState().groups).toEqual([]);
  });
});

describe('mock API: group rules', () => {
  it('creates a group with a trimmed name, revision 1 and dates', () => {
    const state = emptyState();
    const group = createGroup(state, draft, '2026-11-01T10:00:00.000Z');
    expect(group).toEqual(
      expect.objectContaining({ name: 'Groupe de test', revision: 1, memberIds: ['FRA', 'IND'] }),
    );
    expect(state.groups).toHaveLength(1);
  });

  it('refuses the same invalid drafts as the former API', () => {
    for (const body of [
      { ...draft, name: ' A ' },
      { ...draft, name: 'x'.repeat(81) },
      { ...draft, description: 'x'.repeat(501) },
      { ...draft, memberIds: ['FRA'] },
      { ...draft, memberIds: ['FRA', 'FRA'] },
      { ...draft, memberIds: ['FRA', 'fr'] },
    ])
      expect(statusOf(() => createGroup(emptyState(), body))).toBe(400);
  });

  it('lists the most recently updated groups first', () => {
    const state = { groups: exampleGroups('2026-01-01T00:00:00.000Z'), reports: [] };
    createGroup(state, draft, '2026-02-01T00:00:00.000Z');
    expect(listGroups(state)[0].name).toBe('Groupe de test');
  });

  it('updates only the expected revision and refuses an outdated one with 409', () => {
    const state = emptyState();
    const group = createGroup(state, draft);
    const updated = updateGroup(state, group.id, {
      ...draft,
      name: 'Nouveau nom',
      expectedRevision: 1,
    });
    expect(updated.revision).toBe(2);
    expect(statusOf(() => updateGroup(state, group.id, { ...draft, expectedRevision: 1 }))).toBe(
      409,
    );
    expect(state.groups[0].name).toBe('Nouveau nom');
    expect(statusOf(() => updateGroup(state, 'inconnu', { ...draft, expectedRevision: 1 }))).toBe(
      404,
    );
  });

  it('deletes a group with its reports, only at the expected revision', () => {
    const state = emptyState();
    const group = createGroup(state, draft);
    state.reports.push({ id: 'r1', groupId: group.id } as MockState['reports'][number]);
    expect(statusOf(() => deleteGroup(state, group.id, undefined))).toBe(400);
    expect(statusOf(() => deleteGroup(state, group.id, '2'))).toBe(409);
    deleteGroup(state, group.id, '1');
    expect(state.groups).toEqual([]);
    expect(state.reports).toEqual([]);
  });
});
