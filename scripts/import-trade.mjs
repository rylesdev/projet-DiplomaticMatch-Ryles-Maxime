import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  TRADE_FROM,
  TRADE_TO,
  TRADE_SOURCE_URL,
  TRADE_LICENSE_URL,
  TRADE_DOWNLOAD_URL,
  TRADE_RAW,
  TRADE_ACQUISITION,
} from './trade-source.mjs';

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
// Distinct source entities, never mapped to present-day successor states.
const HISTORICAL_CODES = new Set(['SUN', 'DDR', 'GER', 'CSK', 'YUG', 'SCG', 'YMD', 'EAT', 'EAZ']);

export function tradeCountryCodes(countries) {
  return new Set(
    countries
      .filter((country) => !HISTORICAL_CODES.has(country.id))
      .map((country) => country.iso3 ?? country.id)
      .filter((code) => typeof code === 'string' && /^[A-Z]{3}$/.test(code)),
  );
}

function attributes(tag) {
  return Object.fromEntries(
    Array.from(tag.matchAll(/([A-Z_]+)="([^"]*)"/g), (match) => [match[1], match[2]]),
  );
}

// SDMX structure-specific: bounded buffering of a series, preserving observation attributes.
// No XML entity resolution or network lookup is performed by this parser.
export async function* parseTradeXmlChunks(chunks) {
  let buffer = '';
  let tail = '';
  let seriesCount = 0;
  for await (const chunk of chunks) {
    buffer += chunk;
    tail = (tail + chunk).slice(-512);
    if (buffer.includes('<!DOCTYPE') || buffer.includes('<!ENTITY'))
      throw new Error('Les déclarations XML externes ne sont pas acceptées.');
    while (true) {
      const start = buffer.indexOf('<Series ');
      if (start < 0) {
        buffer = buffer.slice(-32);
        break;
      }
      if (start > 0) buffer = buffer.slice(start);
      const end = buffer.indexOf('</Series>');
      if (end < 0) {
        if (buffer.length > 2_000_000) throw new Error('Série SDMX anormalement longue.');
        break;
      }
      const xml = buffer.slice(0, end);
      buffer = buffer.slice(end + '</Series>'.length);
      const series = attributes(xml.slice(0, xml.indexOf('>') + 1));
      if (
        !series.COUNTRY ||
        !series.COUNTERPART_COUNTRY ||
        series.INDICATOR !== 'XG_FOB_USD' ||
        series.FREQUENCY !== 'A'
      )
        throw new Error('Série SDMX incompatible : exportations annuelles FOB attendues.');
      seriesCount++;
      const observations = Array.from(xml.matchAll(/<Obs\s+([^>]*?)\s*\/>/g));
      if (!observations.length) throw new Error('Série SDMX sans observation lisible.');
      for (const observation of observations) {
        const item = attributes(observation[1]);
        if (!/^\d{4}$/.test(item.TIME_PERIOD ?? '')) throw new Error('Année SDMX invalide.');
        const raw = item.OBS_VALUE;
        let value = null;
        if (raw !== undefined && raw !== '') {
          if (!NUMBER.test(raw) || !Number.isFinite(Number(raw)))
            throw new Error('Montant SDMX invalide.');
          value = Number(raw);
        }
        yield {
          exporter: series.COUNTRY,
          importer: series.COUNTERPART_COUNTRY,
          year: Number(item.TIME_PERIOD),
          value,
          derivationType: item.DERIVATION_TYPE || null,
          status: item.STATUS || null,
        };
      }
    }
  }
  if (
    !seriesCount ||
    buffer.includes('<Series ') ||
    !/<\/(?:\w+:)?StructureSpecificData>\s*$/.test(tail)
  )
    throw new Error('Le document SDMX est vide, incomplet ou incompatible.');
}

export async function checksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function downloadTrade() {
  await mkdir(dirname(fileURLToPath(TRADE_RAW)), { recursive: true });
  const temporary = new URL(`${TRADE_RAW.href}.part`);
  console.log(`Téléchargement des exportations FMI ${TRADE_FROM}–${TRADE_TO}…`);
  try {
    const response = await fetch(TRADE_DOWNLOAD_URL, {
      headers: { Accept: 'application/vnd.sdmx.structurespecificdata+xml;version=2.1' },
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok || !response.body) throw new Error(`Réponse FMI HTTP ${response.status}.`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    // Parse once before replacing the prior raw snapshot, so an HTML/error body is never cached.
    let observations = 0;
    for await (const ignored of parseTradeXmlChunks(
      createReadStream(temporary, { encoding: 'utf8' }),
    ))
      observations++;
    await rename(temporary, TRADE_RAW);
    const acquisition = {
      url: TRADE_DOWNLOAD_URL,
      retrievedAt: new Date().toISOString(),
      sha256: await checksum(TRADE_RAW),
      bytes: (await stat(TRADE_RAW)).size,
      observationCount: observations,
    };
    await writeFile(TRADE_ACQUISITION, JSON.stringify(acquisition, null, 2) + '\n');
    console.log(`${observations.toLocaleString('fr-FR')} observations téléchargées.`);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function importTrade() {
  const data = new URL('../data/', import.meta.url);
  const votes = JSON.parse(await readFile(new URL('dataset.json', data), 'utf8'));
  // Many current countries have no optional iso3 property; exact source IDs still match.
  const currentCodes = tradeCountryCodes(votes.countries);
  const acquisition = JSON.parse(
    (await readFile(TRADE_ACQUISITION, 'utf8')).replace(/^\uFEFF/, ''),
  );
  const sourceHash = await checksum(TRADE_RAW);
  if (acquisition.url !== TRADE_DOWNLOAD_URL || acquisition.sha256 !== sourceHash)
    throw new Error('Le fichier source ne correspond pas au manifeste de téléchargement.');
  const derivationDoc = JSON.parse(
    (await readFile(new URL('source-docs/imf-trade-derivation-types.json', data), 'utf8')).replace(
      /^\uFEFF/,
      '',
    ),
  );
  const flows = [];
  const countries = new Set();
  const seen = new Set();
  const counts = {
    source: 0,
    retained: 0,
    outsideCountryScope: 0,
    selfFlows: 0,
    missingValues: 0,
    outsidePeriod: 0,
  };
  const derivations = {};
  const statuses = {};
  for await (const row of parseTradeXmlChunks(createReadStream(TRADE_RAW, { encoding: 'utf8' }))) {
    counts.source++;
    if (row.year < TRADE_FROM || row.year > TRADE_TO) {
      counts.outsidePeriod++;
      continue;
    }
    if (!currentCodes.has(row.exporter) || !currentCodes.has(row.importer)) {
      counts.outsideCountryScope++;
      continue;
    }
    if (row.exporter === row.importer) {
      counts.selfFlows++;
      continue;
    }
    const key = `${row.year}/${row.exporter}/${row.importer}`;
    if (seen.has(key)) throw new Error(`Observation FMI en double : ${key}`);
    seen.add(key);
    if (row.value === null) {
      counts.missingValues++;
      continue;
    }
    if (row.derivationType && !Object.hasOwn(derivationDoc.codes, row.derivationType))
      throw new Error(`Code de dérivation FMI inconnu : ${row.derivationType}`);
    // OBS_VALUE in the new IMF API is already in USD. SCALE is display metadata, not a multiplier.
    flows.push([row.year, row.exporter, row.importer, row.value, row.derivationType, row.status]);
    countries.add(row.exporter);
    countries.add(row.importer);
    derivations[row.derivationType ?? 'unspecified'] =
      (derivations[row.derivationType ?? 'unspecified'] ?? 0) + 1;
    statuses[row.status ?? 'unspecified'] = (statuses[row.status ?? 'unspecified'] ?? 0) + 1;
  }
  if (!flows.length) throw new Error('Aucun flux commercial importé.');
  counts.retained = flows.length;
  flows.sort(
    (a, b) => a[0] - b[0] || a[1].localeCompare(b[1], 'en') || a[2].localeCompare(b[2], 'en'),
  );
  const metadata = {
    sourceName: 'FMI — International Trade in Goods by partner country (IMTS)',
    sourceUrl: TRADE_SOURCE_URL,
    version: `IMTS 1.0.0 · extrait du ${acquisition.retrievedAt.slice(0, 10)}`,
    retrievedAt: acquisition.retrievedAt,
    unit: 'USD',
    priceBasis: 'current',
    valuation: 'FOB',
    measure: 'goods_exports',
    coverage: { from: flows[0][0], to: flows.at(-1)[0] },
    countryCount: countries.size,
    observationCount: flows.length,
    derivationTypes: derivationDoc.codes,
    licenseUrl: TRADE_LICENSE_URL,
    attribution:
      'Source : Fonds monétaire international, IMTS. Extraction et mise en regard avec les votes : Diplomatic Match.',
  };
  const dataset = { schemaVersion: 1, metadata, countries: [...countries].sort(), flows };
  const output = new URL('trade-dataset.json', data);
  await writeFile(output, JSON.stringify(dataset) + '\n');
  const manifest = {
    schemaVersion: 1,
    source: acquisition,
    metadata,
    transformations: [
      'XG_FOB_USD annuel : valeurs USD de l’API conservées sans multiplication par SCALE.',
      'Correspondance exacte ISO3 ou code pays source ; neuf entités historiques et les agrégats sont exclus.',
      'Aucune substitution par une importation miroir, aucun remplissage ni interpolation des valeurs manquantes.',
      'DERIVATION_TYPE et STATUS conservés pour chaque observation ; STATUS=e identifie les estimations signalées par le FMI.',
    ],
    counts,
    derivations,
    statuses,
    output: {
      path: 'data/trade-dataset.json',
      sha256: await checksum(output),
      bytes: (await stat(output)).size,
    },
  };
  await writeFile(new URL('trade-manifest.json', data), JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `Commerce : ${flows.length.toLocaleString('fr-FR')} flux, ${countries.size} pays, ${metadata.coverage.from}–${metadata.coverage.to}.`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    if (process.argv.includes('--download')) await downloadTrade();
    else await importTrade();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
