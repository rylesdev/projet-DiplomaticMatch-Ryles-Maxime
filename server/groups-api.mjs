import {
  analyzeGroup,
  GroupError,
  suggestGroupMembers,
  validateAnalysisRequest,
  validateGroupDraft,
  validateRevision,
} from './group-domain.mjs';

const BODY_LIMIT = 32 * 1024;

function checkLocalOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new GroupError(403, 'Cette origine n’est pas autorisée pour les écritures locales.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
  ) {
    throw new GroupError(403, 'Cette origine n’est pas autorisée pour les écritures locales.');
  }
}

async function readJson(request) {
  if (
    (request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new GroupError(415, 'Utilisez le type de contenu application/json.');
  if (Number(request.headers['content-length']) > BODY_LIMIT) {
    request.resume();
    throw new GroupError(413, 'Le corps JSON est limité à 32 Ko.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= BODY_LIMIT) chunks.push(chunk);
  }
  if (size > BODY_LIMIT) throw new GroupError(413, 'Le corps JSON est limité à 32 Ko.');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new GroupError(400, 'Le corps JSON est invalide.');
  }
}

function revisionQuery(params) {
  const raw = params.get('expectedRevision');
  if (raw === null || !/^\d+$/.test(raw))
    throw new GroupError(400, 'La révision attendue est obligatoire pour supprimer le groupe.');
  return validateRevision(Number(raw));
}

export function isGroupsPath(path) {
  return path === '/api/groups' || path.startsWith('/api/groups/');
}

export async function handleGroupsRequest(store, repository, request) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = url.pathname;
  const method = request.method;
  if (method !== 'GET') checkLocalOrigin(request);
  if (path === '/api/groups') {
    if (method === 'GET') return { status: 200, body: repository.list() };
    if (method === 'POST')
      return {
        status: 201,
        body: repository.create(validateGroupDraft(store, await readJson(request))),
      };
    throw new GroupError(405, 'Cette route accepte GET ou POST.');
  }
  const match = path.match(
    /^\/api\/groups\/([^/]+)(?:\/(preview|reports|suggestions))?(?:\/([^/]+))?$/,
  );
  if (!match || (match[3] && match[2] !== 'reports'))
    throw new GroupError(404, 'Cette route de groupe n’existe pas.');
  const id = decodeURIComponent(match[1]);
  const action = match[2];
  const group = repository.get(id);
  if (!group) throw new GroupError(404, 'Ce groupe n’existe pas.');
  if (!action) {
    if (method === 'GET') return { status: 200, body: group };
    if (method === 'PATCH') {
      const input = await readJson(request);
      const current = repository.requireCurrent(id, validateRevision(input?.expectedRevision));
      const draft = validateGroupDraft(store, input, current);
      return { status: 200, body: repository.update(id, draft, input.expectedRevision) };
    }
    if (method === 'DELETE') {
      repository.delete(id, revisionQuery(url.searchParams));
      return { status: 204 };
    }
    throw new GroupError(405, 'Cette route accepte GET, PATCH ou DELETE.');
  }
  if (action === 'reports' && method === 'GET') {
    if (!match[3]) return { status: 200, body: repository.listReports(id) };
    const report = repository.getReport(id, decodeURIComponent(match[3]));
    if (!report) throw new GroupError(404, 'Ce rapport n’existe pas pour ce groupe.');
    return { status: 200, body: report };
  }
  if (method !== 'POST' || match[3]) throw new GroupError(405, 'Cette route accepte POST.');
  const input = validateAnalysisRequest(
    store,
    await readJson(request),
    action === 'preview',
    action === 'suggestions',
  );
  // La lecture du corps est asynchrone : vérifier la révision après cette lecture.
  const current = repository.requireCurrent(id, input.expectedRevision);
  if (action === 'suggestions')
    return {
      status: 200,
      body: suggestGroupMembers(store, current, input.filters, input.includeHistorical),
    };
  const analysis = analyzeGroup(
    store,
    current,
    input.filters,
    input.memberIds ?? current.memberIds,
  );
  if (action === 'preview') return { status: 200, body: analysis };
  return { status: 201, body: repository.saveReport(id, input.expectedRevision, analysis) };
}
