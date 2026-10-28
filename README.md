# Diplomatic Match

Application universitaire Angular pour explorer les votes enregistrés à l'Assemblée générale des Nations unies : recherche de pays, historique, comparaison, classements, évolution, résolutions et matrice de concordance. Un atelier permet aussi de créer des groupes de pays, tester leur composition et enregistrer leurs analyses. Les comparaisons peuvent être filtrées par thématique. Interface originale en français, responsive, sans template de site préconstruit.

## Installer et démarrer

Prérequis : Git, Node.js 24 LTS et npm. Environnement vérifié : Node.js 24.21.0 et npm 12.0.2.

```bash
git clone https://github.com/rylesdev/projet-NOMDUPROJET-Ryles-Maxime..git diplomatic-match
cd diplomatic-match
npm ci
npm start
```

Ouvrir **http://localhost:4200/**. `npm start` lance l'API locale sur `127.0.0.1:3001` et le serveur Angular sur le port 4200. Arrêt avec `Ctrl+C`. Les ports doivent être libres. Le proxy Angular transmet `/api` à l'API : aucun proxy CORS public ni secret n'est nécessaire.

Les données compactes sont livrées dans `data/dataset.json` (environ 15,3 Mo, sujets documentaires inclus). **Aucun téléchargement depuis les serveurs ONU n'est nécessaire pour utiliser l'application ou faire la démo** après l'installation des dépendances. Aucune police ni bibliothèque n'est chargée depuis un CDN.

Autre port Angular : `npm start -- --port 4201`. Pour lancer séparément les deux processus : `npm run start:api` et `npm run start:angular` dans deux terminaux.

## Les fonctionnalités et leurs appels

| Fonction         | Parcours                                         | Requêtes de notre API locale                                                       |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| F1 — Pays        | Rechercher France, ouvrir la fiche               | `GET /api/countries?search=France`, `GET /api/countries/FRA`                       |
| F2 — Historique  | Choisir une période, changer de page             | `GET /api/countries/FRA/votes?from=2000&to=2025&page=1&pageSize=20`                |
| F3 — Comparer    | Choisir deux pays et des années                  | `GET /api/compare?countryA=FRA&countryB=IND&from=2000&to=2025`                     |
| F4 — Évolution   | Comparaison puis regroupement annuel ou décennal | `GET /api/compare/trend?countryA=FRA&countryB=IND&from=2000&to=2025&interval=year` |
| F5 — Résolutions | Rechercher un texte ou symbole, ouvrir ses votes | `GET /api/resolutions?search=...&page=1`, `GET /api/resolutions/:id`               |

Le classement des pays est disponible dans chaque fiche : `GET /api/countries/FRA/rankings?from=2000&to=2025&minVotes=20` renvoie les trois pays les plus concordants et les trois moins concordants sur cette période.

Le catalogue `GET /api/themes` fournit les thèmes et leurs effectifs. Le paramètre `theme=environment`, par exemple, filtre de manière identique comparaison, classement et tendance. La page **Matrice** utilise `GET /api/matrix?from=2000&to=2025&theme=all&minVotes=20` pour comparer les 202 pays et entités historiques sur les deux axes.

Les recherches utilisent le debounce et annulent les requêtes obsolètes. Les filtres et pages déclenchent de nouvelles requêtes HTTP. Le service Angular valide les réponses avant leur affichage. Chargement, erreur, absence de résultats et succès sont traités. Les détails des votes renvoient vers la bibliothèque de l'ONU ; les titres des textes restent dans la langue de la source, généralement l'anglais.

Le graphique possède un tableau accessible des valeurs et effectifs. Les États historiques sont distincts : les codes du jeu source sont conservés, sans fusion de l'URSS avec la Russie, par exemple.

## Sources et méthode

Source : **© Nations unies, Bibliothèque Dag Hammarskjöld**, [votes enregistrés](https://digitallibrary.un.org/record/4060887) et [résolutions](https://digitallibrary.un.org/record/4060945). Version **6, publiée le 15 octobre 2026**. Le jeu importé comprend **954 382 positions, 202 codes pays et 20 834 résolutions**, dont 5 730 ont des positions de vote individuelles. Couverture réellement observée : **26 janvier 1946 au 17 septembre 2026**. Les non-votes font partie des positions consignées ; les résolutions sans vote individuel n'ont aucune position inventée.

La concordance vaut `100 × votes identiques / votes explicites communs`, pour `Y` (pour), `N` (contre), `A` (abstention). Deux abstentions sont concordantes. `X` (non-vote), absences et valeurs inconnues sont exclus du dénominateur. Avec zéro vote commun, le résultat est `null`, affiché par un tiret. Les bornes de période sont inclusives et l'arrondi concerne uniquement l'affichage. La même formule sert à chaque période du graphique ; les périodes sans votes communs restent vides.

Il s'agit d'un outil descriptif : ce taux n'est ni un indice d'alliance ni une mesure des relations bilatérales. Les faibles effectifs sont signalés. Les données s'utilisent à des fins non commerciales avec attribution ; leur licence ne doit pas être remplacée par celle du code. Voir [la FAQ officielle](https://ask.un.org/faq/432839), la page Méthodologie de l'application et [data/README.md](data/README.md) pour les limites, les schémas et la différence entre la date de début annoncée par le dictionnaire et celle observée dans le CSV.

### Pays aux votes les plus et les moins concordants

Dans une fiche pays, le classement recherche trois taux de concordance élevés et trois faibles sur la période choisie. Le pays lui-même est exclu. Chaque candidat doit atteindre le minimum de votes explicites communs (20 par défaut) ; les absences et valeurs inconnues restent exclues du calcul. Les effectifs et les dates de couverture sont affichés pour chaque résultat, car les votes communs peuvent différer d'un candidat à l'autre.

Le tri utilise le taux exact, avant tout arrondi. À taux égal, le plus grand nombre de votes communs est prioritaire, puis le nom et le code pays. Les trois pays les plus concordants sont sélectionnés d'abord ; les trois moins concordants sont ensuite choisis parmi les autres. Avec moins de six candidats éligibles, les listes restent incomplètes pour éviter de présenter un même pays des deux côtés. Sans candidat atteignant le seuil, aucun classement n'est fabriqué. Chaque résultat ouvre la comparaison détaillée sur la même période.

### Comparaisons par thématique

Les regroupements écologie/environnement, sécurité/paix, droits, développement, décolonisation et institutions sont **propres au projet**, à partir du champ `subjects` de l'ONU. Ils ne constituent pas une classification officielle. Les sujets exacts sont conservés ; aucune thématique n'est inventée à partir du titre ou du pays. Une résolution peut relever de plusieurs thèmes. Sans sujet reconnu, elle reste dans « Sans thème attribué » et demeure incluse dans « Tous les sujets ». Règles, exemples et effectifs sont documentés dans [data/README.md](data/README.md) et le manifeste.

Le jeu v6 contient 272 résolutions classées en écologie, mais seulement 21 avec des votes individuels enregistrés. Sur 2000–2025, France/Inde ont 15 votes comparables et 8 identiques en écologie (53,3 %), contre 647 comparables et 193 identiques en sécurité (29,8 %). Les seuils 1, 5 et 10 sont disponibles pour explorer les petits effectifs, avec un avertissement sous 20. Un résultat vide au seuil 20 reste un résultat vide : aucune position n'est ajoutée pour le remplir.

### Matrice de concordance

La matrice conserve tous les pays sur les deux axes, avec période, thème et seuil réglables. Bleu = forte concordance (100 %), rouge = faible concordance (0 %), gris = aucun vote commun ou minimum non atteint. Un véritable taux de 0 % est rouge et n'est jamais assimilé à une donnée manquante. La diagonale vaut 100 % uniquement si l'effectif du pays atteint le seuil. Les tableaux d'effectifs et de votes identiques utilisent la même formule que les comparaisons individuelles, de manière symétrique.

Survoler une case affiche pays, taux et effectif ; cliquer ouvre la comparaison détaillée avec les filtres appliqués. Les sélecteurs de pays permettent une lecture précise, y compris au clavier. Flèches, Début/Fin, Page précédente/suivante et Entrée sont pris en charge. Trois tailles de cases sont proposées ; en vue globale, certaines étiquettes sont espacées pour rester lisibles. Les en-têtes restent visibles pendant le défilement interne. Le dessin canvas évite de créer plus de 40 000 éléments HTML ; le panneau de lecture et les sélecteurs fournissent les valeurs sous forme textuelle.

### Carte des concordances

La page **Carte** (`/carte`) permet de choisir un pays en cliquant sur son territoire ou avec le sélecteur. Les autres pays sont colorés selon leur concordance avec ce pays de référence : **rouge à 0 %**, **bleu à 100 %**, **gris si aucun vote commun ou si le seuil n'est pas atteint**. La période, le thème et le minimum de votes communs sont réglables. Le survol permet de consulter les valeurs ; la comparaison détaillée reste accessible.

La carte réutilise `GET /api/matrix?from=2000&to=2025&theme=all&minVotes=20`. Une fois cette réponse chargée, changer le pays de référence recolore la carte localement, sans nouvelle requête. Modifier les filtres et les appliquer déclenche une nouvelle demande à l'API.

Le fond géographique est simplifié : tous les petits territoires et les entités historiques du jeu de votes ne sont pas nécessairement représentés. Les frontières de ce fond ne reconstituent pas les frontières de chaque période historique. Les entités historiques ne sont pas fusionnées avec les pays actuels. La source et la licence du fond sont documentées dans `public/maps/README.md`.

## Atelier Groupes : écritures et rapports persistants

Ouvrir **http://localhost:4200/groupes**. Créer un groupe de **2 à 12 pays distincts**, avec un nom et une description facultative. Le groupe est enregistré dans l'API, puis peut être modifié ou supprimé. Les analyses portent sur la composition enregistrée : un brouillon doit être sauvegardé avant analyse. La suppression demande une confirmation et retire aussi les rapports associés.

Le bouton **Analyser** produit un aperçu calculé à partir des votes officiels. **Enregistrer le rapport** recalcule côté serveur et sauvegarde un instantané comprenant composition, révision, paramètres, résultats, date et versions des données, des règles thématiques et de la méthode. Un rapport ancien reste identique après modification du groupe. L'historique permet de consulter deux rapports et de calculer un écart uniquement si leurs filtres et leurs versions de données/méthode sont compatibles.

### Simulations et suggestions

Ajouter ou retirer un membre dans le simulateur appelle l'API avec une composition de brouillon. **Le groupe enregistré ne change qu'avec « Appliquer au groupe »**. Les résultats avant/après indiquent les effectifs et les paires retenues ; leur différence ne constitue pas une prédiction diplomatique.

Les suggestions recherchent trois candidats atteignant le seuil de votes communs avec **chacun** des membres. Leur classement utilise les votes identiques et comparables des nouvelles paires candidat/membre. Par défaut, les candidats doivent avoir une couverture source allant jusqu'à la dernière année disponible de la période ; une option permet d'inclure les couvertures terminées plus tôt. Ce filtre utilise les dates observées dans le jeu et n'infère pas l'existence ou le statut politique actuel d'un État. Les entités historiques déjà choisies dans un groupe restent distinctes.

### Calcul de la concordance interne

Pour chaque paire du groupe, seuls les votes explicites `Y/N/A` communs sont retenus. Une paire doit atteindre le seuil choisi. La concordance interne vaut :

```text
100 × somme des votes identiques des paires éligibles
    / somme de leurs votes explicites communs
```

Ce taux est **pondéré par les effectifs**, et non une moyenne simple des pourcentages. Une résolution peut contribuer à plusieurs paires : le dénominateur est un nombre de **comparaisons de votes**, pas un nombre de résolutions uniques. Les paires peuvent couvrir des dates et des résolutions différentes ; le nombre de paires retenues sur le total est toujours affiché. Sans paire éligible, le taux est `null`. La couverture globale est l'union des dates des paires retenues. Le graphique recalcule exactement la même formule par année, avec le seuil appliqué à chaque paire/année.

La liste des résolutions divisantes conserve les désaccords stricts avec au moins deux votes explicites, leur proportion de paires identiques et le nombre de membres participants. Une ligne source absente reste inconnue et ne devient pas une abstention. Le compteur de résolutions observées inclut les textes où au moins un membre figure dans la source, y compris avec un non-vote.

Référence indépendante sur **France, Inde, Brésil et Canada**, 2000–2025, tous sujets, seuil 20 : **6 paires**, **13 304 comparaisons de votes**, **7 329 identiques**, soit **55,088695 %**. Retirer l'Inde donne **56,556391 %** ; ajouter la Belgique au groupe initial donne **60,624521 %**. Ces chiffres servent aux tests de calcul et ne sont pas des groupes précréés dans l'application.

### Routes d'écriture

| Action                                    | Requête                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Créer / lister                            | `POST /api/groups`, `GET /api/groups`                                  |
| Lire / modifier                           | `GET /api/groups/:id`, `PATCH /api/groups/:id`                         |
| Supprimer le groupe et ses rapports       | `DELETE /api/groups/:id?expectedRevision=2`                            |
| Tester une composition sans l'enregistrer | `POST /api/groups/:id/preview`                                         |
| Calculer et enregistrer un rapport        | `POST /api/groups/:id/reports`                                         |
| Lister / lire les rapports figés          | `GET /api/groups/:id/reports`, `GET /api/groups/:id/reports/:reportId` |
| Rechercher des candidats                  | `POST /api/groups/:id/suggestions`                                     |

Les créations renvoient 201 et les suppressions 204. `PATCH`, `DELETE` et les demandes d'analyse utilisent une `expectedRevision` : une version périmée renvoie **409**, sans écrasement. L'interface garde le brouillon en cas de conflit et propose un rechargement explicite. Le serveur valide membres, paramètres et champs JSON ; les résultats des rapports sont calculés par le serveur. Limites : 100 groupes, 100 rapports par groupe, corps JSON de 32 Ko et requêtes d'écriture en JSON.

### Stockage local

SQLite natif de Node.js conserve groupes et rapports dans **`data/local/groups.sqlite`**. Aucun paquet supplémentaire n'est nécessaire avec Node.js 24.21.0. Les données survivent au redémarrage de l'API et sont partagées entre les onglets utilisant cette installation locale. Il n'y a pas de comptes utilisateurs.

Le dossier **`data/local/` est exclu de Git**, y compris les fichiers SQLite WAL/SHM. Pour une sauvegarde manuelle, arrêter l'API puis copier ce dossier entier. `GROUPS_DB_PATH` permet de choisir un autre emplacement. Les tests utilisent une base mémoire ou temporaire séparée ; ils ne modifient pas les groupes personnels. Les écritures ne modifient jamais le jeu officiel `data/dataset.json`.

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
  features/matrix/            Matrice canvas, axes et lecture accessible
  features/groups/            Groupes, simulations et rapports enregistrés
  features/resolutions/       Recherche et détail
  features/methodology/       Sources, formule et limites
  app.routes.ts               Routes chargées à la demande
server/                       API HTTP Node, domaines, SQLite et tests
scripts/                      Lancement, téléchargement et import
public/                       Fichiers statiques
data/                         Données compactes, dictionnaires et manifestes
  local/                      Base des groupes et rapports (ignorée par Git)
PLAN_PROJET.md                Checklist et démonstration proposée (15 min)
```

## Validations universitaires restantes

Le développement technique ne vaut pas validation pédagogique. Les **cinq fonctions restent à faire valider par l'enseignant** ; son accès au dépôt et la convention finale `projet-diplomaticmatch-ryles-maxime` sont à confirmer. Aucune invitation n'a été envoyée et le dépôt distant n'a pas été renommé automatiquement.

Rendu : **1er décembre 2026 avant 23 h 59**. Démonstration : **2 décembre 2026**, 15 minutes maximum, application fonctionnelle sans présentation de code. Voir [PLAN_PROJET.md](PLAN_PROJET.md) pour le déroulé.
