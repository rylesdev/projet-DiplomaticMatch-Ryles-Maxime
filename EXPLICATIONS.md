# Diplomatic Match — explications du code

Ce document explique le rôle de chaque fichier important, les notions Angular et Node utilisées, puis le trajet complet d'une action pour chaque fonctionnalité. Il sert à répondre aux questions du professeur.

## 1. Vue d'ensemble

```text
npm start  (scripts/dev.mjs)
 ├─ node --watch-path=server server/index.mjs    API Node, http://127.0.0.1:3001
 └─ ng serve                                    Angular, http://localhost:4200

Navigateur
 ├─ src/main.ts démarre MirageJS, puis Angular
 ├─ Angular appelle /api/...      → MirageJS laisse passer → proxy de ng serve → API Node (GET)
 └─ Angular appelle /mock-api/... → MirageJS répond lui-même → localStorage
```

- **API Node** : lit `data/dataset.json` une fois au démarrage, garde tout en mémoire et fait les calculs (concordances, classements, matrice, analyse de groupe). Elle n'accepte que `GET`.
- **API mockée MirageJS** : vit dans le navigateur. Elle reçoit les écritures (créer, modifier, supprimer un groupe, enregistrer un rapport) et les sauvegarde dans le `localStorage`.
- **Angular** : les pages (composants) appellent des services, qui envoient les requêtes HTTP et renvoient des Observables ; les réponses sont rangées dans des signals, que les templates affichent.

## 2. Les notions utilisées

**Composant standalone.** Une classe TypeScript décorée par `@Component`, avec un template HTML et une feuille SCSS. « Standalone » signifie qu'il déclare lui-même ce qu'il utilise dans `imports: [...]` (par exemple `ReactiveFormsModule`, `RouterLink`, `DecimalPipe` ou un autre composant), sans `NgModule`. Exemple : `ComparePage` dans `features/compare/compare.page.ts`.

**Routes.** `app.routes.ts` associe une adresse à une page : `/comparer` → `ComparePage`. `loadComponent: () => import(...)` charge le code de la page seulement quand on la visite (chargement à la demande, bundle initial plus léger). `/pays/:id` contient un paramètre lu avec `ActivatedRoute.paramMap`. Les liens du menu utilisent `routerLink` ; `<router-outlet>` dans `app.html` affiche la page active. La route `**` affiche la page « introuvable ».

**inject().** Récupère un service fourni par Angular (injection de dépendances) : `private readonly api = inject(DiplomaticApiService);`. Les services marqués `@Injectable({ providedIn: 'root' })` n'existent qu'en un exemplaire pour toute l'application.

**Signals.** Une valeur réactive : `readonly loading = signal(false)`. On lit avec `loading()`, on écrit avec `loading.set(true)`. Quand un signal change, Angular met à jour les parties du template qui le lisent. `computed(() => ...)` calcule une valeur à partir d'autres signals et se recalcule seul (exemple : `dirty` dans `groups.page.ts` compare le brouillon au groupe enregistré). Chaque page a le même trio : résultat, `loading` et `error`.

**RxJS et Observables.** `HttpClient` renvoie un Observable : la requête part quand on s'y abonne (`subscribe`), et la réponse arrive plus tard. Les opérateurs utilisés :

- `switchMap` : quand une nouvelle demande arrive, il **annule la requête précédente** et ne garde que la dernière. C'est le cœur de nos pages : chaque page a un `Subject` (une « file » de demandes) ; `compare()` y pousse les filtres, `switchMap` lance l'appel API. Si l'utilisateur change d'avis avant la réponse, l'ancienne réponse n'écrase jamais la nouvelle.
- `debounceTime(250)` : attend que l'utilisateur ait fini de taper avant de chercher ; `distinctUntilChanged` : ne relance pas si le texte n'a pas changé.
- `catchError` : transforme une erreur en message affiché ; `finalize` : remet `loading` à `false` dans tous les cas.
- `forkJoin` : lance plusieurs requêtes en parallèle et attend toutes les réponses (pays, thèmes et métadonnées d'une page).
- `combineLatest` : combine le paramètre de route et le bouton « Recharger ».
- `takeUntilDestroyed` : coupe l'abonnement quand on quitte la page (pas de fuite mémoire).
- `timeout` : dans l'intercepteur, abandonne une requête au bout de 15 s.

**Reactive Forms.** Le formulaire est décrit en TypeScript (`FormBuilder.nonNullable.group({...})`) avec ses validateurs, puis relié au HTML par `[formGroup]` et `formControlName`. Validateurs Angular : `Validators.required`, `min`, `max`, `maxLength`. Validateurs du projet : `periodValidator` (années entières, début ≤ fin, seuil entier), `differentCountries` (deux pays différents) et `groupNameValidator` (nom de 2 à 80 caractères, espaces du début et de la fin retirés). On appelle `markAllAsTouched()` à l'envoi pour afficher les erreurs, et on n'envoie pas la requête si `form.invalid`.

**HttpClient.** Fourni dans `app.config.ts` par `provideHttpClient(withInterceptors([timeoutInterceptor]))`. `http.get<T>(url, { params })` ajoute les paramètres à l'URL et type la réponse avec une interface de `core/models/`. Un **intercepteur** est une fonction qui voit passer toutes les requêtes : le nôtre ajoute le délai de 15 s.

**Proxy.** En développement, Angular est servi sur le port 4200 et l'API sur le port 3001. Le fichier `proxy.conf.mjs` (déclaré dans `angular.json`) demande à `ng serve` de transmettre `/api/**` vers `http://127.0.0.1:3001`. Le navigateur ne parle qu'à une seule origine : pas de CORS à gérer.

**Serveur Node sans framework.** `server/api.mjs` utilise directement `createServer` du module `node:http` : une seule fonction reçoit chaque requête, lit `request.method` et l'URL, choisit le calcul selon le chemin (`if (path === '/api/compare')`, expressions régulières pour `/api/countries/:id/...`) et répond en JSON. Les erreurs prévues sont des `HttpError(status, message)` ; le serveur les transforme en réponse `{ "error": "..." }` avec le bon statut (400, 404, 405), et en 500 pour une erreur imprévue.

**MirageJS et passthrough.** MirageJS remplace, dans le navigateur, les fonctions qui envoient des requêtes (XMLHttpRequest et fetch). Quand une requête correspond à une de ses routes (`/mock-api/...`), il exécute notre fonction et renvoie une réponse sans passer par le réseau. `passthrough('/api/**')` lui dit de laisser partir les autres requêtes vers le vrai réseau. `this.logging = true` écrit chaque requête dans la console ; elle n'apparaît pas dans l'onglet Réseau puisqu'elle ne quitte pas le navigateur.

**localStorage.** Un petit stockage clé/valeur du navigateur, propre à l'adresse du site, qui survit au rechargement. MirageJS y garde `{ groups: [...], reports: [...] }` en JSON sous la clé `diplomatic-match-mock-api`. L'état est relu à chaque requête : un onglet voit ce qu'un autre vient d'enregistrer.

**Révision et 409.** Chaque groupe a un numéro `revision` qui augmente à chaque modification. Les écritures envoient la révision qu'elles croient à jour (`expectedRevision`). Si elle ne correspond plus (un autre onglet a modifié le groupe), MirageJS refuse avec **409 Conflict** : rien n'est écrasé.

## 3. Rôle de chaque fichier

### Racine et configuration

| Fichier           | Rôle                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`    | Dépendances (Angular 21, RxJS, MirageJS 0.1.48) et scripts : `start`, `build`, `test`, `test:api`, `check`, `data:download`, `data:import`.                                               |
| `angular.json`    | Configuration du projet Angular : budgets (bundle initial : avertissement à 700 ko, erreur à 1 Mo ; style d'un composant : 12/16 ko), proxy, dépendances CommonJS de MirageJS autorisées. |
| `proxy.conf.mjs`  | Transmet `/api/**` de `ng serve` vers l'API Node (port `API_PORT`, 3001 par défaut).                                                                                                      |
| `tsconfig*.json`  | Options du compilateur TypeScript (mode strict).                                                                                                                                          |
| `scripts/dev.mjs` | Commande `npm start` : vérifie que le port de l'API est libre, lance l'API (redémarrée automatiquement quand un fichier de `server/` change) et `ng serve` ; `Ctrl+C` arrête les deux.    |

### Données et import (`data/`, `scripts/`)

| Fichier                                           | Rôle                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/dataset.json`                               | Données compactes produites par l'import : pays, résolutions avec leurs sujets et leurs votes `[indice du pays, Y/N/A/X]`, métadonnées (version, couverture). |
| `data/source-manifest.json`, `import-report.json` | Provenance, empreintes, comptages et contrôles de l'import.                                                                                                   |
| `data/README.md`                                  | Annexe : sources, schéma des CSV, limites, règles des thèmes.                                                                                                 |
| `scripts/download-data.mjs`, `source-config.mjs`  | Téléchargent les CSV et dictionnaires officiels dans `data/raw/` (hors Git).                                                                                  |
| `scripts/csv.mjs`                                 | Lecteur CSV en flux (le CSV des votes fait 368 Mo).                                                                                                           |
| `scripts/import-data.mjs`                         | Relie votes et résolutions par `undl_id`, normalise les votes, découpe les sujets sur `                                                                       | `, écrit `dataset.json`. |
| `scripts/build-world-map.mjs`                     | Génère `public/maps/world.json` (contours SVG simplifiés de Natural Earth).                                                                                   |

### API Node (`server/`)

| Fichier                   | Rôle                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.mjs`               | Point d'entrée : lit `dataset.json`, construit le store, démarre le serveur sur `127.0.0.1:API_PORT`.                                                                                                                                                                                                                    |
| `api.mjs`                 | Routeur HTTP : refuse tout sauf `GET` (405), lit et valide les paramètres (`period`, `integer`, `themeParameter`, `groupParameters`…), appelle la bonne fonction de calcul, renvoie du JSON. Toutes les routes de l'API y sont.                                                                                          |
| `domain.mjs`              | Calculs principaux. `createStore` prépare les données en mémoire (pays par code, votes par pays, `voteMap` de chaque résolution, thèmes, majorité de séance). `compareCountries`, `compareTrend`, `rankCountries`, `compareMatrix` (avec cache), `selectMatrix`, `concordanceRow`, `countryProfile`, `resolutionDetail`. |
| `group-domain.mjs`        | `analyzeGroup` : concordance interne pondérée d'une liste de pays, détail des paires, évolution annuelle, 8 résolutions qui divisent le plus ; `validateMemberIds` (2 à 12 codes distincts existants).                                                                                                                   |
| `group-suggestions.mjs`   | `suggestGroupMembers` : trois pays candidats, chacun au-dessus du seuil avec chaque membre, triés par concordance avec le groupe ; donne aussi la concordance du groupe après ajout.                                                                                                                                     |
| `themes.mjs`              | Les 11 thèmes + « Sans thème attribué » et leurs règles (motifs reconnus dans `subjects`), version `diplomatic-match-subject-rules-v2`.                                                                                                                                                                                  |
| `country-names.mjs`       | Noms français des 202 codes et liste des codes historiques.                                                                                                                                                                                                                                                              |
| `http-error.mjs`          | Classe `HttpError` et contrôle d'un entier dans un intervalle.                                                                                                                                                                                                                                                           |
| `*.test.mjs`, `fixtures/` | Tests `node:test` : calculs sur de petites données inventées, routes HTTP, refus des écritures (405), et contrôles sur les vraies données (France / Inde 45,311 %).                                                                                                                                                      |

### Démarrage d'Angular (`src/`)

| Fichier                  | Rôle                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`            | Démarre MirageJS (`startMockApi()`) puis Angular (`bootstrapApplication`).                                                                                                                     |
| `src/styles.scss`        | Design global (couleurs, typographie, boutons, panneaux), polices locales DM Sans et Instrument Serif.                                                                                         |
| `app/app.config.ts`      | Fournisseurs globaux : HttpClient avec l'intercepteur de délai, routeur, langue française, et `provideAppInitializer` qui lit `/api/metadata` avant d'afficher les pages (période par défaut). |
| `app/app.ts`, `app.html` | Composant racine : en-tête et menu (Accueil, Pays, Comparer, Carte, Matrice, Groupes, Résolutions, Méthodologie), `<router-outlet>`, pied de page.                                             |
| `app/app.routes.ts`      | Table des routes (voir les notions).                                                                                                                                                           |

### Partie commune (`src/app/core/`, `src/app/shared/`)

| Fichier                                                        | Rôle                                                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/models/api.models.ts`, `groups.models.ts`                | Interfaces TypeScript des réponses (`Country`, `ComparisonResult`, `CountryGroup`, `GroupAnalysis`…). Elles décrivent ce que renvoient les API.                              |
| `core/services/diplomatic-api.service.ts`                      | Toutes les lectures de l'API Node (`countries`, `votes`, `profile`, `rankings`, `compare`, `trend`, `matrixSelection`, `concordances`, `resolutions`…) et `apiErrorMessage`. |
| `core/services/data-period.service.ts`                         | Période par défaut : 2000 et la dernière année complète des données (2025), lue au démarrage ; première année (1946) pour les résolutions.                                   |
| `core/services/groups-api.service.ts`                          | Groupes sur MirageJS : lister, lire, créer (`POST`), modifier (`PUT` + `expectedRevision`), supprimer (`DELETE ?expectedRevision=`), `checkRevision` ; `groupErrorMessage`.  |
| `core/services/group-analysis.service.ts`                      | `GET /api/groups/analysis` ; ajoute au résultat l'identifiant et la révision du groupe analysé.                                                                              |
| `core/services/group-suggestions.service.ts`                   | `GET /api/groups/suggestions`.                                                                                                                                               |
| `core/services/group-reports.service.ts`                       | Rapports sur MirageJS : liste, détail, enregistrement.                                                                                                                       |
| `core/http-timeout.interceptor.ts`                             | Délai maximal de 15 s pour toutes les requêtes.                                                                                                                              |
| `core/period.validator.ts`, `different-countries.validator.ts` | Validateurs de formulaire partagés.                                                                                                                                          |
| `core/vote-labels.ts`                                          | Libellés et couleurs des votes : Pour, Contre, Abstention, Non-vote, Inconnu.                                                                                                |
| `shared/country-picker.component.*`                            | Sélecteur de pays avec recherche et maximum (12 pour un groupe, 15 pour la matrice).                                                                                         |
| `shared/concordance-colors.ts`                                 | Échelle de couleur : rouge à 0 %, clair à 50 %, bleu à 100 %, gris sans valeur.                                                                                              |

### API mockée (`src/app/mock-api/`)

| Fichier             | Rôle                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mock-api.ts`       | `createServer` de MirageJS : préfixe `mock-api`, routes des groupes et des rapports, journal console, passthrough de `/api/**` et `/maps/**`.                                                                                      |
| `mock-store.ts`     | Lecture et sauvegarde de l'état dans le `localStorage` ; deux groupes d'exemple au premier lancement ; `findGroup` (404), `requireRevision` (400/409), `readBody` (400), `respond` (transforme une erreur prévue en réponse HTTP). |
| `groups.routes.ts`  | `GET/POST /groups`, `GET/PUT/DELETE /groups/:id` ; validation (nom 2 à 80 caractères, description ≤ 500, 2 à 12 codes distincts), limite de 100 groupes ; la suppression efface aussi les rapports du groupe.                      |
| `reports.routes.ts` | `GET/POST /groups/:id/reports`, `GET /groups/:id/reports/:reportId` ; un rapport fige la composition du groupe et l'analyse affichée ; refusé si la révision ou les membres ne correspondent plus.                                 |
| `*.spec.ts`         | Tests de ces routes (création, 400, 404, 409, suppression en cascade).                                                                                                                                                             |

### Pages (`src/app/features/`)

| Dossier / fichier                                            | Rôle                                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home/home.page.*`                                           | Accueil : chiffres du jeu, comparaison rapide de deux pays (renvoie vers `/comparer`), carte intégrée.                                                                     |
| `countries/countries.page.*`                                 | Recherche de pays, fiche, historique paginé des votes.                                                                                                                     |
| `countries/country-profile.component.*`                      | Répartition des votes du pays et alignement sur la majorité de l'Assemblée ; votes les plus isolés.                                                                        |
| `countries/country-rankings.component.*`                     | Top 3 des pays les plus et les moins concordants (seuil 50 par défaut).                                                                                                    |
| `compare/compare.page.*`                                     | Comparaison de deux pays : taux, grille 3 × 3 des votes croisés, résolutions d'accord et de désaccord, mot-clé, évolution (graphique SVG et tableau), points remarquables. |
| `matrix/matrix-selection.page.*`                             | Matrice des pays choisis (2 à 15).                                                                                                                                         |
| `resolutions/resolutions.page.*`, `resolution-detail.page.*` | Recherche paginée des résolutions ; détail avec les votes de chaque pays et le lien vers la notice ONU (« Adoptée sans vote enregistré » quand il n'y a aucun vote).       |
| `groups/groups.page.*`                                       | Atelier : liste des groupes, formulaire (Reactive Form), enregistrement, suppression avec confirmation, filtres et lancement de l'analyse, conflit de révision, rapports.  |
| `groups/group-analysis-view.component.*`                     | Affichage d'une analyse : chiffres, paires, courbe annuelle, résolutions qui divisent (réutilisé par les rapports).                                                        |
| `groups/group-scenarios.component.*`                         | Simulation d'un ajout ou d'un retrait ; « Appliquer au groupe ».                                                                                                           |
| `groups/group-suggestions.component.*`                       | Pays candidats ; « Tester ce pays » remplit la simulation.                                                                                                                 |
| `groups/group-reports.component.*`                           | Historique des rapports et comparaison de deux rapports (écart affiché seulement si filtres et versions sont identiques).                                                  |
| `map/map.page.*`, `map-explorer.component.*`, `map-data.ts`  | Carte : chargement de `/maps/world.json`, coloration de chaque pays selon sa concordance avec le pays de référence, survol et clic.                                        |
| `methodology/methodology.page.*`                             | Sources, formule, limites.                                                                                                                                                 |
| `not-found.page.ts`                                          | Page « introuvable ».                                                                                                                                                      |

Les fichiers `*.spec.ts` sont les tests Angular (Vitest) : ils remplacent les vraies API par `HttpTestingController` ou par des objets simulés et vérifient les requêtes envoyées et l'affichage.

## 4. Trajet complet d'une action

Le schéma est toujours le même :

```text
clic ou saisie → méthode du composant → Subject.next(demande) → switchMap → méthode du service
→ HttpClient → (intercepteur 15 s) → MirageJS (passthrough ou réponse) → proxy → API Node
→ réponse JSON → signal.set(résultat) → le template se met à jour
```

### 4.1 Explorer les pays

1. L'utilisateur tape « fran » dans « Rechercher un État ». Le `FormControl` `search` émet chaque frappe ; `debounceTime(250)` attend la fin de la saisie, `switchMap` appelle `api.countries('fran')`.
2. `DiplomaticApiService` envoie `GET /api/countries?search=fran`. MirageJS le laisse passer, le proxy le transmet à l'API.
3. `api.mjs` normalise le texte (minuscules, sans accents), filtre les 202 pays sur le code et les noms, trie par nom français et renvoie la liste.
4. Le composant fait `countries.set(liste)` ; le template affiche les pays avec un lien `/pays/FRA`.
5. Clic sur France : le routeur change l'URL ; `route.paramMap` émet `FRA` ; `switchMap` appelle `GET /api/countries/FRA`. Une fois le pays reçu, `applyVotes()` demande `GET /api/countries/FRA/votes?from=2000&to=2025&page=1&pageSize=20`. L'API filtre les votes du pays sur la période et renvoie la page demandée avec le total (pagination).
6. Les composants enfants reçoivent le code du pays par `@Input` : `CountryProfileComponent` appelle `/api/countries/FRA/profile` (`countryProfile` : totaux par type de vote, part des votes identiques au choix majoritaire de l'Assemblée), `CountryRankingsComponent` appelle `/api/countries/FRA/rankings?minVotes=50` (`rankCountries` : un seul parcours des votes de la France, puis tri par taux exact ; les 3 plus proches, puis les 3 plus éloignés parmi les autres).
7. Chaque bloc a son propre `loading` et son propre message d'erreur.

### 4.2 Comparer les votes

1. Le formulaire (pays A, pays B, thème, mot-clé, années) est un Reactive Form avec `periodValidator` et `differentCountries`. Clic sur « Comparer » → `compare()` : s'il est invalide, les erreurs s'affichent et aucune requête ne part.
2. Sinon, `compare()` pousse les filtres dans deux Subjects : `comparisons` et `trends`. Chacun passe par `switchMap` : `api.compare(...)` → `GET /api/compare?countryA=FRA&countryB=IND&from=2000&to=2025&theme=all`, et `api.trend(...)` → `GET /api/compare/trend?...&interval=year`.
3. Côté API, `compareCountries` parcourt les résolutions de la période (et du thème, et du mot-clé s'il y en a un, avec quelques synonymes français → anglais). Pour chaque résolution où les deux pays ont voté Pour, Contre ou Abstention, il compte un vote commun, et un accord si les choix sont identiques. Il remplit la grille 3 × 3 (`breakdown`) et garde au plus 4 exemples par case (6 avec un mot-clé). `compareTrend` refait le même calcul année par année (ou décennie) et repère les points remarquables (année la plus haute, la plus basse, plus forte hausse et baisse).
4. Les réponses arrivent dans `result` et `trend` ; des `computed` préparent le graphique SVG (`plottedPoints`, `chartSegments`) et la liste des résolutions affichées.
5. Passer de « Année » à « Décennie » relance seulement la tendance. Les paramètres peuvent aussi venir de l'URL (`/comparer?countryA=FRA&countryB=USA&...`), utilisé par l'accueil, la matrice et la carte.

### 4.3 Visualiser les concordances (matrice)

1. La page démarre avec 6 pays (`selectedIds`) et lance `apply()`.
2. Le sélecteur partagé `app-country-picker` (maximum 15) émet la nouvelle liste ; clic sur « Afficher la matrice » → `apply()` vérifie le formulaire et le nombre de pays, puis pousse la demande dans `requests`.
3. `switchMap` → `api.matrixSelection(...)` → `GET /api/matrix/selection?countries=FRA,USA,GBR,CHN,RUS,IND&from=2000&to=2025&minVotes=20&theme=all`.
4. `selectMatrix` utilise `compareMatrix` (accords et votes communs de toutes les paires de pays pour cette période et ce thème, gardés en cache pour les demandes suivantes) et n'en extrait que les lignes et colonnes demandées, dans l'ordre choisi (réponse de 2 Ko). Sous le seuil, la case vaut `null`.
5. Le template dessine un tableau HTML ; chaque case reçoit sa couleur avec `concordanceColor(taux)`. Une case est un lien `routerLink="/comparer"` avec les deux pays et les filtres en `queryParams`.

### 4.4 Explorer les résolutions

1. La saisie dans « Titre ou symbole de résolution » passe par `debounceTime(300)` ; les années par le formulaire. `applySearch()` pousse `{ search, from, to, page }` dans un `BehaviorSubject`.
2. `switchMap` → `GET /api/resolutions?search=Ukraine&page=1&pageSize=20&from=1946&to=2025`. L'API filtre les 20 834 résolutions (texte normalisé du symbole et du titre, période), du plus récent au plus ancien, et renvoie une page de 20 avec le total.
3. Clic sur une résolution → `/resolutions/3959039` → `ResolutionDetailPage` lit l'identifiant dans la route → `GET /api/resolutions/3959039`. `resolutionDetail` renvoie la résolution, le vote de chaque pays (trié par nom) et les totaux.
4. Le template affiche les totaux, la liste « État par État » (chaque pays renvoie vers sa fiche) et le lien `sourceUrl` vers la notice de la Bibliothèque numérique de l'ONU.

### 4.5 Groupes de pays (écriture)

**Créer.**

1. « Nouveau » vide le formulaire. L'utilisateur saisit le nom (Reactive Form, `groupNameValidator`), la description (`maxLength(500)`) et choisit les pays avec `app-country-picker` (signal `memberIds`).
2. « Enregistrer le groupe » → `save()` : `markAllAsTouched()` ; si le nom est invalide ou s'il y a moins de 2 ou plus de 12 pays, les erreurs s'affichent et rien ne part.
3. Sinon `GroupsApiService.createGroup(draft)` → `POST /mock-api/groups` avec `{ name, description, memberIds }`.
4. MirageJS intercepte la requête (console : `Mirage: [201] POST /mock-api/groups`). `respond` relit l'état du `localStorage`, `createGroup` valide le corps (400 sinon), crée `{ id, ..., revision: 1, createdAt, updatedAt }`, l'ajoute, puis l'état est sauvegardé.
5. La page reçoit le groupe : `acceptGroup` remplit le formulaire, la liste est rechargée (`GET /mock-api/groups`), le routeur va sur `/groupes/<id>`, le message « Le groupe a été enregistré. » s'affiche.

**Modifier.** Même trajet avec `updateGroup(id, draft, revision)` → `PUT /mock-api/groups/:id` avec `expectedRevision`. MirageJS vérifie la révision (409 si elle a changé), remplace les champs et fait `revision + 1`.

**Supprimer.** « Supprimer » affiche une confirmation dans la page ; « Confirmer la suppression » → `deleteGroup(id, revision)` → `DELETE /mock-api/groups/:id?expectedRevision=2` → MirageJS supprime le groupe et ses rapports, répond 204 ; la page revient sur `/groupes`.

**Analyser.**

1. « Analyser » → `analyze()` : refusé si le groupe a des modifications non enregistrées (`dirty`), un conflit ou des filtres invalides.
2. La demande passe par `switchMap` : d'abord `checkRevision(group)` → `GET /mock-api/groups/:id` (MirageJS) ; si la révision a changé, erreur 409 et message de conflit.
3. Puis `GroupAnalysisService.analyze(group, filters)` → `GET /api/groups/analysis?members=FRA,IND,BRA,CAN&from=2000&to=2025&theme=all&minVotes=20` (API Node).
4. `analyzeGroup` compte, pour chaque paire de membres, les votes communs et identiques, globalement et par année ; une paire sous le seuil est écartée ; il garde les résolutions où les membres ne sont pas tous d'accord, triées de la plus divisée à la moins divisée.
5. Le service ajoute `groupId` et `groupRevision` au résultat ; la page fait `analysis.set(...)` et `GroupAnalysisViewComponent` affiche les chiffres, les paires, la courbe et les résolutions.

**Conflit entre deux onglets.** Les deux onglets lisent le même `localStorage`. Si l'onglet A enregistre (révision 2), l'onglet B, resté en révision 1, reçoit 409 à l'enregistrement ou à la vérification avant un calcul. `handleError` met `conflict` à `true` : le brouillon reste affiché, les actions sont bloquées et « Recharger » relit la dernière version.

### 4.6 Fonctionnalités complémentaires

- **Simulation** (`group-scenarios`) : choisir « Ajouter » ou « Retirer » et un pays → `simulate()` calcule la liste proposée → `checkRevision` puis `GET /api/groups/analysis` avec cette liste. Rien n'est enregistré. « Appliquer au groupe » émet la liste vers la page, qui fait un `PUT` (nouvelle révision).
- **Suggestions** (`group-suggestions`) : « Rechercher des candidats » → `checkRevision` puis `GET /api/groups/suggestions?members=...&includeHistorical=false`. `suggestGroupMembers` utilise la matrice en cache : un candidat doit atteindre le seuil avec chaque membre ; tri par concordance avec le groupe ; trois résultats avec la concordance du groupe après ajout. « Tester ce pays » lance la simulation.
- **Rapports** (`group-reports`) : « Enregistrer le rapport » → `POST /mock-api/groups/:id/reports` avec `{ expectedRevision, analysis }`. MirageJS vérifie la révision et que l'analyse correspond aux membres enregistrés, puis fige une copie du groupe et de l'analyse. Le composant liste les rapports (`GET .../reports`), charge les deux sélectionnés en parallèle (`forkJoin` de deux `GET .../reports/:reportId`) et n'affiche l'écart B − A que si les filtres et les versions sont identiques.
- **Carte** (`map-explorer`) : charge `/maps/world.json` (fichier statique, passthrough MirageJS) et `GET /api/countries/FRA/concordances?...` (`concordanceRow` : une ligne de la matrice, 25 Ko). `map-data.ts` associe chaque contour à un pays du jeu et lui donne sa couleur. Un clic sur un pays change le pays de référence et relance la requête.

## 5. Statuts HTTP rencontrés

| Statut  | Signification dans le projet                                                             |
| ------- | ---------------------------------------------------------------------------------------- |
| 200     | Lecture ou modification réussie.                                                         |
| 201     | Groupe ou rapport créé (MirageJS).                                                       |
| 204     | Groupe supprimé (MirageJS), réponse sans contenu.                                        |
| 400     | Paramètre ou corps invalide : années, seuil, thème, pays, nom du groupe… (les deux API). |
| 404     | Pays, résolution, groupe ou route inconnus.                                              |
| 405     | Méthode autre que GET envoyée à l'API Node.                                              |
| 409     | Révision périmée (MirageJS) ou groupe modifié ailleurs (vérification avant un calcul).   |
| 0 / 500 | API arrêtée ou erreur imprévue : « Le service de données est indisponible ».             |
| délai   | Pas de réponse en 15 s : message demandant de vérifier que l'API est lancée.             |
