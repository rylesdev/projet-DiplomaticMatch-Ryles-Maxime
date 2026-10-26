// Données inventées UNIQUEMENT pour les tests. Jamais chargées par server/index.mjs.
export function syntheticDataset() {
  const countries = [
    { id: 'FRA', name: 'France', nameEn: 'FRANCE', iso3: 'FRA', voteCount: 4, firstYear: 2020, lastYear: 2024 },
    { id: 'IND', name: 'Inde', nameEn: 'INDIA', iso3: 'IND', voteCount: 4, firstYear: 2020, lastYear: 2024 },
  ];
  const make = (id, date, votes) => ({ id, symbol: `TEST/${id}`, title: `Résolution fictive de test ${id}`, date, sourceUrl: 'https://example.test/fixture', votes });
  return {
    schemaVersion: 1,
    metadata: { name: 'FIXTURE SYNTHÉTIQUE DE TEST', version: 'test', publishedAt: '2024-01-01', downloadedAt: '2024-01-01T00:00:00Z',
      sourceUrl: 'https://example.test/fixture', coverage: { from: '2020-01-01', to: '2024-12-31' }, countryCount: 2, resolutionCount: 6, voteCount: 12,
      license: 'Fixture inventée', scope: 'Tests seulement', status: 'verified-sample' },
    countries,
    resolutions: [
      make('1', '2020-01-01', [[0, 'Y'], [1, 'Y']]),
      make('2', '2020-12-31', [[0, 'N'], [1, 'Y']]),
      make('3', '2021-05-01', [[0, 'A'], [1, 'A']]),
      make('4', '2021-08-01', [[0, 'A'], [1, 'X']]),
      make('5', '2022-06-01', [[0, 'X'], [1, 'X']]),
      make('6', '2024-02-01', [[0, '?'], [1, 'Y']]),
    ],
  };
}
