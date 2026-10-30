import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTradeXmlChunks, tradeCountryCodes } from '../scripts/import-trade.mjs';

test('import commerce : un pays actuel sans propriété iso3 facultative conserve son code exact', () => {
  assert.deepEqual([...tradeCountryCodes([{ id: 'AFG', name: 'Afghanistan' }])], ['AFG']);
});

test('import commerce : les neuf entités historiques ne sont jamais rattachées à leurs successeurs', () => {
  const historicalCountries = [
    { id: 'SUN', iso3: 'RUS' },
    { id: 'DDR', iso3: 'DEU' },
    { id: 'GER', iso3: 'DEU' },
    { id: 'CSK', iso3: 'CZE' },
    { id: 'YUG', iso3: 'SRB' },
    { id: 'SCG', iso3: 'SRB' },
    { id: 'YMD', iso3: 'YEM' },
    { id: 'EAT', iso3: 'TZA' },
    { id: 'EAZ', iso3: 'TZA' },
  ];
  assert.deepEqual([...tradeCountryCodes(historicalCountries)], []);
  assert.deepEqual([...tradeCountryCodes([
    ...historicalCountries,
    { id: 'RUS' },
    { id: 'DEU', iso3: 'DEU' },
  ])].sort(), ['DEU', 'RUS']);
});

test('import commerce : une correspondance iso3 explicite remplace uniquement le code courant', () => {
  const codes = tradeCountryCodes([
    { id: 'source-france', iso3: 'FRA' },
    { id: 'FRA' },
    { id: 'source-inde', iso3: 'IND' },
    { id: 'AFG', iso3: null },
  ]);
  assert.deepEqual([...codes].sort(), ['AFG', 'FRA', 'IND']);
});

test('import commerce : seuls les codes composés de trois lettres majuscules sont conservés', () => {
  const codes = tradeCountryCodes([
    { id: 'AFG' },
    { id: 'fr' },
    { id: 'fra' },
    { id: 'Fra' },
    { id: 'FRAN' },
    { id: '123' },
    { id: 'FRA ' },
    { id: ' FRA' },
    { id: 'FRA', iso3: 'fra' },
    { id: 'IND', iso3: 123 },
    { id: 'BRA', iso3: '' },
  ]);
  assert.deepEqual([...codes], ['AFG']);
});

const opening = '<?xml version="1.0"?><message:StructureSpecificData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"><message:DataSet>';
const closing = '</message:DataSet></message:StructureSpecificData>';

function series(observations, overrides = {}) {
  const attributes = {
    COUNTRY: 'FRA',
    INDICATOR: 'XG_FOB_USD',
    COUNTERPART_COUNTRY: 'IND',
    FREQUENCY: 'A',
    SCALE: '6',
    ...overrides,
  };
  return `<Series ${Object.entries(attributes).map(([key, value]) => `${key}="${value}"`).join(' ')}>${observations}</Series>`;
}

async function collect(chunks) {
  const observations = [];
  for await (const observation of parseTradeXmlChunks(chunks)) observations.push(observation);
  return observations;
}

test('import commerce : toutes les frontières de chunks conservent les séries et observations', async () => {
  const xml = opening
    + series('<Obs TIME_PERIOD="2020" OBS_VALUE="6562106659" DERIVATION_TYPE="M"/>')
    + series('<Obs TIME_PERIOD="2024" OBS_VALUE="0" DERIVATION_TYPE="O" STATUS="e"/>', {
      COUNTRY: 'IND', COUNTERPART_COUNTRY: 'FRA',
    })
    + closing;
  const expected = [
    { exporter: 'FRA', importer: 'IND', year: 2020, value: 6562106659, derivationType: 'M', status: null },
    { exporter: 'IND', importer: 'FRA', year: 2024, value: 0, derivationType: 'O', status: 'e' },
  ];
  for (let boundary = 0; boundary <= xml.length; boundary++) {
    assert.deepEqual(await collect([xml.slice(0, boundary), xml.slice(boundary)]), expected,
      `Découpe à l’octet ${boundary}`);
  }
  assert.deepEqual(await collect([...xml]), expected, 'Flux découpé caractère par caractère');
});

test('import commerce : valeur absente, valeur vide et vrai zéro restent distincts', async () => {
  const observations = await collect([opening + series(
    '<Obs TIME_PERIOD="2020"/>'
    + '<Obs TIME_PERIOD="2021" OBS_VALUE=""/>'
    + '<Obs TIME_PERIOD="2022" OBS_VALUE="0"/>'
    + '<Obs TIME_PERIOD="2023" OBS_VALUE="1.25e3"/>',
  ) + closing]);
  assert.deepEqual(observations.map((row) => row.value), [null, null, 0, 1250]);
  assert.deepEqual(observations.map((row) => row.derivationType), [null, null, null, null]);
  assert.deepEqual(observations.map((row) => row.status), [null, null, null, null]);
});

test('import commerce : les USD de la nouvelle API ne sont pas remultipliés par SCALE=6', async () => {
  // Référence FMI France → Inde 2020 : 6 562,106659 millions de dollars.
  const [observation] = await collect([opening + series(
    '<Obs TIME_PERIOD="2020" OBS_VALUE="6562106659" DERIVATION_TYPE="M"/>',
  ) + closing]);
  assert.equal(observation.value, 6562106659);
});

test('import commerce : le statut estimé minuscule et la dérivation sont préservés séparément', async () => {
  const observations = await collect([opening + series(
    '<Obs TIME_PERIOD="2020" OBS_VALUE="47964" STATUS="e" DERIVATION_TYPE="M"/>'
    + '<Obs TIME_PERIOD="2021" OBS_VALUE="15816" DERIVATION_TYPE="M"/>',
  ) + closing]);
  assert.deepEqual(observations.map(({ status, derivationType }) => ({ status, derivationType })), [
    { status: 'e', derivationType: 'M' },
    { status: null, derivationType: 'M' },
  ]);
});

for (const amount of ['-1', 'NaN', 'Infinity', '1e309', '1,25', ' ']) {
  test(`import commerce : montant invalide refusé (${JSON.stringify(amount)})`, async () => {
    await assert.rejects(() => collect([opening + series(
      `<Obs TIME_PERIOD="2024" OBS_VALUE="${amount}"/>`,
    ) + closing]), /Montant SDMX invalide/);
  });
}

for (const year of ['2024-01', '2024.5', 'twenty', '']) {
  test(`import commerce : année non annuelle refusée (${JSON.stringify(year)})`, async () => {
    await assert.rejects(() => collect([opening + series(
      `<Obs TIME_PERIOD="${year}" OBS_VALUE="1"/>`,
    ) + closing]), /Année SDMX invalide/);
  });
}

test('import commerce : indicateur importations, fréquence mensuelle et pays absents sont refusés', async () => {
  for (const overrides of [
    { INDICATOR: 'MG_CIF_USD' },
    { FREQUENCY: 'M' },
    { COUNTRY: '' },
    { COUNTERPART_COUNTRY: '' },
  ]) {
    await assert.rejects(() => collect([opening + series(
      '<Obs TIME_PERIOD="2024" OBS_VALUE="1"/>', overrides,
    ) + closing]), /Série SDMX incompatible/);
  }
});

test('import commerce : un document tronqué ou une série sans observation échoue explicitement', async () => {
  const validSeries = series('<Obs TIME_PERIOD="2024" OBS_VALUE="1"/>');
  for (const xml of [
    opening + validSeries,
    opening + validSeries.slice(0, -'</Series>'.length) + closing,
    opening + validSeries + '<Series COUNTRY="IND"' + closing,
    opening + series('') + closing,
    opening + closing,
    '<html>Service indisponible</html>',
  ]) {
    await assert.rejects(() => collect([xml]), /incomplet|incompatible|sans observation/);
  }
});

test('import commerce : les déclarations XML externes sont refusées même entre deux chunks', async () => {
  await assert.rejects(() => collect([
    '<!DOC',
    'TYPE data [<!ENTITY remote SYSTEM "https://example.invalid/private">]>',
    opening + series('<Obs TIME_PERIOD="2024" OBS_VALUE="1"/>') + closing,
  ]), /déclarations XML externes/);
});
