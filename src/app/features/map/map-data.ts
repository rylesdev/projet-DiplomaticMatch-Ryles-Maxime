import { ConcordanceMatrix, Country } from '../../core/models/api.models';
import { concordanceColor } from '../matrix/matrix-colors';

export interface WorldMap {
  width: number;
  height: number;
  countries: { id: string; name: string; path: string }[];
}

export interface MapCountry {
  id: string;
  name: string;
  path: string;
  country: Country | null;
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

// Une entité historique garde son propre code : aucune fusion avec un État actuel.
export function mapCountries(
  geography: WorldMap | null,
  matrix: ConcordanceMatrix | null,
  referenceId: string,
): MapCountry[] {
  if (!geography) return [];
  const row = matrix?.countries.findIndex((country) => country.id === referenceId) ?? -1;
  const columns = new Map<string, number>();
  matrix?.countries.forEach((country, index) => columns.set(country.iso3 ?? country.id, index));
  return geography.countries.map((shape) => {
    const column = columns.get(shape.id);
    const country = column === undefined ? null : matrix!.countries[column];
    const hasPair = row >= 0 && column !== undefined;
    const percentage = hasPair ? matrix!.agreementPercents[row][column] : null;
    return {
      ...shape,
      name: country?.name ?? shape.name,
      country,
      percentage,
      common: hasPair ? matrix!.commonVoteCounts[row][column] : 0,
      matching: hasPair ? matrix!.matchingVoteCounts[row][column] : 0,
      color: concordanceColor(percentage),
    };
  });
}
