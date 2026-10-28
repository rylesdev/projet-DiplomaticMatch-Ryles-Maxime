# Diplomatic Match — suivi du projet

État du projet au **28 octobre 2026**. Les cinq parcours principaux et leurs extensions sont réalisés ; ce fichier distingue leurs vérifications des validations universitaires à obtenir. Les fonctionnalités utilisent de véritables appels à l'API locale consommée par Angular.

## Cadrage et données

- [x] Initialiser une base Angular standalone vierge, TypeScript strict, SCSS et tests.
- [x] Examiner l'idée produit et les cinq parcours API proposés.
- [x] Télécharger les deux CSV officiels ONU et leurs dictionnaires, version 6 du 15 octobre 2026.
- [x] Vérifier les en-têtes réels, la clé `undl_id`, les quatre valeurs de vote et les codes historiques sans fusion.
- [x] Documenter les sources, les empreintes, la licence, la couverture et les limites dans `data/README.md`.
- [ ] Faire valider les **cinq fonctionnalités** par l'enseignant.
- [ ] Confirmer la convention finale du nom du dépôt avec le nom du projet et les prénoms.
- [ ] Donner accès au dépôt à l'enseignant ; organiser les échanges via merge requests.

## Réalisation technique vérifiée

- [x] Finaliser et vérifier le pipeline CSV → données compactes + manifeste traçable.
- [x] Finaliser une API locale démarrée avec Angular, sans dépendance réseau pour la démo.
- [x] F1 : recherche pays et ouverture de sa fiche (`/api/countries`, `/api/countries/:id`).
- [x] F2 : historique paginé d'un pays avec période (`/api/countries/:id/votes`).
- [x] F3 : comparaison de deux pays, effectifs et concordance (`/api/compare`).
- [x] F4 : évolution annuelle avec effectifs et années sans données (`/api/compare/trend`).
- [x] F5 : recherche paginée de résolutions et détail sourcé (`/api/resolutions`, `/api/resolutions/:id`).
- [x] Finaliser la navigation, l'accueil et l'écran Méthodologie / Sources.
- [x] Vérifier les états chargement, erreur, vide et succès sur chaque parcours.
- [x] Valider les calculs : `Y/N/A` explicites, absence exclue, deux abstentions concordantes, dénominateur nul → `null`, bornes de période inclusives.
- [x] Vérifier les paramètres API, les erreurs de saisie et la pagination.
- [x] Vérifier le clavier, les contrastes, le mobile et les alternatives au graphique.
- [x] Exécuter la compilation, les tests Angular et les tests métier/API.
- [x] Vérifier les cinq appels dans le panneau Réseau et répéter le parcours hors connexion aux serveurs ONU.
- [x] Mettre à jour le README avec les commandes finales et les parcours vérifiés.

## Extensions réalisées

- [x] Classement demandé : top 3 des taux de concordance les plus élevés et les plus faibles dans une fiche pays, avec période et minimum de votes, calculé par l'API. Vérifié par tests métier, HTTP et navigateur (ordinateur, mobile, clavier, erreur et période vide).
- [x] Filtrage thématique des comparaisons, tendances et classements à partir des sujets documentaires conservés, avec règles propres au projet documentées et états sans données.
- [x] Matrice des 202 pays en double entrée : bleu/rouge, effectifs sous le seuil en gris, lecture des cases, navigation clavier et ouverture des comparaisons détaillées.
- [x] Vérifier indépendamment les résultats écologie et sécurité, la symétrie de la matrice et la distinction entre 0 % et absence de données.

- [x] Ajouter un atelier de groupes de pays : création, modification et suppression via API, avec stockage SQLite local ignoré par Git.
- [x] Analyser la concordance interne pondérée, l'évolution et les résolutions qui divisent le groupe, avec seuil et couverture visibles.
- [x] Tester des ajouts/retraits sans mutation jusqu'à application explicite et proposer des candidats avec couverture temporelle documentée.
- [x] Enregistrer des rapports immuables et comparer deux versions uniquement à paramètres et versions compatibles.
- [x] Vérifier la persistance et les conflits de révision avec les tests serveur ; vérifier le CRUD et les scénarios dans un vrai navigateur.

## Améliorations proposées — à choisir

- [ ] Partager une comparaison : conserver les deux pays, les années et le regroupement du graphique dans l'URL, avec un bouton pour copier le lien.
- [ ] Parcourir tous les votes comparés : tableau paginé et filtres pour les votes identiques, différents ou non comparables, avec recherche de résolution.
- [ ] Filtrer les résolutions disposant de votes individuels : afficher leur disponibilité dans les résultats et ajouter un filtre API.

Ces propositions prolongent les fonctionnalités existantes. Elles ne sont pas encore implémentées et ne remplacent pas la validation des cinq parcours par l'enseignant.

## Parcours de démonstration proposé — 15 minutes maximum

Ce scénario est à répéter sur la version livrée. France / Inde et la période 2000–2025 ont été vérifiées directement dans le CSV v6 : **2 218 votes comparables**, dont **1 005 concordants**, soit environ **45,3 %** ; 14 autres paires de lignes sont non comparables. Ces nombres servent de référence de contrôle, sans interprétation d'alliance.

| Temps       | Action visible                                               | Fonction et vérification                                                    |
| ----------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 0:00–1:00   | Présenter le problème et la couverture historique            | Expliquer l'outil descriptif et la source datée                             |
| 1:00–2:00   | Rechercher « France » puis ouvrir la fiche                   | F1 : montrer recherche et fiche provenant de l'API                          |
| 2:00–3:00   | Choisir 2000–2025 et changer de page                         | F2 : nouveau GET avec période et pagination                                 |
| 3:00–7:00   | Comparer France / Inde puis modifier la période              | F3 : effectifs, concordance, exemples de votes ; nouveau GET                |
| 7:00–9:00   | Afficher l'évolution puis lire une année                     | F4 : pourcentage et nombre de votes annuels ; nouveau GET                   |
| 9:00–11:00  | Rechercher un symbole issu de la liste, ouvrir sa résolution | F5 : requête de recherche, détail et lien de provenance                     |
| 11:00–13:00 | Ouvrir la méthodologie                                       | Formule, abstentions, non-participation, historique, version et attribution |
| 13:00–15:00 | Répondre aux questions et garder une marge                   | Aucun passage par le code n'est nécessaire                                  |

Pour illustrer le changement de période, France / Inde sur **2020–2026** donne **682 votes comparables**, **357 concordants**, soit environ **52,3 %**, dans le CSV téléchargé. L'année 2026 s'arrête au 17 septembre : elle ne représente pas une année complète.

## Échéances et conditions externes

- [ ] Obtenir la validation pédagogique et l'accès enseignant ; aucune validation n'est présumée.
- [ ] Répéter une démonstration fonctionnelle de 15 minutes, application installée depuis le README.
- [ ] Effectuer le rendu **avant le 1er décembre 2026 à 23 h 59**.
- [ ] Préparer la démonstration du **2 décembre 2026**, sans présentation de code.

La fin du développement technique ne vaut ni validation par l'enseignant, ni rendu administratif. Aucune invitation, prise de contact ou modification du nom distant ne fait partie des actions automatiques de cette checklist.
