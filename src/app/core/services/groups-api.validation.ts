import { Country, Resolution, VoteChoice } from '../models/api.models';
import {
  CountryGroup,
  GroupAnalysis,
  GroupAnalysisFilters,
  GroupDivisiveResolution,
  GroupPair,
  GroupReport,
  GroupReportSummary,
  GroupSuggestion,
  GroupSuggestions,
  GroupTrendPoint,
} from '../models/groups.models';

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('La réponse des groupes est invalide.');
  return value as JsonObject;
}
function text(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('Un texte attendu est absent de la réponse des groupes.');
  return value;
}
function numeric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Un nombre reçu pour le groupe est invalide.');
  return value;
}
function count(value: unknown): number {
  const result = numeric(value);
  if (!Number.isInteger(result) || result < 0)
    throw new Error('Un effectif du groupe est invalide.');
  return result;
}
function percentage(value: unknown): number | null {
  if (value === null) return null;
  const result = numeric(value);
  if (result < 0 || result > 100) throw new Error('Un pourcentage du groupe est invalide.');
  return result;
}
export function groupList<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('La liste de groupes reçue est invalide.');
  return value.map(parse);
}
function ids(value: unknown): string[] {
  const result = groupList(value, text);
  if (new Set(result).size !== result.length)
    throw new Error('Un pays apparaît plusieurs fois dans le groupe.');
  return result;
}
function coverage(value: unknown): { from: string | null; to: string | null } {
  const item = object(value);
  return {
    from: item['from'] === null ? null : text(item['from']),
    to: item['to'] === null ? null : text(item['to']),
  };
}
function country(value: unknown): Country {
  const item = object(value);
  return {
    id: text(item['id']),
    name: text(item['name']),
    nameEn: text(item['nameEn']),
    voteCount: count(item['voteCount']),
    firstYear: count(item['firstYear']),
    lastYear: count(item['lastYear']),
    ...(item['iso3'] === undefined ? {} : { iso3: text(item['iso3']) }),
  };
}
function resolution(value: unknown): Resolution {
  const item = object(value);
  const sourceUrl = text(item['sourceUrl']);
  if (!sourceUrl.startsWith('https://'))
    throw new Error('Le lien de résolution reçu est invalide.');
  return {
    id: text(item['id']),
    symbol: text(item['symbol']),
    title: text(item['title']),
    date: text(item['date']),
    sourceUrl,
    ...(item['subjects'] === undefined ? {} : { subjects: groupList(item['subjects'], text) }),
    ...(item['themeIds'] === undefined ? {} : { themeIds: groupList(item['themeIds'], text) }),
  };
}
export function groupFilters(value: unknown): GroupAnalysisFilters {
  const item = object(value);
  const result = {
    from: count(item['from']),
    to: count(item['to']),
    theme: text(item['theme']),
    minVotes: count(item['minVotes']),
  };
  if (result.from > result.to || result.minVotes < 1)
    throw new Error('Les filtres de l’analyse reçue sont invalides.');
  return result;
}
export function countryGroup(value: unknown): CountryGroup {
  const item = object(value);
  const result = {
    id: text(item['id']),
    name: text(item['name']),
    description: text(item['description']),
    memberIds: ids(item['memberIds']),
    revision: count(item['revision']),
    createdAt: text(item['createdAt']),
    updatedAt: text(item['updatedAt']),
  };
  if (result.memberIds.length < 2 || result.memberIds.length > 12 || result.revision < 1)
    throw new Error('La composition ou la révision du groupe reçu est invalide.');
  return result;
}
function groupPair(value: unknown): GroupPair {
  const item = object(value);
  if (typeof item['eligible'] !== 'boolean')
    throw new Error('L’éligibilité de la paire reçue est invalide.');
  const result = {
    countryA: country(item['countryA']),
    countryB: country(item['countryB']),
    commonVoteCount: count(item['commonVoteCount']),
    matchingVoteCount: count(item['matchingVoteCount']),
    differingVoteCount: count(item['differingVoteCount']),
    agreementPercent: percentage(item['agreementPercent']),
    eligible: item['eligible'],
    coverage: coverage(item['coverage']),
  };
  if (result.matchingVoteCount + result.differingVoteCount !== result.commonVoteCount)
    throw new Error('Les effectifs de la paire sont incohérents.');
  return result;
}
function trendPoint(value: unknown): GroupTrendPoint {
  const item = object(value);
  return {
    year: count(item['year']),
    totalPairCount: count(item['totalPairCount']),
    eligiblePairCount: count(item['eligiblePairCount']),
    commonPairVotes: count(item['commonPairVotes']),
    matchingPairVotes: count(item['matchingPairVotes']),
    cohesionPercent: percentage(item['cohesionPercent']),
  };
}
function divisiveResolution(value: unknown): GroupDivisiveResolution {
  const item = object(value);
  const agreementPercent = percentage(item['agreementPercent']);
  if (agreementPercent === null) throw new Error('La concordance de la résolution est absente.');
  return {
    resolution: resolution(item['resolution']),
    participatingCount: count(item['participatingCount']),
    memberCount: count(item['memberCount']),
    matchingPairVotes: count(item['matchingPairVotes']),
    comparablePairVotes: count(item['comparablePairVotes']),
    agreementPercent,
    votes: groupList(item['votes'], (value) => {
      const vote = object(value);
      const choice = text(vote['choice']);
      if (!['YES', 'NO', 'ABSTAIN', 'NOT_VOTED', 'UNKNOWN'].includes(choice))
        throw new Error('Le type de vote reçu est inconnu.');
      return { countryId: text(vote['countryId']), choice: choice as VoteChoice };
    }),
  };
}
export function groupAnalysis(value: unknown): GroupAnalysis {
  const item = object(value);
  const result = {
    groupId: text(item['groupId']),
    groupRevision: count(item['groupRevision']),
    memberIds: ids(item['memberIds']),
    members: groupList(item['members'], country),
    filters: groupFilters(item['filters']),
    totalPairCount: count(item['totalPairCount']),
    eligiblePairCount: count(item['eligiblePairCount']),
    commonPairVotes: count(item['commonPairVotes']),
    matchingPairVotes: count(item['matchingPairVotes']),
    cohesionPercent: percentage(item['cohesionPercent']),
    observedResolutionCount: count(item['observedResolutionCount']),
    coverage: coverage(item['coverage']),
    pairs: groupList(item['pairs'], groupPair),
    trend: groupList(item['trend'], trendPoint),
    divisiveResolutions: groupList(item['divisiveResolutions'], divisiveResolution),
    dataVersion: text(item['dataVersion']),
    themeClassificationVersion: text(item['themeClassificationVersion']),
    methodVersion: text(item['methodVersion']),
  };
  if (
    result.members.length !== result.memberIds.length ||
    result.eligiblePairCount > result.totalPairCount ||
    result.matchingPairVotes > result.commonPairVotes ||
    result.pairs.length !== result.totalPairCount
  )
    throw new Error('Les effectifs de l’analyse reçue sont incohérents.');
  return result;
}
export function groupReportSummary(value: unknown): GroupReportSummary {
  const item = object(value);
  return {
    id: text(item['id']),
    groupId: text(item['groupId']),
    createdAt: text(item['createdAt']),
    groupName: text(item['groupName']),
    groupRevision: count(item['groupRevision']),
    memberCount: count(item['memberCount']),
    filters: groupFilters(item['filters']),
    cohesionPercent: percentage(item['cohesionPercent']),
    eligiblePairCount: count(item['eligiblePairCount']),
    totalPairCount: count(item['totalPairCount']),
    commonPairVotes: count(item['commonPairVotes']),
    dataVersion: text(item['dataVersion']),
    themeClassificationVersion: text(item['themeClassificationVersion']),
    methodVersion: text(item['methodVersion']),
  };
}
export function groupReport(value: unknown): GroupReport {
  const item = object(value);
  return {
    id: text(item['id']),
    groupId: text(item['groupId']),
    createdAt: text(item['createdAt']),
    groupSnapshot: countryGroup(item['groupSnapshot']),
    analysis: groupAnalysis(item['analysis']),
  };
}
function groupSuggestion(value: unknown): GroupSuggestion {
  const item = object(value);
  const concordancePercent = percentage(item['concordancePercent']);
  if (concordancePercent === null) throw new Error('La concordance de la suggestion est absente.');
  return {
    country: country(item['country']),
    commonPairVotes: count(item['commonPairVotes']),
    matchingPairVotes: count(item['matchingPairVotes']),
    concordancePercent,
    cohesionAfterPercent: percentage(item['cohesionAfterPercent']),
    deltaPoints: item['deltaPoints'] === null ? null : numeric(item['deltaPoints']),
    eligiblePairCount: count(item['eligiblePairCount']),
    coverage: coverage(item['coverage']),
  };
}
export function groupSuggestions(value: unknown): GroupSuggestions {
  const item = object(value);
  if (typeof item['includeHistorical'] !== 'boolean')
    throw new Error('Le périmètre historique des suggestions est invalide.');
  return {
    groupId: text(item['groupId']),
    groupRevision: count(item['groupRevision']),
    filters: groupFilters(item['filters']),
    suggestions: groupList(item['suggestions'], groupSuggestion),
    eligibleCandidateCount: count(item['eligibleCandidateCount']),
    excludedCandidateCount: count(item['excludedCandidateCount']),
    dataVersion: text(item['dataVersion']),
    methodVersion: text(item['methodVersion']),
    includeHistorical: item['includeHistorical'],
  };
}
