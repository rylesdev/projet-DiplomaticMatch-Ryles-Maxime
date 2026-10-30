import { Response } from 'miragejs';
import { CountryGroup, GroupReport } from '../core/models/groups.models';

// Données créées par l'utilisateur (groupes et rapports), sauvegardées dans le navigateur.
export interface MockState {
  groups: CountryGroup[];
  reports: GroupReport[];
}

export const STORAGE_KEY = 'diplomatic-match-mock-api';

// Erreur prévue : la route renvoie ce statut HTTP et ce message, comme l'API Node.
export class MockError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Groupes proposés au premier lancement, quand le navigateur n'a encore rien enregistré.
export function exampleGroups(now: string): CountryGroup[] {
  return [
    {
      id: 'membres-permanents',
      name: 'Membres permanents du Conseil de sécurité',
      description: 'Les cinq États disposant d’un droit de veto.',
      memberIds: ['CHN', 'USA', 'FRA', 'GBR', 'RUS'],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'brics-fondateurs',
      name: 'BRICS (membres fondateurs)',
      description: 'Brésil, Russie, Inde, Chine et Afrique du Sud.',
      memberIds: ['BRA', 'RUS', 'IND', 'CHN', 'ZAF'],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// Relue à chaque requête : un onglet voit ce qu'un autre onglet vient d'enregistrer.
export function loadState(storage: Storage = localStorage): MockState {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved) as MockState;
  const state = { groups: exampleGroups(new Date().toISOString()), reports: [] };
  saveState(state, storage);
  return state;
}

export function saveState(state: MockState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function findGroup(state: MockState, id: string): CountryGroup {
  const group = state.groups.find((item) => item.id === id);
  if (!group) throw new MockError(404, 'Ce groupe n’existe pas.');
  return group;
}

// Révision : refuse une écriture faite à partir d'une version périmée du groupe (409).
export function requireRevision(group: CountryGroup, expected: unknown): void {
  if (!Number.isInteger(expected) || (expected as number) < 1)
    throw new MockError(400, 'La révision attendue est obligatoire.');
  if (group.revision !== expected)
    throw new MockError(
      409,
      'Le groupe a été modifié. Rechargez sa dernière version avant de continuer.',
    );
}

// Lit le corps JSON d'une requête ; un corps illisible donne une erreur 400.
export function readBody(requestBody: string): Record<string, unknown> {
  try {
    const body: unknown = JSON.parse(requestBody);
    if (body && typeof body === 'object' && !Array.isArray(body))
      return body as Record<string, unknown>;
  } catch {
    // Traité juste après.
  }
  throw new MockError(400, 'Le corps de la requête doit être un objet JSON.');
}

// Exécute une règle sur l'état sauvegardé, enregistre si besoin, et transforme les erreurs
// prévues en réponses HTTP (400, 404, 409) avec le même format que l'API Node.
export function respond(status: number, work: (state: MockState) => unknown, save: boolean) {
  try {
    const state = loadState();
    const body = work(state);
    if (save) saveState(state);
    return status === 204 ? new Response(204) : new Response(status, {}, body as object);
  } catch (error) {
    if (error instanceof MockError) return new Response(error.status, {}, { error: error.message });
    throw error;
  }
}
