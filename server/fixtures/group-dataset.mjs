import { syntheticDataset } from './synthetic-dataset.mjs';

// Données inventées pour les tests uniquement.
export function groupDataset() {
  const dataset = syntheticDataset();
  dataset.countries = ['FRA', 'IND', 'BRA', 'CAN', 'BEL', 'USA', 'ZZZ'].map((id) => ({
    id,
    name: id,
    nameEn: id,
    voteCount: 0,
    firstYear: 2020,
    lastYear: 2024,
  }));
  const codes = new Map(dataset.countries.map((country, index) => [country.id, index]));
  const rows = [
    [
      '2020-01-01',
      { FRA: 'Y', IND: 'Y', BRA: 'N', CAN: 'Y', BEL: 'Y', USA: 'Y', ZZZ: 'X' },
      ['ENVIRONMENT'],
    ],
    ['2020-12-31', { FRA: 'Y', IND: 'Y', CAN: 'Y', BEL: 'N', USA: 'X', ZZZ: 'X' }, ['DISARMAMENT']],
    ['2021-01-01', { FRA: 'A', IND: 'A', CAN: 'A', BEL: 'A', USA: 'Y', ZZZ: '?' }, ['ENVIRONMENT']],
    [
      '2021-12-31',
      { FRA: 'X', IND: 'Y', BRA: 'Y', CAN: 'Y', BEL: 'Y', USA: 'Y', ZZZ: 'X' },
      ['DISARMAMENT'],
    ],
    ['2022-01-01', { FRA: '?', IND: 'X', BRA: 'X', CAN: 'X', BEL: 'Y', USA: 'Y', ZZZ: 'X' }, []],
    ['2022-06-01', { FRA: 'N', BRA: 'Y', CAN: 'N', BEL: 'N', USA: 'N', ZZZ: 'X' }, ['ENVIRONMENT']],
  ];
  dataset.resolutions = rows.map(([date, choices, subjects], index) => ({
    id: String(index + 1),
    symbol: `TEST/GROUP/${index + 1}`,
    title: 'Résolution fictive de groupe',
    date,
    sourceUrl: 'https://example.test/fixture',
    subjects,
    votes: Object.entries(choices).map(([id, raw]) => [codes.get(id), raw]),
  }));
  return dataset;
}

export const groupFilters = { from: 2020, to: 2022, theme: 'all', minVotes: 2 };
