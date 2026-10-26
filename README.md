# Diplomatic Match

Application universitaire Angular pour explorer les votes enregistrés à l'Assemblée générale des Nations unies : recherche de pays, historique, comparaison, évolution et résolutions. Interface originale en français, responsive, sans template de site préconstruit.

## Installer et démarrer

Prérequis : Git, Node.js 24 LTS et npm. Environnement vérifié : Node.js 24.21.0 et npm 12.0.2.

```bash
git clone https://github.com/rylesdev/projet-NOMDUPROJET-Ryles-Maxime..git diplomatic-match
cd diplomatic-match
npm ci
npm start
```

Ouvrir **http://localhost:4200/**. `npm start` lance l'API locale sur `127.0.0.1:3001` et le serveur Angular sur le port 4200. Arrêt avec `Ctrl+C`. Les ports doivent être libres. Le proxy Angular transmet `/api` à l'API : aucun proxy CORS public ni secret n'est nécessaire.

Les données compactes sont livrées dans `data/dataset.json` (environ 14,5 Mo). **Aucun téléchargement depuis les serveurs ONU n'est nécessaire pour utiliser l'application ou faire la démo** après l'installation des dépendances. Aucune police ni bibliothèque n'est chargée depuis un CDN.

Autre port Angular : `npm start -- --port 4201`. Pour lancer séparément les deux processus : `npm run start:api` et `npm run start:angular` dans deux terminaux.

## Les cinq fonctionnalités et leurs appels

| Fonction         | Parcours                                         | Requêtes de notre API locale                                                       |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| F1 — Pays        | Rechercher France, ouvrir la fiche               | `GET /api/countries?search=France`, `GET /api/countries/FRA`                       |
| F2 — Historique  | Choisir une période, changer de page             | `GET /api/countries/FRA/votes?from=2000&to=2025&page=1&pageSize=20`                |
| F3 — Comparer    | Choisir deux pays et des années                  | `GET /api/compare?countryA=FRA&countryB=IND&from=2000&to=2025`                     |
| F4 — Évolution   | Comparaison puis regroupement annuel ou décennal | `GET /api/compare/trend?countryA=FRA&countryB=IND&from=2000&to=2025&interval=year` |
| F5 — Résolutions | Rechercher un texte ou symbole, ouvrir ses votes | `GET /api/resolutions?search=...&page=1`, `GET /api/resolutions/:id`               |

Les recherches utilisent le debounce et annulent les requêtes obsolètes. Les filtres et pages déclenchent de nouvelles requêtes HTTP. Le service Angular valide les réponses avant leur affichage. Chargement, erreur, absence de résultats et succès sont traités. Les détails des votes renvoient vers la bibliothèque de l'ONU ; les titres des textes restent dans la langue de la source, généralement l'anglais.

Le graphique possède un tableau accessible des valeurs et effectifs. Les États historiques sont distincts : les codes du jeu source sont conservés, sans fusion de l'URSS avec la Russie, par exemple.

## Sources et méthode

Source : **© Nations unies, Bibliothèque Dag Hammarskjöld**, [votes enregistrés](https://digitallibrary.un.org/record/4060887) et [résolutions](https://digitallibrary.un.org/record/4060945). Version **6, publiée le 15 octobre 2026**. Le jeu importé comprend **954 382 positions, 202 codes pays et 20 834 résolutions**, dont 5 730 ont des positions de vote individuelles. Couverture réellement observée : **26 janvier 1946 au 17 septembre 2026**. Les non-votes font partie des positions consignées ; les résolutions sans vote individuel n'ont aucune position inventée.

La concordance vaut `100 × votes identiques / votes explicites communs`, pour `Y` (pour), `N` (contre), `A` (abstention). Deux abstentions sont concordantes. `X` (non-vote), absences et valeurs inconnues sont exclus du dénominateur. Avec zéro vote commun, le résultat est `null`, affiché par un tiret. Les bornes de période sont inclusives et l'arrondi concerne uniquement l'affichage. La même formule sert à chaque période du graphique ; les périodes sans votes communs restent vides.

Il s'agit d'un outil descriptif : ce taux n'est ni un indice d'alliance ni une mesure des relations bilatérales. Les faibles effectifs sont signalés. Les données s'utilisent à des fins non commerciales avec attribution ; leur licence ne doit pas être remplacée par celle du code. Voir [la FAQ officielle](https://ask.un.org/faq/432839), la page Méthodologie de l'application et [data/README.md](data/README.md) pour les limites, les schémas et la différence entre la date de début annoncée par le dictionnaire et celle observée dans le CSV.

## Reproduire l'import

```bash
npm run data:download
npm run data:import
```

Le premier script télécharge les deux CSV officiels (environ 376 Mo au total) et les dictionnaires. Le second inspecte les en-têtes, relie votes/résolutions par `undl_id`, normalise `Y/N/A/X` et génère le JSON compact, `data/source-manifest.json` et `data/import-report.json`. Les empreintes SHA-256, URLs, dates, comptages et rejets sont consignés. Les sources brutes de `data/raw/` sont exclues de Git. L'import actuel conserve toutes les lignes, sans rejet. Aucun CSV brut n'est envoyé au navigateur.

## Vérifier le projet

```bash
npm run build
npm test -- --watch=false
npm run test:api
```

Ou `npm run check` pour les trois vérifications. Compilation dans `dist/inf1-projet-angular/browser/`.

Les tests Angular couvrent le démarrage et les contrats HTTP. Les tests Node couvrent les calculs, les votes inconnus, les abstentions/absences, les périodes et bornes, le CSV, la validation des paramètres et les routes HTTP. Des tests de référence relisent aussi les données livrées : **France / Inde, 2000–2025 : 2 218 comparables, 1 005 identiques, 1 213 différents, 14 non comparables, soit 45,311091073 %**. Les petites fixtures des tests sont séparées des données officielles de production.

## Organisation

```text
src/app/
  core/models/                Contrats TypeScript
  core/services/              Service HttpClient et validation des réponses
  features/home/              Accueil et comparaison rapide
  features/countries/         Recherche, fiche et historique
  features/compare/           Concordance et évolution SVG/tableau
  features/resolutions/       Recherche et détail
  features/methodology/       Sources, formule et limites
  shared/components/          Globe illustratif original
  app.routes.ts               Routes chargées à la demande
server/                       API HTTP Node, domaine et tests
scripts/                      Lancement, téléchargement et import
public/                       Favicon original, fichiers statiques
data/                         Données compactes, dictionnaires et manifestes
PLAN_PROJET.md                Checklist et démonstration proposée (15 min)
```

## Validations universitaires restantes

Le développement technique ne vaut pas validation pédagogique. Les **cinq fonctions restent à faire valider par l'enseignant** ; son accès au dépôt et la convention finale `projet-diplomaticmatch-ryles-maxime` sont à confirmer. Aucune invitation n'a été envoyée et le dépôt distant n'a pas été renommé automatiquement.

Rendu : **1er décembre 2026 avant 23 h 59**. Démonstration : **2 décembre 2026**, 15 minutes maximum, application fonctionnelle sans présentation de code. Voir [PLAN_PROJET.md](PLAN_PROJET.md) pour le déroulé.
