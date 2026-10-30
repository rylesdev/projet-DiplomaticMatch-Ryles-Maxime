import { Country } from './api.models';

export interface TradeMetadata {
  sourceName: string;
  sourceUrl: string;
  version: string;
  retrievedAt: string;
  unit: 'USD';
  priceBasis: 'current';
  valuation: 'FOB';
  measure: 'goods_exports';
  coverage: { from: number; to: number };
  countryCount: number;
  observationCount: number;
  derivationTypes?: Record<string, string>;
}

export interface TradeFilters {
  countryA: string;
  countryB: string;
  from: number;
  to: number;
  theme: string;
  minVotes: number;
}

export interface TradePoint {
  year: number;
  exportsAtoB: number | null;
  exportsBtoA: number | null;
  totalTrade: number | null;
  balanceA: number | null;
  agreementPercent: number | null;
  commonVoteCount: number;
  derivationAtoB?: string | null;
  derivationBtoA?: string | null;
  statusAtoB?: string | null;
  statusBtoA?: string | null;
}

export interface TradeComparison extends Omit<TradeFilters, 'countryA' | 'countryB'> {
  voteDataVersion?: string;
  metadata: TradeMetadata;
  countryA: Country;
  countryB: Country;
  points: TradePoint[];
  summary: {
    latestCompleteYear: number | null;
    latest: TradePoint | null;
    comparableYearCount: number;
  };
}

export interface TradePartner {
  country: Country;
  exportsToPartner: number | null;
  exportsFromPartner: number | null;
  totalTrade: number | null;
  agreementPercent: number | null;
  commonVoteCount: number;
  derivationToPartner?: string | null;
  derivationFromPartner?: string | null;
  statusToPartner?: string | null;
  statusFromPartner?: string | null;
}

export interface TradePartners {
  voteDataVersion?: string;
  metadata: TradeMetadata;
  country: Country;
  year: number;
  theme: string;
  minVotes: number;
  partners: TradePartner[];
}
