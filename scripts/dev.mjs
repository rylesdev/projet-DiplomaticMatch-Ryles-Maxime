import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Même port que server/index.mjs et proxy.conf.mjs, qui lisent aussi API_PORT.
const apiPort = Number(process.env['API_PORT'] ?? 3001);
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

function launch(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 0));
}

// Refuser un port occupé avant de démarrer, pour éviter une API de provenance inconnue.
const probe = createServer();
probe.on('error', () => {
  console.error(
    `Le port API ${apiPort} est déjà utilisé. Arrêtez l’autre instance avant npm start.`,
  );
  process.exitCode = 1;
});
probe.listen(apiPort, '127.0.0.1', () => {
  probe.close(() => {
    launch(['server/index.mjs']);
    launch(['node_modules/@angular/cli/bin/ng.js', 'serve', ...process.argv.slice(2)]);
  });
});

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
