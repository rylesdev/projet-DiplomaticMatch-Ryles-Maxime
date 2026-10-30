import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { Country } from '../models/api.models';
import {
  TradeComparison,
  TradeFilters,
  TradeMetadata,
  TradePartner,
  TradePartners,
  TradePoint,
} from '../models/trade.models';

function invalid(): never {
  throw new Error(
    'Les données commerciales reçues sont incohérentes. Réessayez après actualisation.',
  );
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) invalid();
  return value;
}
function numeric(value: unknown, min = -Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) invalid();
  return value;
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const result = numeric(value, min);
  if (!Number.isSafeInteger(result) || result > max) invalid();
  return result;
}
function year(value: unknown): number {
  return integer(value, 1900, 2100);
}
function amount(value: unknown): number | null {
  return value === null ? null : numeric(value, 0);
}
function percentage(value: unknown): number | null {
  if (value === null) return null;
  const result = numeric(value, 0);
  if (result > 100) invalid();
  return result;
}
function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.001, Math.abs(b) * 1e-10);
}
function country(value: unknown): Country {
  const item = object(value);
  return {
    id: text(item['id']),
    name: text(item['name']),
    nameEn: text(item['nameEn']),
    voteCount: integer(item['voteCount']),
    firstYear: year(item['firstYear']),
    lastYear: year(item['lastYear']),
    ...(item['iso3'] === undefined ? {} : { iso3: text(item['iso3']) }),
  };
}
function metadata(value: unknown): TradeMetadata {
  const item = object(value);
  const coverage = object(item['coverage']);
  const from = year(coverage['from']);
  const to = year(coverage['to']);
  const sourceUrl = text(item['sourceUrl']);
  const retrievedAt = text(item['retrievedAt']);
  if (
    from > to ||
    !/^https:\/\//.test(sourceUrl) ||
    !Number.isFinite(Date.parse(retrievedAt)) ||
    item['unit'] !== 'USD' ||
    item['priceBasis'] !== 'current' ||
    item['valuation'] !== 'FOB' ||
    item['measure'] !== 'goods_exports'
  )
    invalid();
  return {
    sourceName: text(item['sourceName']),
    sourceUrl,
    version: text(item['version']),
    retrievedAt,
    unit: 'USD',
    priceBasis: 'current',
    valuation: 'FOB',
    measure: 'goods_exports',
    coverage: { from, to },
    countryCount: integer(item['countryCount'], 1),
    observationCount: integer(item['observationCount']),
  };
}
function checkFlows(a: number | null, b: number | null, total: number | null): void {
  if (a === null || b === null) {
    if (total !== null) invalid();
  } else if (total === null || !sameAmount(total, a + b)) invalid();
}
function point(value: unknown, minVotes: number): TradePoint {
  const item = object(value);
  const result: TradePoint = {
    year: year(item['year']),
    exportsAtoB: amount(item['exportsAtoB']),
    exportsBtoA: amount(item['exportsBtoA']),
    totalTrade: amount(item['totalTrade']),
    balanceA: item['balanceA'] === null ? null : numeric(item['balanceA']),
    agreementPercent: percentage(item['agreementPercent']),
    commonVoteCount: integer(item['commonVoteCount']),
    derivationAtoB: item['derivationAtoB'] == null ? null : text(item['derivationAtoB']),
    derivationBtoA: item['derivationBtoA'] == null ? null : text(item['derivationBtoA']),
    statusAtoB: item['statusAtoB'] == null ? null : text(item['statusAtoB']),
    statusBtoA: item['statusBtoA'] == null ? null : text(item['statusBtoA']),
  };
  checkFlows(result.exportsAtoB, result.exportsBtoA, result.totalTrade);
  if (result.exportsAtoB === null || result.exportsBtoA === null) {
    if (result.balanceA !== null) invalid();
  } else if (
    result.balanceA === null ||
    !sameAmount(result.balanceA, result.exportsAtoB - result.exportsBtoA)
  )
    invalid();
  if (result.commonVoteCount < minVotes && result.agreementPercent !== null) invalid();
  return result;
}
function comparison(value: unknown): TradeComparison {
  const item = object(value);
  const from = year(item['from']);
  const to = year(item['to']);
  const minVotes = integer(item['minVotes'], 1, 100000);
  const countryA = country(item['countryA']);
  const countryB = country(item['countryB']);
  if (from > to || countryA.id === countryB.id || !Array.isArray(item['points'])) invalid();
  const points = item['points'].map((value) => point(value, minVotes));
  if (points.length !== to - from + 1 || points.some((p, index) => p.year !== from + index))
    invalid();
  const summary = object(item['summary']);
  const latest = summary['latest'] === null ? null : point(summary['latest'], minVotes);
  const latestCompleteYear =
    summary['latestCompleteYear'] === null ? null : year(summary['latestCompleteYear']);
  const complete = points.filter((p) => p.totalTrade !== null);
  const last = complete.at(-1) ?? null;
  const comparableYearCount = integer(summary['comparableYearCount']);
  if (
    latestCompleteYear !== (last?.year ?? null) ||
    latest?.year !== last?.year ||
    (latest && last && JSON.stringify(latest) !== JSON.stringify(last)) ||
    comparableYearCount !==
      points.filter((p) => p.totalTrade !== null && p.agreementPercent !== null).length
  )
    invalid();
  return {
    metadata: metadata(item['metadata']),
    ...(item['voteDataVersion'] === undefined
      ? {}
      : { voteDataVersion: text(item['voteDataVersion']) }),
    countryA,
    countryB,
    from,
    to,
    theme: text(item['theme']),
    minVotes,
    points,
    summary: { latestCompleteYear, latest, comparableYearCount },
  };
}
function partner(value: unknown, minVotes: number): TradePartner {
  const item = object(value);
  const result = {
    country: country(item['country']),
    exportsToPartner: amount(item['exportsToPartner']),
    exportsFromPartner: amount(item['exportsFromPartner']),
    totalTrade: amount(item['totalTrade']),
    agreementPercent: percentage(item['agreementPercent']),
    commonVoteCount: integer(item['commonVoteCount']),
    derivationToPartner:
      item['derivationToPartner'] == null ? null : text(item['derivationToPartner']),
    derivationFromPartner:
      item['derivationFromPartner'] == null ? null : text(item['derivationFromPartner']),
    statusToPartner: item['statusToPartner'] == null ? null : text(item['statusToPartner']),
    statusFromPartner: item['statusFromPartner'] == null ? null : text(item['statusFromPartner']),
  };
  checkFlows(result.exportsToPartner, result.exportsFromPartner, result.totalTrade);
  if (result.commonVoteCount < minVotes && result.agreementPercent !== null) invalid();
  return result;
}
function partners(value: unknown): TradePartners {
  const item = object(value);
  const minVotes = integer(item['minVotes'], 1, 100000);
  const reference = country(item['country']);
  if (!Array.isArray(item['partners'])) invalid();
  const rows = item['partners'].map((p) => partner(p, minVotes));
  if (
    new Set(rows.map((p) => p.country.id)).size !== rows.length ||
    rows.some((p) => p.country.id === reference.id)
  )
    invalid();
  return {
    metadata: metadata(item['metadata']),
    ...(item['voteDataVersion'] === undefined
      ? {}
      : { voteDataVersion: text(item['voteDataVersion']) }),
    country: reference,
    year: year(item['year']),
    theme: text(item['theme']),
    minVotes,
    partners: rows,
  };
}

@Injectable({ providedIn: 'root' })
export class TradeApiService {
  private readonly http = inject(HttpClient);
  metadata() {
    return this.http.get<unknown>('/api/trade/metadata').pipe(map(metadata));
  }
  compare(filters: TradeFilters) {
    return this.http
      .get<unknown>('/api/trade/compare', {
        params: new HttpParams({ fromObject: { ...filters } }),
      })
      .pipe(
        map((value) => {
          const result = comparison(value);
          if (
            result.countryA.id !== filters.countryA ||
            result.countryB.id !== filters.countryB ||
            result.from !== filters.from ||
            result.to !== filters.to ||
            result.theme !== filters.theme ||
            result.minVotes !== filters.minVotes
          )
            invalid();
          return result;
        }),
      );
  }
  partners(country: string, year: number, theme: string, minVotes: number) {
    return this.http
      .get<unknown>('/api/trade/partners', {
        params: new HttpParams({ fromObject: { country, year, theme, minVotes } }),
      })
      .pipe(
        map((value) => {
          const result = partners(value);
          if (
            result.country.id !== country ||
            result.year !== year ||
            result.theme !== theme ||
            result.minVotes !== minVotes
          )
            invalid();
          return result;
        }),
      );
  }
}
