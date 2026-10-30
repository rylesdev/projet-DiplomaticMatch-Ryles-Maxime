import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiServer } from './api.mjs';
import { createStore } from './domain.mjs';
import { createGroupRepository } from './group-repository.mjs';
import { createTradeStore } from './trade-domain.mjs';

const datasetPath = new URL('../data/dataset.json', import.meta.url);
let dataset;
try {
  dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
} catch (error) {
  console.error(
    `Impossible de charger ${fileURLToPath(datasetPath)}. Exécutez npm run data:download puis npm run data:import si les données ne sont pas présentes.`,
  );
  throw error;
}
let tradeStore;
try {
  tradeStore = createTradeStore(
    JSON.parse(await readFile(new URL('../data/trade-dataset.json', import.meta.url), 'utf8')),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.warn('Données de commerce absentes : les autres fonctionnalités restent disponibles.');
}
const port = Number(process.env['API_PORT'] ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT invalide.');
const databasePath = process.env['GROUPS_DB_PATH']
  ? resolve(process.env['GROUPS_DB_PATH'])
  : fileURLToPath(new URL('../data/local/groups.sqlite', import.meta.url));
await mkdir(dirname(databasePath), { recursive: true });
const groupRepository = createGroupRepository(databasePath);
const server = createApiServer(createStore(dataset), { groupRepository, tradeStore });
server.listen(port, '127.0.0.1', () =>
  console.log(
    `API Diplomatic Match : http://127.0.0.1:${port}/api/health — ${dataset.metadata.version}`,
  ),
);
server.on('error', (error) => {
  groupRepository.close();
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
