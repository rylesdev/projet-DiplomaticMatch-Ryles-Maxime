import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readCsv } from './csv.mjs';
import { SOURCE_FILES, SOURCE_VERSION, PUBLISHED_AT } from './source-config.mjs';
import { normalizeVote } from '../server/domain.mjs';
import {
  assignThemes,
  THEMES,
  THEME_RULES,
  THEME_CLASSIFICATION_VERSION,
} from '../server/themes.mjs';

// Les codes sont conservés tels quels : notamment GER ≠ DEU, SUN ≠ RUS.
// Seuls ces libellés d'affichage français sont traduits ; les noms source restent dans nameEn/aliases.
const FRENCH_NAMES = {
  FRA: 'France',
  IND: 'Inde',
  USA: 'États-Unis',
  GBR: 'Royaume-Uni',
  DEU: 'Allemagne',
  CHN: 'Chine',
  RUS: 'Fédération de Russie',
  BRA: 'Brésil',
  CAN: 'Canada',
  JPN: 'Japon',
  ESP: 'Espagne',
  ITA: 'Italie',
  AUS: 'Australie',
  MEX: 'Mexique',
  ZAF: 'Afrique du Sud',
  ARG: 'Argentine',
  KOR: 'République de Corée',
  PRK: 'République populaire démocratique de Corée',
  EGY: 'Égypte',
  DZA: 'Algérie',
  MAR: 'Maroc',
  TUN: 'Tunisie',
  SEN: 'Sénégal',
  CIV: 'Côte d’Ivoire',
  BEL: 'Belgique',
  CHE: 'Suisse',
  NLD: 'Pays-Bas',
  PRT: 'Portugal',
  SWE: 'Suède',
  NOR: 'Norvège',
  FIN: 'Finlande',
  DNK: 'Danemark',
  POL: 'Pologne',
  UKR: 'Ukraine',
  BLR: 'Bélarus',
  IRL: 'Irlande',
  AUT: 'Autriche',
  GRC: 'Grèce',
  ISR: 'Israël',
  IRN: 'Iran',
  IRQ: 'Iraq',
  SAU: 'Arabie saoudite',
  TUR: 'Türkiye',
  IDN: 'Indonésie',
  PAK: 'Pakistan',
  BGD: 'Bangladesh',
  VNM: 'Viet Nam',
  THA: 'Thaïlande',
  KEN: 'Kenya',
  NGA: 'Nigéria',
  ETH: 'Éthiopie',
  COD: 'République démocratique du Congo',
  COG: 'Congo',
  CMR: 'Cameroun',
  GHA: 'Ghana',
  MLI: 'Mali',
  NER: 'Niger',
  LBN: 'Liban',
  JOR: 'Jordanie',
  SYR: 'République arabe syrienne',
  CHL: 'Chili',
  COL: 'Colombie',
  PER: 'Pérou',
  VEN: 'Venezuela',
  CUB: 'Cuba',
  NZL: 'Nouvelle-Zélande',
  CZE: 'Tchéquie',
  SVK: 'Slovaquie',
  HUN: 'Hongrie',
  ROU: 'Roumanie',
  BGR: 'Bulgarie',
  SUN: 'Union soviétique (historique)',
  DDR: 'RDA (historique)',
  GER: 'RFA (historique)',
  CSK: 'Tchécoslovaquie (historique)',
  YUG: 'Yougoslavie (historique)',
  SCG: 'Serbie-et-Monténégro (historique)',
  YMD: 'Yémen démocratique (historique)',
  SRB: 'Serbie',
  YEM: 'Yémen',
};
const HISTORICAL_CODES = new Set(['SUN', 'DDR', 'GER', 'CSK', 'YUG', 'SCG', 'YMD']);

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseSubjects(value) {
  if (typeof value !== 'string' || value === '') return [];
  // Le séparateur vérifié dans le CSV v6 est |. Les subdivisions -- et chaque libellé restent exacts.
  return value.split('|').filter((subject) => subject.trim() !== '');
}

export function normalizeResolution(row) {
  if (!/^\d+$/.test(row.undl_id) || !row.resolution || !row.title || !validDate(row.date)) {
    throw new Error('Identifiant, symbole, titre ou date de résolution invalide.');
  }
  const source = new URL(row.undl_link);
  if (source.protocol !== 'https:' || source.hostname !== 'digitallibrary.un.org') {
    throw new Error('Le lien de résolution ne désigne pas la bibliothèque officielle de l’ONU.');
  }
  return {
    id: row.undl_id,
    symbol: row.resolution,
    title: row.title,
    date: row.date,
    sourceUrl: row.undl_link,
    subjects: parseSubjects(row.subjects),
    votes: [],
  };
}

async function checksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function importData() {
  const dataDirectory = new URL('../data/', import.meta.url);
  await mkdir(dataDirectory, { recursive: true });
  const voteFile = SOURCE_FILES.find((file) => file.kind === 'votes');
  const outcomesFile = SOURCE_FILES.find((file) => file.kind === 'outcomes');
  const sourcePath = (file) => new URL(`${file.directory}/${file.name}`, dataDirectory);
  const rejections = [];
  const resolutions = new Map();
  let outcomeRows = 0;
  for await (const row of readCsv(sourcePath(outcomesFile), [
    'undl_id',
    'resolution',
    'date',
    'title',
    'modality',
    'subjects',
    'undl_link',
  ])) {
    outcomeRows++;
    try {
      if (resolutions.has(row.undl_id)) throw new Error('Identifiant de résolution en double.');
      resolutions.set(row.undl_id, normalizeResolution(row));
    } catch (error) {
      rejections.push({
        source: 'outcomes',
        row: outcomeRows,
        id: row.undl_id,
        reason: error.message,
      });
    }
  }
  console.log(`${outcomeRows} résolutions lues.`);
  const countries = [];
  const countryIndexes = new Map();
  const seenVotes = new Map();
  const rawVoteCounts = {};
  const unknownChoices = {};
  let voteRows = 0;
  let importedVotes = 0;
  let minDate = null;
  let maxDate = null;
  for await (const row of readCsv(sourcePath(voteFile), [
    'undl_id',
    'ms_code',
    'ms_name',
    'ms_vote',
    'date',
    'resolution',
    'undl_link',
  ])) {
    voteRows++;
    const resolution = resolutions.get(row.undl_id);
    let error;
    if (!resolution) error = 'Aucune résolution correspondante par undl_id.';
    else if (resolution.date !== row.date || resolution.symbol !== row.resolution)
      error = 'Désaccord date/symbole entre votes et résolutions pour la clé undl_id.';
    else if (!/^[A-Z]{3}$/.test(row.ms_code) || !row.ms_name)
      error = 'Code ou nom de pays invalide.';
    const seen = seenVotes.get(row.undl_id) ?? new Set();
    if (seen.has(row.ms_code)) error = 'Doublon undl_id + ms_code.';
    if (error) {
      rejections.push({
        source: 'votes',
        row: voteRows,
        id: row.undl_id,
        countryId: row.ms_code,
        reason: error,
      });
      continue;
    }
    seen.add(row.ms_code);
    seenVotes.set(row.undl_id, seen);
    let index = countryIndexes.get(row.ms_code);
    const year = Number(row.date.slice(0, 4));
    if (index === undefined) {
      index = countries.length;
      countryIndexes.set(row.ms_code, index);
      countries.push({
        id: row.ms_code,
        name: FRENCH_NAMES[row.ms_code] ?? row.ms_name,
        nameEn: row.ms_name,
        ...(FRENCH_NAMES[row.ms_code] && !HISTORICAL_CODES.has(row.ms_code)
          ? { iso3: row.ms_code }
          : {}),
        voteCount: 0,
        firstYear: year,
        lastYear: year,
        aliases: [],
        latestDate: row.date,
      });
    }
    const item = countries[index];
    if (!item.aliases.includes(row.ms_name)) item.aliases.push(row.ms_name);
    if (row.date >= item.latestDate) {
      item.latestDate = row.date;
      item.nameEn = row.ms_name;
      item.name = FRENCH_NAMES[row.ms_code] ?? row.ms_name;
    }
    item.firstYear = Math.min(item.firstYear, year);
    item.lastYear = Math.max(item.lastYear, year);
    const choice = normalizeVote(row.ms_vote);
    if (['YES', 'NO', 'ABSTAIN'].includes(choice)) item.voteCount++;
    rawVoteCounts[row.ms_vote] = (rawVoteCounts[row.ms_vote] ?? 0) + 1;
    if (choice === 'UNKNOWN') unknownChoices[row.ms_vote] = (unknownChoices[row.ms_vote] ?? 0) + 1;
    resolution.votes.push([index, row.ms_vote]);
    importedVotes++;
    minDate = minDate === null || row.date < minDate ? row.date : minDate;
    maxDate = maxDate === null || row.date > maxDate ? row.date : maxDate;
  }
  for (const item of countries) delete item.latestDate;
  if (!importedVotes || !minDate || !maxDate)
    throw new Error('Aucun vote valide importé. Aucune donnée de remplacement ne sera créée.');
  const themeCounts = Object.fromEntries(
    THEMES.map(({ id }) => [
      id,
      {
        resolutions: 0,
        recordedVoteResolutions: 0,
        voteRows: 0,
      },
    ]),
  );
  let resolutionsWithSubjects = 0;
  let subjectLabelCount = 0;
  for (const resolution of resolutions.values()) {
    if (resolution.subjects.length) resolutionsWithSubjects++;
    subjectLabelCount += resolution.subjects.length;
    for (const id of ['all', ...assignThemes(resolution.subjects)]) {
      themeCounts[id].resolutions++;
      if (resolution.votes.length) themeCounts[id].recordedVoteResolutions++;
      themeCounts[id].voteRows += resolution.votes.length;
    }
  }
  const files = [];
  for (const file of SOURCE_FILES) {
    const path = sourcePath(file);
    const details = await stat(path);
    files.push({ ...file, bytes: details.size, sha256: await checksum(path) });
  }
  let downloadedAt;
  try {
    downloadedAt = JSON.parse(
      await readFile(new URL('raw/download-manifest.json', dataDirectory), 'utf8'),
    ).downloadedAt;
  } catch {
    downloadedAt = (await stat(sourcePath(voteFile))).mtime.toISOString();
  }
  const metadata = {
    name: 'Votes de l’Assemblée générale des Nations unies',
    version: SOURCE_VERSION,
    publishedAt: PUBLISHED_AT,
    downloadedAt,
    sourceUrl: 'https://digitallibrary.un.org/record/4060887',
    coverage: { from: minDate, to: maxDate },
    countryCount: countries.length,
    resolutionCount: resolutions.size,
    voteCount: importedVotes,
    license: '© Nations unies — utilisation non commerciale avec attribution.',
    scope:
      'Résolutions adoptées, toutes modalités ; les comparaisons utilisent uniquement les votes enregistrés explicites. Codes et entités historiques distincts conservés selon la source. Dates effectives du CSV : 26/01/1946–17/09/2026 ; le titre du codebook annonce 11/12/1946–17/09/2026.',
    status: 'official',
  };
  const dataset = {
    schemaVersion: 1,
    metadata,
    countries,
    resolutions: Array.from(resolutions.values()),
  };
  const manifest = {
    schemaVersion: 1,
    source: 'United Nations Dag Hammarskjöld Library',
    version: SOURCE_VERSION,
    publishedAt: PUBLISHED_AT,
    downloadedAt,
    importedAt: new Date().toISOString(),
    files,
    joinKey: 'undl_id',
    countryKey: 'ms_code',
    countryLabel:
      'Dernier ms_name observé par code ; tous les libellés sont conservés dans aliases.',
    historicalCodes: Array.from(HISTORICAL_CODES),
    normalization: { Y: 'YES', N: 'NO', A: 'ABSTAIN', X: 'NOT_VOTED', other: 'UNKNOWN' },
    countryVoteCount: 'Nombre de choix explicites Y, N ou A ; X et valeurs inconnues exclus.',
    coverage: {
      declaredStart: '1946-12-11',
      observedStart: minDate,
      observedEnd: maxDate,
      note: 'Divergence entre titre du codebook et dates effectives conservée, sans correction inventée.',
    },
    counts: {
      outcomeRows,
      voteRows,
      importedVotes,
      countries: countries.length,
      resolutions: resolutions.size,
      recordedVoteResolutions: Array.from(resolutions.values()).filter(
        (item) => item.votes.length > 0,
      ).length,
      rejections: rejections.length,
      rawVoteCounts,
      unknownChoices,
      resolutionsWithSubjects,
      resolutionsWithoutSubjects: resolutions.size - resolutionsWithSubjects,
      subjectLabelCount,
    },
    themeClassification: {
      version: THEME_CLASSIFICATION_VERSION,
      officialTaxonomy: false,
      sourceField: 'outcomes.subjects',
      separator: '|',
      method:
        'Règles explicites du projet appliquées aux seuls sujets source, sans inférence depuis les titres ni les pays. Subdivisions -- conservées. Appartenance multiple autorisée. all est un filtre virtuel ; unclassified couvre les sujets absents ou non reconnus.',
      rules: THEME_RULES,
      counts: themeCounts,
    },
    license: metadata.license,
    termsUrls: [
      'https://digitallibrary.un.org/pages/?ln=en&page=tos',
      'https://www.un.org/en/about-us/terms-of-use',
    ],
    citation: `United Nations Dag Hammarskjöld Library, United Nations General Assembly Voting Data, version 6 (15 October 2026), downloaded ${downloadedAt.slice(0, 10)}, https://digitallibrary.un.org/record/4060887`,
  };
  await writeFile(new URL('dataset.json', dataDirectory), JSON.stringify(dataset) + '\n');
  await writeFile(
    new URL('source-manifest.json', dataDirectory),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  await writeFile(
    new URL('import-report.json', dataDirectory),
    JSON.stringify({ counts: manifest.counts, themeCounts, rejections }, null, 2) + '\n',
  );
  console.log(
    `${importedVotes} votes importés, ${countries.length} codes pays distincts, ${rejections.length} rejets. data/dataset.json prêt.`,
  );
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await importData();
