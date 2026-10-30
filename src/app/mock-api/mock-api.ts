import { createServer, Server } from 'miragejs';
import { registerGroupRoutes } from './groups.routes';
import { registerReportRoutes } from './reports.routes';

// Deuxième API, mockée avec MirageJS : toutes les écritures (POST, PUT, DELETE) passent par
// /mock-api et sont sauvegardées dans le localStorage. Les lectures et calculs restent
// sur l'API Node (/api). Mirage écrit chaque requête dans la console du navigateur :
// elles n'apparaissent pas dans l'onglet Réseau.
export function startMockApi(environment: 'development' | 'test' = 'development'): Server {
  return createServer({
    environment,
    routes() {
      this.logging = environment === 'development';
      this.timing = 0;
      this.namespace = 'mock-api';
      registerGroupRoutes(this);
      registerReportRoutes(this);
      // Tout le reste part vers le serveur Angular : l'API Node (via le proxy) et le fond de carte.
      this.namespace = '';
      this.passthrough('/api/**');
      this.passthrough('/maps/**');
    },
  });
}
