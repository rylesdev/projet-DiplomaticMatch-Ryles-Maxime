import { createServer } from 'node:http';
import {
  compareCountries,
  compareTrend,
  concordanceRow,
  countryProfile,
  normalizeSearch,
  publicResolution,
  rankCountries,
  resolutionDetail,
  selectMatrix,
} from './domain.mjs';
import { THEMES } from './themes.mjs';
import { analyzeGroup, validateMemberIds } from './group-domain.mjs';
import { suggestGroupMembers } from './group-suggestions.mjs';
import { HttpError, integerInRange } from './http-error.mjs';
import { createGroupRepository } from './group-repository.mjs';
import { handleGroupsRequest, isGroupsPath } from './groups-api.mjs';

const THEME_IDS = new Set(THEMES.map((theme) => theme.id));

function integer(params, key, fallback, min, max) {
  const raw = params.get(key);
  if (raw === null) return fallback;
  // « 12abc » ou « -3 » deviennent NaN et sont refusés par integerInRange.
  return integerInRange(/^\d+$/.test(raw) ? Number(raw) : NaN, `Le paramètre ${key}`, min, max);
}

function period(params, store) {
  const from = integer(
    params,
    'from',
    Number(store.metadata.coverage.from.slice(0, 4)),
    1900,
    2100,
  );
  const to = integer(params, 'to', Number(store.metadata.coverage.to.slice(0, 4)), 1900, 2100);
  if (from > to) throw new HttpError(400, 'L’année de début doit précéder l’année de fin.');
  return { from, to };
}

function search(params) {
  const value = params.get('search') ?? '';
  if (value.length > 200) throw new HttpError(400, 'La recherche est limitée à 200 caractères.');
  return normalizeSearch(value.trim());
}

function themeParameter(params) {
  const theme = params.get('theme') ?? 'all';
  if (!THEME_IDS.has(theme)) throw new HttpError(400, 'Ce thème n’existe pas.');
  return theme;
}

function paginate(items, params) {
  const page = integer(params, 'page', 1, 1, 100000);
  const pageSize = integer(params, 'pageSize', 20, 1, 100);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

function country(store, id) {
  const result = store.countries.get(id);
  if (!result) throw new HttpError(404, 'Cet État est absent du jeu de données.');
  return result;
}

function comparisonParameters(store, params) {
  const countryA = params.get('countryA');
  const countryB = params.get('countryB');
  if (!countryA || !countryB) throw new HttpError(400, 'Choisissez les deux États à comparer.');
  country(store, countryA);
  country(store, countryB);
  if (countryA === countryB) throw new HttpError(400, 'Choisissez deux États différents.');
  return { countryA, countryB, ...period(params, store) };
}

// members=FRA,IND,BRA : 2 à 12 codes distincts, puis période, thème et seuil des paires.
function groupParameters(store, params) {
  const memberIds = validateMemberIds(
    store,
    (params.get('members') ?? '').split(',').map((id) => id.trim()),
  );
  const filters = {
    ...period(params, store),
    theme: themeParameter(params),
    minVotes: integer(params, 'minVotes', 20, 1, 100000),
  };
  return { memberIds, filters };
}

// countries=FRA,IND,USA : 2 à 15 codes distincts présents dans le jeu de données.
function selectedCountries(store, params) {
  const ids = (params.get('countries') ?? '').split(',').map((id) => id.trim());
  if (ids.length < 2 || ids.length > 15 || ids.some((id) => id === ''))
    throw new HttpError(400, 'Choisissez entre 2 et 15 pays.');
  if (new Set(ids).size !== ids.length)
    throw new HttpError(400, 'Chaque pays ne doit apparaître qu’une seule fois.');
  if (ids.some((id) => !store.countries.has(id)))
    throw new HttpError(400, 'Un des pays choisis est absent du jeu de données.');
  return ids;
}

export function handleApi(store, request) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = url.pathname;
  const params = url.searchParams;
  if (request.method !== 'GET')
    throw new HttpError(405, 'Cette API accepte uniquement les requêtes GET.');
  if (path === '/api/health') return { status: 'ok', version: store.metadata.version };
  if (path === '/api/metadata') return store.metadata;
  if (path === '/api/themes') return store.themes;
  if (path === '/api/matrix/selection') {
    const ids = selectedCountries(store, params);
    const { from, to } = period(params, store);
    const minVotes = integer(params, 'minVotes', 20, 1, 100000);
    return selectMatrix(store, ids, from, to, minVotes, themeParameter(params));
  }
  if (path === '/api/groups/analysis') {
    const { memberIds, filters } = groupParameters(store, params);
    return analyzeGroup(store, memberIds, filters);
  }
  if (path === '/api/groups/suggestions') {
    const { memberIds, filters } = groupParameters(store, params);
    const historical = params.get('includeHistorical') ?? 'false';
    if (historical !== 'true' && historical !== 'false')
      throw new HttpError(400, 'Le paramètre includeHistorical doit valoir true ou false.');
    return suggestGroupMembers(store, memberIds, filters, historical === 'true');
  }
  if (path === '/api/countries') {
    const query = search(params);
    return (
      Array.from(store.countries.values())
        .filter((item) =>
          normalizeSearch(
            [item.id, item.name, item.nameEn, ...(item.aliases ?? [])].join(' '),
          ).includes(query),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        // Les anciens noms (aliases) servent à la recherche ci-dessus, pas à l'affichage.
        .map(({ aliases, ...country }) => country)
    );
  }
  const countryMatch = path.match(
    /^\/api\/countries\/([^/]+)(\/votes|\/rankings|\/profile|\/concordances)?$/,
  );
  if (countryMatch) {
    const id = decodeURIComponent(countryMatch[1]);
    const found = country(store, id);
    if (!countryMatch[2]) return found;
    const { from, to } = period(params, store);
    if (countryMatch[2] === '/rankings') {
      const minVotes = integer(params, 'minVotes', 20, 1, 100000);
      return rankCountries(store, id, from, to, minVotes, themeParameter(params));
    }
    if (countryMatch[2] === '/profile')
      return countryProfile(store, id, from, to, themeParameter(params));
    if (countryMatch[2] === '/concordances') {
      const minVotes = integer(params, 'minVotes', 20, 1, 100000);
      return concordanceRow(store, id, from, to, minVotes, themeParameter(params));
    }
    const votes = store.countryVotes
      .get(id)
      .filter((item) => {
        const year = Number(item.resolution.date.slice(0, 4));
        return year >= from && year <= to;
      })
      .map((item) => ({ ...item, resolution: publicResolution(item.resolution) }));
    return paginate(votes, params);
  }
  if (path === '/api/compare' || path === '/api/compare/trend') {
    const { countryA, countryB, from, to } = comparisonParameters(store, params);
    const theme = themeParameter(params);
    // Mot-clé facultatif : seules les résolutions qui le contiennent sont comparées.
    const keyword = (params.get('search') ?? '').trim();
    if (keyword.length > 200)
      throw new HttpError(400, 'La recherche est limitée à 200 caractères.');
    if (path === '/api/compare')
      return compareCountries(store, countryA, countryB, from, to, theme, keyword);
    const interval = params.get('interval') ?? 'year';
    if (!['year', 'decade'].includes(interval))
      throw new HttpError(400, 'L’intervalle doit être year ou decade.');
    return compareTrend(store, countryA, countryB, from, to, interval, theme, keyword);
  }
  if (path === '/api/resolutions') {
    const query = search(params);
    const { from, to } = period(params, store);
    const items = store.orderedResolutions
      .filter((item) => {
        const year = Number(item.date.slice(0, 4));
        return (
          year >= from &&
          year <= to &&
          normalizeSearch(`${item.symbol} ${item.title}`).includes(query)
        );
      })
      .map(publicResolution);
    return paginate(items, params);
  }
  const resolutionMatch = path.match(/^\/api\/resolutions\/([^/]+)$/);
  if (resolutionMatch) {
    const found = store.resolutions.get(decodeURIComponent(resolutionMatch[1]));
    if (!found) throw new HttpError(404, 'Cette résolution est absente du jeu de données.');
    return resolutionDetail(store, found);
  }
  throw new HttpError(404, 'Cette route API n’existe pas.');
}

export function createApiServer(store, options = {}) {
  const groupRepository = options.groupRepository ?? createGroupRepository();
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (isGroupsPath(new URL(request.url, 'http://127.0.0.1').pathname)) {
        const result = await handleGroupsRequest(store, groupRepository, request);
        response.writeHead(result.status);
        response.end(result.status === 204 ? undefined : JSON.stringify(result.body));
        return;
      }
      const body = handleApi(store, request);
      response.writeHead(200);
      response.end(JSON.stringify(body));
    } catch (error) {
      const status =
        error instanceof HttpError ? error.status : error instanceof URIError ? 400 : 500;
      if (status === 500) console.error(error);
      response.writeHead(status);
      response.end(
        JSON.stringify({
          error: status === 500 ? 'Une erreur interne empêche de lire les données.' : error.message,
        }),
      );
    }
  });
  server.once('close', () => groupRepository.close());
  return server;
}
