# Diplomatic Match — projet-diplomaticmatch-ryles-maxime

Projet Angular universitaire de Ryles et Maxime. Diplomatic Match explore les votes enregistrés à l'Assemblée générale des Nations unies : fiche et historique d'un pays, comparaison de deux pays, matrice des concordances, carte, recherche de résolutions et atelier de groupes de pays. L'interface est en français et le design est propre au projet (sans template).

## Installer et lancer

Prérequis : Node.js 24 (vérifié avec 24.21.0) et npm.

```bash
npm ci
npm start
```

Ouvrir **http://localhost:4200/**. `npm start` (`scripts/dev.mjs`) lance deux processus : l'API Node sur `127.0.0.1:3001` et le serveur Angular sur le port 4200. Arrêt avec `Ctrl+C`. Le port 3001 doit être libre ; sinon, choisir un autre port avec la variable d'environnement `API_PORT`.

Les données sont livrées dans `data/dataset.json` (15 Mo). L'application fonctionne **sans internet** : pas de CDN, polices locales, aucun appel aux serveurs de l'ONU pendant l'utilisation.

Vérifications : `npm run build`, `npm test -- --watch=false` (tests Angular) et `npm run test:api` (tests de l'API), ou `npm run check` pour les trois.

## Architecture : deux API

```text
Navigateur (Angular)
 ├─ /api/...       ──► proxy de ng serve (proxy.conf.mjs) ──► API Node (server/), port 3001
 │                     lectures et calculs, GET uniquement
 └─ /mock-api/...  ──► MirageJS (src/app/mock-api/), dans le navigateur
                       écritures : groupes et rapports, sauvegardés dans le localStorage
```

- **API Node** (`server/`, sans framework, module `node:http`) : charge `data/dataset.json` au démarrage et répond en JSON. Elle n'accepte que `GET` : toute autre méthode renvoie **405**. Une route inconnue renvoie 404, un paramètre invalide 400.
- **API mockée MirageJS** (`/mock-api`) : intercepte dans le navigateur les requêtes vers `/mock-api`, gère création, modification et suppression des groupes et des rapports, et les sauvegarde dans le `localStorage` (clé `diplomatic-match-mock-api`). Tout le reste (`/api/**`, `/maps/**`) est laissé passer (passthrough) vers le réseau. Ses requêtes sont **journalisées dans la console** du navigateur ; elles n'apparaissent pas dans l'onglet Réseau.
- Toutes les requêtes HTTP ont un délai maximal de **15 secondes** (`core/http-timeout.interceptor.ts`).

## Fonctionnalités et appels API

Période par défaut : de 2000 à la dernière année complète des données (2025), sauf pour les résolutions (depuis 1946).

**1. Explorer les pays** (`/pays`, `/pays/:id`) : rechercher un pays, ouvrir sa fiche, son historique de votes paginé, son alignement sur la majorité de l'Assemblée et le top 3 des pays les plus et les moins concordants (seuil de 50 votes communs par défaut).

- `GET /api/countries?search=fran` et `GET /api/countries/FRA`
- `GET /api/countries/FRA/votes?from=2000&to=2025&page=1&pageSize=20`
- `GET /api/countries/FRA/profile?from=2000&to=2025&theme=all`
- `GET /api/countries/FRA/rankings?from=2000&to=2025&minVotes=50&theme=all`

**2. Comparer les votes** (`/comparer`) : deux pays, période, thème, mot-clé facultatif ; taux de concordance, grille des votes croisés, exemples de résolutions, évolution par année ou par décennie.

- `GET /api/compare?countryA=FRA&countryB=IND&from=2000&to=2025&theme=all` (option `search=Palestine`)
- `GET /api/compare/trend?countryA=FRA&countryB=IND&from=2000&to=2025&interval=year&theme=all` (`interval=decade` possible)

**3. Visualiser les concordances** (`/matrice`) : matrice de 2 à 15 pays choisis (6 au départ : France, États-Unis, Royaume-Uni, Chine, Russie, Inde), taux et votes communs par case, couleur du rouge (0 %) au bleu (100 %), gris sous le seuil ; une case ouvre la comparaison.

- `GET /api/matrix/selection?countries=FRA,USA,GBR,CHN,RUS,IND&from=2000&to=2025&minVotes=20&theme=all`

**4. Explorer les résolutions** (`/resolutions`, `/resolutions/:id`) : recherche par titre ou symbole, filtre par période, détail avec le vote de chaque pays et le lien vers la notice de l'ONU.

- `GET /api/resolutions?search=Ukraine&page=1&pageSize=20&from=1946&to=2025`
- `GET /api/resolutions/3959039`

**5. Groupes de pays** (`/groupes`, `/groupes/:id`) : créer, modifier, supprimer un groupe de 2 à 12 pays (formulaire réactif validé) ; concordance interne, évolution annuelle, résolutions qui divisent le groupe.

- Écritures (MirageJS) : `GET /mock-api/groups`, `POST /mock-api/groups`, `GET /mock-api/groups/:id`, `PUT /mock-api/groups/:id`, `DELETE /mock-api/groups/:id?expectedRevision=2`
- Calcul (API Node) : `GET /api/groups/analysis?members=FRA,IND,BRA,CAN&from=2000&to=2025&theme=all&minVotes=20`

**Fonctionnalités complémentaires**

- **Carte** (`/carte`, aussi sur l'accueil) : un pays de référence, les autres colorés selon leur concordance. `GET /api/countries/FRA/concordances?from=2000&to=2025&theme=all&minVotes=20` (25 Ko) et le fond `GET /maps/world.json`.
- **Simulation** d'un ajout ou d'un retrait de pays dans un groupe : `GET /api/groups/analysis` avec la composition proposée, sans rien enregistrer.
- **Suggestions** de pays à ajouter : `GET /api/groups/suggestions?members=…&from=…&to=…&theme=…&minVotes=…&includeHistorical=false`.
- **Rapports** figés et comparaison de deux rapports : `GET /mock-api/groups/:id/reports`, `POST /mock-api/groups/:id/reports`, `GET /mock-api/groups/:id/reports/:reportId`.
- **Révisions** : chaque groupe a un numéro de révision. Modifier, supprimer ou enregistrer un rapport depuis une version périmée renvoie **409**. Avant chaque calcul, l'application relit aussi la révision : un groupe modifié dans un autre onglet affiche un conflit, sans écraser le brouillon.
- Catalogues : `GET /api/metadata` (version et couverture, lu au démarrage), `GET /api/themes` (thèmes et effectifs), `GET /api/health`.

Thèmes : 11 regroupements définis par le projet à partir de la colonne `subjects` des CSV de l'ONU, plus « Sans thème attribué » (détail dans [data/README.md](data/README.md)).

## Concordance : formule et limites

```text
concordance = 100 × votes identiques / votes explicites communs
```

- Seuls les votes **Pour (Y)**, **Contre (N)** et **Abstention (A)** des deux pays comptent. Deux abstentions sont concordantes.
- **Non-vote (X)**, absence de ligne et valeur inconnue sont exclus du dénominateur.
- Zéro vote commun : le résultat est `null`, affiché par un tiret (jamais 0 %).
- Bornes de période incluses ; arrondi seulement à l'affichage.
- Matrice, carte, classement et groupes appliquent un **seuil** de votes communs (20 par défaut, 50 pour le classement) : sous le seuil, pas de taux.
- **Groupes** : concordance interne = 100 × somme des votes identiques des paires éligibles / somme de leurs votes communs. Elle est pondérée par les effectifs, ce n'est pas une moyenne des pourcentages.

Référence vérifiée par les tests : **France / Inde, 2000–2025 : 2 218 votes comparables, 1 005 identiques, soit 45,3 %** (14 votes non comparables).

Limites : c'est un outil descriptif. Un taux de concordance n'est ni une alliance ni une mesure des relations entre deux pays. Beaucoup de résolutions sont adoptées sans vote enregistré (5 730 sur 20 834 ont des votes individuels). Un résultat calculé sur moins de 20 votes est signalé comme fragile. Les États historiques restent distincts (URSS et Russie, par exemple). Les thèmes sont des regroupements du projet, pas une classification officielle de l'ONU.

## Sources et licence des données

**© Nations unies, Bibliothèque Dag Hammarskjöld** — jeux de données des votes et des résolutions de l'Assemblée générale : [notice 4060887](https://digitallibrary.un.org/record/4060887) (votes) et [notice 4060945](https://digitallibrary.un.org/record/4060945) (résolutions), **version 6 du 15 octobre 2026**, téléchargés le 26 octobre 2026. Jeu importé : **954 382 votes, 20 834 résolutions, 202 codes pays**, du 26 janvier 1946 au 17 septembre 2026.

Licence : **utilisation non commerciale avec attribution** ([FAQ officielle](https://ask.un.org/faq/432839)). Elle s'applique aux données, pas au code. Fond de carte : Natural Earth, domaine public (`public/maps/README.md`). Polices DM Sans et Instrument Serif : licence SIL OFL (`public/fonts/`).

Annexe détaillée (fichiers, empreintes, schéma, import, règles des thèmes) : [data/README.md](data/README.md). Réimport depuis les CSV : `npm run data:download` puis `npm run data:import`.
