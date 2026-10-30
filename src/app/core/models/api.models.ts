export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN' | 'NOT_VOTED' | 'UNKNOWN';
export type ExplicitVoteChoice = 'YES' | 'NO' | 'ABSTAIN';

export interface Country {
  id: string;
  name: string;
  nameEn: string;
  iso3?: string;
  voteCount: number;
  firstYear: number;
  lastYear: number;
}

// Référence courte vers un pays, utilisée dans les listes longues (votes, paires de groupe).
export type CountryRef = Pick<Country, 'id' | 'name'>;

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
  theme?: string;
}

export interface TrendPoint {
  year: number;
  commonVoteCount: number;
  matchingVoteCount: number;
  agreementPercent: number | null;
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
  dataVersion: string;
  theme?: string;
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

// Concordance d'un pays de référence avec chacun des autres : une ligne de la matrice (carte).
export interface ConcordanceEntry {
  id: string;
  name: string;
  iso3?: string;
  commonVoteCount: number;
  matchingVoteCount: number;
  // null : aucun vote commun ou seuil non atteint.
  agreementPercent: number | null;
}

export interface ConcordanceRow {
  country: Country;
  from: number;
  to: number;
  theme: string;
  minVotes: number;
  entries: ConcordanceEntry[];
  dataVersion: string;
}

export interface ResolutionDetail extends Resolution {
  votes: { country: CountryRef; choice: VoteChoice; rawChoice: string }[];
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
  status: 'official';
}
