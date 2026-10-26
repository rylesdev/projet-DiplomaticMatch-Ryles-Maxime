import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { SOURCE_FILES, SOURCE_VERSION } from './source-config.mjs';

const downloadedAt = new Date().toISOString();
for (const file of SOURCE_FILES) {
  const directory = new URL(`../data/${file.directory}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  const destination = new URL(file.name, directory);
  const temporary = new URL(`${file.name}.part`, directory);
  console.log(`Téléchargement officiel : ${file.name}`);
  const response = await fetch(file.url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body)
    throw new Error(`Téléchargement impossible : HTTP ${response.status} pour ${file.url}`);
  if ((response.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(
      `Le serveur a renvoyé une page HTML au lieu de ${file.name}. Le lien source doit être vérifié.`,
    );
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, destination);
}
await writeFile(
  new URL('../data/raw/download-manifest.json', import.meta.url),
  JSON.stringify({ version: SOURCE_VERSION, downloadedAt, files: SOURCE_FILES }, null, 2) + '\n',
);
console.log('Téléchargement terminé. Exécuter ensuite npm run data:import.');
