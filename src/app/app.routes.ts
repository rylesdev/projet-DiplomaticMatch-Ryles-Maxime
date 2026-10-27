import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Diplomatic Match — Explorer les votes à l’ONU',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'pays',
    title: 'Les pays — Diplomatic Match',
    loadComponent: () => import('./features/countries/countries.page').then((m) => m.CountriesPage),
  },
  {
    path: 'pays/:id',
    title: 'Historique d’un pays — Diplomatic Match',
    loadComponent: () => import('./features/countries/countries.page').then((m) => m.CountriesPage),
  },
  {
    path: 'comparer',
    title: 'Comparer les votes — Diplomatic Match',
    loadComponent: () => import('./features/compare/compare.page').then((m) => m.ComparePage),
  },
  {
    path: 'matrice',
    title: 'Matrice des concordances — Diplomatic Match',
    loadComponent: () => import('./features/matrix/matrix.page').then((m) => m.MatrixPage),
  },
  {
    path: 'resolutions',
    title: 'Les résolutions — Diplomatic Match',
    loadComponent: () =>
      import('./features/resolutions/resolutions.page').then((m) => m.ResolutionsPage),
  },
  {
    path: 'resolutions/:id',
    title: 'Détail d’une résolution — Diplomatic Match',
    loadComponent: () =>
      import('./features/resolutions/resolution-detail.page').then((m) => m.ResolutionDetailPage),
  },
  {
    path: 'methodologie',
    title: 'Sources et méthodologie — Diplomatic Match',
    loadComponent: () =>
      import('./features/methodology/methodology.page').then((m) => m.MethodologyPage),
  },
  {
    path: '**',
    title: 'Page introuvable — Diplomatic Match',
    loadComponent: () => import('./features/not-found.page').then((m) => m.NotFoundPage),
  },
];
