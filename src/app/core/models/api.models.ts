export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN' | 'NOT_VOTED' | 'UNKNOWN';

export interface Country {
  id: string;
  name: string;
  nameEn: string;
  iso3?: string;
  voteCount: number;
  firstYear: number;
  lastYear: number;
}

export interface Resolution {
  id: string;
  symbol: string;
  title: string;
  date: string;
  sourceUrl: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CountryVote {
  resolution: Resolution;
  choice: VoteChoice;
  rawChoice: string;
}

export interface ComparedResolution {
  resolution: Resolution;
  choiceA: VoteChoice;
  choiceB: VoteChoice;
}

export interface ComparisonResult {
  countryA: Country;
  countryB: Country;
  from: number;
  to: number;
  commonVoteCount: number;
  matchingVoteCount: number;
  differingVoteCount: number;
  nonComparableCount: number;
  agreementPercent: number | null;
  coverage: { from: string | null; to: string | null };
  dataVersion: string;
  divergences: ComparedResolution[];
}

export interface TrendPoint {
  year: number;
  commonVoteCount: number;
  matchingVoteCount: number;
  agreementPercent: number | null;
}

export interface TrendResult {
  countryA: Country;
  countryB: Country;
  from: number;
  to: number;
  interval: 'year' | 'decade';
  points: TrendPoint[];
  dataVersion: string;
}

export interface ResolutionDetail extends Resolution {
  votes: { country: Country; choice: VoteChoice; rawChoice: string }[];
  totals: Record<VoteChoice, number>;
}

export interface DataMetadata {
  name: string;
  version: string;
  publishedAt: string;
  downloadedAt: string;
  sourceUrl: string;
  coverage: { from: string; to: string };
  countryCount: number;
  resolutionCount: number;
  voteCount: number;
  license: string;
  scope: string;
  status: 'official' | 'verified-sample';
}
