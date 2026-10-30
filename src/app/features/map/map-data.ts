import { ConcordanceEntry, ConcordanceRow } from '../../core/models/api.models';
import { concordanceColor } from '../../shared/concordance-colors';

export interface WorldMap {
  width: number;
  height: number;
  countries: { id: string; name: string; path: string }[];
}

export interface MapCountry {
  id: string;
  name: string;
  path: string;
  // Pays du jeu de votes dessiné par ce contour (null : contour sans votes).
  country: ConcordanceEntry | null;
  percentage: number | null;
  common: number;
  matching: number;
  color: string;
}

export function parseWorldMap(value: unknown): WorldMap {
  if (!value || typeof value !== 'object') throw new Error('Le fond de carte est invalide.');
  const map = value as Record<string, unknown>;
  if (
    typeof map['width'] !== 'number' ||
    !Number.isFinite(map['width']) ||
    map['width'] <= 0 ||
    typeof map['height'] !== 'number' ||
    !Number.isFinite(map['height']) ||
    map['height'] <= 0 ||
    !Array.isArray(map['countries']) ||
    !map['countries'].length
  )
    throw new Error('Le fond de carte est invalide.');
  const ids = new Set<string>();
  const countries = map['countries'].map((value: unknown) => {
    const item = value as Record<string, unknown> | null;
    if (
      !item ||
      typeof item['id'] !== 'string' ||
      typeof item['name'] !== 'string' ||
      typeof item['path'] !== 'string' ||
      !item['path'].startsWith('M') ||
      ids.has(item['id'])
    ) {
      throw new Error('Un pays du fond de carte est invalide.');
    }
    ids.add(item['id']);
    return { id: item['id'], name: item['name'], path: item['path'] };
  });
  return { width: map['width'], height: map['height'], countries };
}

// Colore chaque contour selon sa concordance avec le pays de référence (ligne reçue de l'API).
// Une entité historique garde son propre code : aucune fusion avec un État actuel.
export function mapCountries(geography: WorldMap | null, row: ConcordanceRow | null): MapCountry[] {
  if (!geography) return [];
  const entries = new Map<string, ConcordanceEntry>();
  row?.entries.forEach((entry) => entries.set(entry.iso3 ?? entry.id, entry));
  return geography.countries.map((shape) => {
    const country = entries.get(shape.id) ?? null;
    const percentage = country?.agreementPercent ?? null;
    return {
      ...shape,
      name: country?.name ?? shape.name,
      country,
      percentage,
      common: country?.commonVoteCount ?? 0,
      matching: country?.matchingVoteCount ?? 0,
      color: concordanceColor(percentage),
    };
  });
}
