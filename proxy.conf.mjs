// Le serveur Angular transmet les appels /api à l'API Node locale.
// Même port que server/index.mjs et scripts/dev.mjs : API_PORT, ou 3001 par défaut.
const port = process.env['API_PORT'] ?? '3001';

export default {
  '/api/**': {
    target: `http://127.0.0.1:${port}`,
    secure: false,
    changeOrigin: true,
  },
};
