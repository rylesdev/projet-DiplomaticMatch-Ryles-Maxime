export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN' | 'NOT_VOTED' | 'UNKNOWN';
export type ExplicitVoteChoice = 'YES' | 'NO' | 'ABSTAIN';
export type VoteBreakdownMatrix = Record<ExplicitVoteChoice, Record<ExplicitVoteChoice, number>>;

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
  subjects?: string[];
  themeIds?: string[];
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

export interface ArchiveSearchHint {
  archiveCommonVoteCount: number;
  fromYear: number | null;
  toYear: number | null;
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
  breakdown?: VoteBreakdownMatrix;
  coverage: { from: string | null; to: string | null };
  dataVersion: string;
  agreements?: ComparedResolution[];
  divergences: ComparedResolution[];
  theme?: string;
  search?: string;
  archiveSearchHint?: ArchiveSearchHint;
}

export interface TrendPoint {
  year: number;
  commonVoteCount: number;
  matchingVoteCount: number;
  agreementPercent: number | null;
}

export interface TrendTransition {
  fromYear: number;
  toYear: number;
  fromPercent: number;
  toPercent: number;
  deltaPoints: number;
  fromCommonVoteCount: number;
  toCommonVoteCount: number;
}

export interface TrendInflections {
  minVotesUsed: number;
  limitedSample: boolean;
  eligiblePeriodCount: number;
  highest: TrendPoint | null;
  lowest: TrendPoint | null;
  biggestRise: TrendTransition | null;
  biggestDrop: TrendTransition | null;
}

export interface CountryMinorityVote {
  resolution: Resolution;
  choice: ExplicitVoteChoice;
  majorityChoice: ExplicitVoteChoice;
  sameChoiceCount: number;
  assemblyExplicitTotal: number;
  assemblyTotals: Record<ExplicitVoteChoice, number>;
}

export interface CountryProfile {
  country: Country;
  from: number;
  to: number;
  theme: string;
  totals: Record<VoteChoice, number>;
  recordedResolutionCount: number;
  explicitVoteCount: number;
  comparableWithMajorityCount: number;
  alignedWithMajorityCount: number;
  dissentingVoteCount: number;
  tiedMajorityCount: number;
  majorityAlignmentPercent: number | null;
  strictMinorityVoteCount: number;
  coverage: { from: string | null; to: string | null };
  minorityVotes: CountryMinorityVote[];
  dataVersion: string;
}

export interface CountryRankingEntry {
  country: Country;
  commonVoteCount: number;
  matchingVoteCount: number;
  differingVoteCount: number;
  agreementPercent: number;
  coverage: { from: string; to: string };
}

export interface CountryRankings {
  country: Country;
  from: number;
  to: number;
  minVotes: number;
  eligibleCountryCount: number;
  excludedCountryCount: number;
  closest: CountryRankingEntry[];
  furthest: CountryRankingEntry[];
  dataVersion: string;
  theme?: string;
}

export interface TrendResult {
  countryA: Country;
  countryB: Country;
  from: number;
  to: number;
  interval: 'year' | 'decade';
  points: TrendPoint[];
  inflections?: TrendInflections;
  dataVersion: string;
  theme?: string;
  search?: string;
}

export interface Theme {
  id: string;
  label: string;
  description: string;
  resolutionCount: number;
  recordedVoteResolutionCount: number;
}

export interface ConcordanceMatrix {
  countries: Country[];
  from: number;
  to: number;
  theme: string;
  minVotes: number;
  agreementPercents: (number | null)[][];
  commonVoteCounts: number[][];
  matchingVoteCounts: number[][];
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
