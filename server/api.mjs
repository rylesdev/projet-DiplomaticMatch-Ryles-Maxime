import { createServer } from 'node:http';
import {
  compareCountries,
  compareMatrix,
  compareTrend,
  countryProfile,
  normalizeSearch,
  publicResolution,
  rankCountries,
  resolutionDetail,
} from './domain.mjs';
import { THEMES } from './themes.mjs';
import { GroupError } from './group-domain.mjs';
import { createGroupRepository } from './group-repository.mjs';
import { handleGroupsRequest, isGroupsPath } from './groups-api.mjs';

const THEME_IDS = new Set(THEMES.map((theme) => theme.id));

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function integer(params, key, fallback, min, max) {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new ApiError(400, `Le paramètre ${key} doit être un entier.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ApiError(400, `Le paramètre ${key} doit être compris entre ${min} et ${max}.`);
  }
  return value;
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
  if (from > to) throw new ApiError(400, 'L’année de début doit précéder l’année de fin.');
  return { from, to };
}

function search(params) {
  const value = params.get('search') ?? '';
  if (value.length > 200) throw new ApiError(400, 'La recherche est limitée à 200 caractères.');
  return normalizeSearch(value.trim());
}

function themeParameter(params) {
  const theme = params.get('theme') ?? 'all';
  if (!THEME_IDS.has(theme)) throw new ApiError(400, 'Ce thème n’existe pas.');
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
  if (!result) throw new ApiError(404, 'Cet État est absent du jeu de données.');
  return result;
}

function comparisonParameters(store, params) {
  const countryA = params.get('countryA');
  const countryB = params.get('countryB');
  if (!countryA || !countryB) throw new ApiError(400, 'Choisissez les deux États à comparer.');
  country(store, countryA);
  country(store, countryB);
  if (countryA === countryB) throw new ApiError(400, 'Choisissez deux États différents.');
  return { countryA, countryB, ...period(params, store) };
}

export function handleApi(store, request) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = url.pathname;
  const params = url.searchParams;
  if (request.method !== 'GET')
    throw new ApiError(405, 'Cette API accepte uniquement les requêtes GET.');
  if (path === '/api/health') return { status: 'ok', version: store.metadata.version };
  if (path === '/api/metadata') return store.metadata;
  if (path === '/api/themes') return store.themes;
  if (path === '/api/matrix') {
    const { from, to } = period(params, store);
    const minVotes = integer(params, 'minVotes', 20, 1, 100000);
    return compareMatrix(store, from, to, minVotes, themeParameter(params));
  }
  if (path === '/api/countries') {
    const query = search(params);
    return Array.from(store.countries.values())
      .filter((item) =>
        normalizeSearch(
          [item.id, item.name, item.nameEn, ...(item.aliases ?? [])].join(' '),
        ).includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  const countryMatch = path.match(/^\/api\/countries\/([^/]+)(\/votes|\/rankings|\/profile)?$/);
  if (countryMatch) {
    const id = decodeURIComponent(countryMatch[1]);
    const found = country(store, id);
    if (!countryMatch[2]) return found;
    const { from, to } = period(params, store);
    if (countryMatch[2] === '/rankings') {
      const minVotes = integer(params, 'minVotes', 20, 1, 100000);
      return rankCountries(store, id, from, to, minVotes, themeParameter(params));
    }
    if (countryMatch[2] === '/profile') {
      return countryProfile(store, id, from, to, themeParameter(params));
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
    const rawSearch = params.get('search') ?? '';
    if (rawSearch.length > 200)
      throw new ApiError(400, 'La recherche est limitée à 200 caractères.');
    const query = rawSearch.trim();
    if (path === '/api/compare')
      return compareCountries(store, countryA, countryB, from, to, theme, query);
    const interval = params.get('interval') ?? 'year';
    if (!['year', 'decade'].includes(interval))
      throw new ApiError(400, 'L’intervalle doit être year ou decade.');
    return compareTrend(store, countryA, countryB, from, to, interval, theme, query);
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
    if (!found) throw new ApiError(404, 'Cette résolution est absente du jeu de données.');
    return resolutionDetail(store, found);
  }
  throw new ApiError(404, 'Cette route API n’existe pas.');
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
        error instanceof ApiError || error instanceof GroupError
          ? error.status
          : error instanceof URIError
            ? 400
            : 500;
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
