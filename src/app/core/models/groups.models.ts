import { Country, CountryRef, Resolution, VoteChoice } from './api.models';

export interface CountryGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupDraft {
  name: string;
  description: string;
  memberIds: string[];
}

export interface GroupAnalysisFilters {
  from: number;
  to: number;
  theme: string;
  minVotes: number;
}

export interface GroupAnalysisRequest extends GroupAnalysisFilters {
  expectedRevision: number;
}

export interface GroupPreviewRequest extends GroupAnalysisRequest {
  memberIds?: string[];
}

export interface GroupSuggestionsRequest extends GroupAnalysisRequest {
  includeHistorical?: boolean;
}

export interface GroupPair {
  countryA: CountryRef;
  countryB: CountryRef;
  commonVoteCount: number;
  matchingVoteCount: number;
  // null : seuil de votes communs non atteint pour cette paire.
  agreementPercent: number | null;
}

export interface GroupTrendPoint {
  year: number;
  eligiblePairCount: number;
  commonPairVotes: number;
  matchingPairVotes: number;
  cohesionPercent: number | null;
}

export interface GroupDivisiveResolution {
  resolution: Resolution;
  participatingCount: number;
  memberCount: number;
  matchingPairVotes: number;
  comparablePairVotes: number;
  agreementPercent: number;
  votes: { countryId: string; choice: VoteChoice }[];
}

export interface GroupAnalysis {
  groupId: string;
  groupRevision: number;
  memberIds: string[];
  members: Country[];
  filters: GroupAnalysisFilters;
  totalPairCount: number;
  eligiblePairCount: number;
  commonPairVotes: number;
  matchingPairVotes: number;
  cohesionPercent: number | null;
  observedResolutionCount: number;
  coverage: { from: string | null; to: string | null };
  pairs: GroupPair[];
  trend: GroupTrendPoint[];
  divisiveResolutions: GroupDivisiveResolution[];
  dataVersion: string;
  themeClassificationVersion: string;
  methodVersion: string;
}

export interface GroupSuggestion {
  country: Country;
  commonPairVotes: number;
  matchingPairVotes: number;
  concordancePercent: number;
  cohesionAfterPercent: number | null;
  deltaPoints: number | null;
  eligiblePairCount: number;
  coverage: { from: string | null; to: string | null };
}

export interface GroupSuggestions {
  groupId: string;
  groupRevision: number;
  filters: GroupAnalysisFilters;
  suggestions: GroupSuggestion[];
  eligibleCandidateCount: number;
  excludedCandidateCount: number;
  dataVersion: string;
  methodVersion: string;
  includeHistorical: boolean;
}

export interface GroupReportSummary {
  id: string;
  groupId: string;
  createdAt: string;
  groupName: string;
  groupRevision: number;
  memberCount: number;
  filters: GroupAnalysisFilters;
  cohesionPercent: number | null;
  eligiblePairCount: number;
  totalPairCount: number;
  commonPairVotes: number;
  dataVersion: string;
  themeClassificationVersion: string;
  methodVersion: string;
}

export interface GroupReport {
  id: string;
  groupId: string;
  createdAt: string;
  groupSnapshot: CountryGroup;
  analysis: GroupAnalysis;
}
