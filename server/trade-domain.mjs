import { compareCountries, compareTrend } from './domain.mjs';
import { THEMES } from './themes.mjs';

const themeIds = new Set(THEMES.map((theme) => theme.id));
const flowKey = (year, exporter, importer) => `${year}:${exporter}:${importer}`;

export class TradeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Each direction uses the source's exporter series, which may include estimates.
// The application never substitutes imports or computes its own mirror estimates.
export function createTradeStore(dataset) {
  const fail = () => {
    throw new Error('Le jeu de commerce est invalide. Relancer son import documenté.');
  };
  if (
    !dataset ||
    dataset.schemaVersion !== 1 ||
    !Array.isArray(dataset.countries) ||
    !Array.isArray(dataset.flows) ||
    !dataset.metadata
  )
    fail();
  const metadata = dataset.metadata;
  const { from, to } = metadata.coverage ?? {};
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1900 ||
    to > 2100 ||
    from > to ||
    metadata.unit !== 'USD' ||
    metadata.priceBasis !== 'current' ||
    metadata.valuation !== 'FOB' ||
    metadata.measure !== 'goods_exports' ||
    typeof metadata.sourceName !== 'string' ||
    typeof metadata.sourceUrl !== 'string' ||
    !metadata.sourceUrl.startsWith('https://') ||
    typeof metadata.version !== 'string' ||
    typeof metadata.retrievedAt !== 'string'
  )
    fail();
  const countries = new Set(dataset.countries);
  if (
    countries.size !== dataset.countries.length ||
    dataset.countries.some((code) => typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) ||
    metadata.countryCount !== countries.size ||
    metadata.observationCount !== dataset.flows.length
  )
    fail();
  const flows = new Map();
  const derivations = new Map();
  const statuses = new Map();
  for (const row of dataset.flows) {
    if (!Array.isArray(row) || row.length < 4 || row.length > 6) fail();
    const [year, exporter, importer, value, derivation = null, status = null] = row;
    if (
      !Number.isInteger(year) ||
      year < from ||
      year > to ||
      !countries.has(exporter) ||
      !countries.has(importer) ||
      exporter === importer ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > Number.MAX_SAFE_INTEGER / 2 ||
      (derivation !== null && typeof derivation !== 'string') ||
      (status !== null && typeof status !== 'string')
    )
      fail();
    const key = flowKey(year, exporter, importer);
    if (flows.has(key)) fail();
    flows.set(key, value);
    if (derivation !== null) derivations.set(key, derivation);
    if (status !== null) statuses.set(key, status);
  }
  return { metadata: structuredClone(metadata), countries, flows, derivations, statuses };
}

function country(store, id) {
  const found = store.countries.get(id);
  if (!found) throw new TradeError(404, 'Cet État est absent du jeu de données.');
  return found;
}

function parameters(from, to, theme, minVotes) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1900 || to > 2100 || from > to)
    throw new TradeError(400, 'La période doit contenir des années de 1900 à 2100 dans l’ordre.');
  if (!themeIds.has(theme)) throw new TradeError(400, 'Ce thème n’existe pas.');
  if (!Number.isSafeInteger(minVotes) || minVotes < 1 || minVotes > 100000)
    throw new TradeError(400, 'Le minimum de votes doit être compris entre 1 et 100000.');
}

function tradeCode(tradeStore, item) {
  // No inference from country name, successor state or present-day territory.
  if (item.iso3 && tradeStore.countries.has(item.iso3)) return item.iso3;
  return tradeStore.countries.has(item.id) ? item.id : null;
}

function flowsFor(tradeStore, year, a, b) {
  const exportsAtoB = a && b ? (tradeStore.flows.get(flowKey(year, a, b)) ?? null) : null;
  const exportsBtoA = a && b ? (tradeStore.flows.get(flowKey(year, b, a)) ?? null) : null;
  const complete = exportsAtoB !== null && exportsBtoA !== null;
  return {
    exportsAtoB,
    exportsBtoA,
    derivationAtoB: a && b ? (tradeStore.derivations.get(flowKey(year, a, b)) ?? null) : null,
    derivationBtoA: a && b ? (tradeStore.derivations.get(flowKey(year, b, a)) ?? null) : null,
    statusAtoB: a && b ? (tradeStore.statuses.get(flowKey(year, a, b)) ?? null) : null,
    statusBtoA: a && b ? (tradeStore.statuses.get(flowKey(year, b, a)) ?? null) : null,
    totalTrade: complete ? exportsAtoB + exportsBtoA : null,
    balanceA: complete ? exportsAtoB - exportsBtoA : null,
  };
}

export function compareTrade(
  voteStore,
  tradeStore,
  { countryA: countryAId, countryB: countryBId, from, to, theme = 'all', minVotes = 20 },
) {
  parameters(from, to, theme, minVotes);
  const countryA = country(voteStore, countryAId);
  const countryB = country(voteStore, countryBId);
  if (countryAId === countryBId) throw new TradeError(400, 'Choisissez deux États différents.');
  const a = tradeCode(tradeStore, countryA);
  const b = tradeCode(tradeStore, countryB);
  const trend = compareTrend(voteStore, countryAId, countryBId, from, to, 'year', theme);
  const points = trend.points.map((point) => ({
    year: point.year,
    ...flowsFor(tradeStore, point.year, a, b),
    agreementPercent: point.commonVoteCount >= minVotes ? point.agreementPercent : null,
    commonVoteCount: point.commonVoteCount,
  }));
  const latest = points.findLast((point) => point.totalTrade !== null) ?? null;
  return {
    metadata: tradeStore.metadata,
    voteDataVersion: voteStore.metadata.version,
    countryA,
    countryB,
    from,
    to,
    theme,
    minVotes,
    points,
    summary: {
      latestCompleteYear: latest?.year ?? null,
      latest,
      comparableYearCount: points.filter(
        (point) => point.totalTrade !== null && point.agreementPercent !== null,
      ).length,
    },
  };
}

export function tradePartners(
  voteStore,
  tradeStore,
  { country: countryId, year, theme = 'all', minVotes = 20 },
) {
  parameters(year, year, theme, minVotes);
  const reference = country(voteStore, countryId);
  const code = tradeCode(tradeStore, reference);
  const partners = [];
  if (code) {
    for (const item of voteStore.countries.values()) {
      if (item.id === countryId) continue;
      const partnerCode = tradeCode(tradeStore, item);
      if (!partnerCode || partnerCode === code) continue;
      const flows = flowsFor(tradeStore, year, code, partnerCode);
      if (flows.exportsAtoB === null && flows.exportsBtoA === null) continue;
      const votes = compareCountries(voteStore, countryId, item.id, year, year, theme);
      partners.push({
        country: item,
        exportsToPartner: flows.exportsAtoB,
        exportsFromPartner: flows.exportsBtoA,
        derivationToPartner: flows.derivationAtoB,
        derivationFromPartner: flows.derivationBtoA,
        statusToPartner: flows.statusAtoB,
        statusFromPartner: flows.statusBtoA,
        totalTrade: flows.totalTrade,
        agreementPercent: votes.commonVoteCount >= minVotes ? votes.agreementPercent : null,
        commonVoteCount: votes.commonVoteCount,
      });
    }
  }
  partners.sort(
    (a, b) =>
      (a.totalTrade === null ? 1 : 0) - (b.totalTrade === null ? 1 : 0) ||
      (b.totalTrade ?? 0) - (a.totalTrade ?? 0) ||
      a.country.name.localeCompare(b.country.name, 'fr') ||
      a.country.id.localeCompare(b.country.id),
  );
  return {
    metadata: tradeStore.metadata,
    voteDataVersion: voteStore.metadata.version,
    country: reference,
    year,
    theme,
    minVotes,
    partners,
  };
}
