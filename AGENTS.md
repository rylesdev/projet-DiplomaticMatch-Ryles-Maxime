# AGENTS.md — Diplomatic Match

> Instructions de travail pour tout agent IA contribuant à ce dépôt.
> Projet universitaire Angular — application de comparaison **des votes enregistrés à l'Assemblée générale des Nations unies**.

## 1. Mission et résultat attendu

Construire une V1 fonctionnelle, lisible et soignée de **Diplomatic Match**, une application web qui permet de consulter l'historique des votes enregistrés à l'Assemblée générale de l'ONU et de comparer **des comportements de vote** entre deux États.

**Promesse produit :** « Explorer et comparer les votes des pays à l'ONU, dans le temps, en accédant aux résolutions sous-jacentes. »

Le produit est un outil **descriptif et pédagogique**, pas un indice officiel de relations diplomatiques ni une mesure de l'« amitié », de la moralité ou de la qualité d'un pays.

**Priorités, dans l'ordre :**
1. Respect des consignes du professeur et fonctionnement réel des appels API.
2. Exactitude et traçabilité des données et des calculs.
3. Parcours de démonstration fluide et fiable.
4. Code Angular simple, propre, testable.
5. Esthétique, animations et fonctions secondaires.

Ne jamais sacrifier une fonctionnalité obligatoire pour du polish visuel.

## 2. Contraintes universitaires non négociables

Source : `Projet.pdf` fourni par l'enseignant.

- **Angular obligatoire**, avec consommation d'une API.
- Travail **individuel ou en binôme**.
- Au moins **5 fonctionnalités distinctes**, **à faire valider par l'enseignant**.
- **Chaque fonctionnalité doit impérativement provoquer un appel API**. Un simple filtrage local sans requête HTTP ne suffit pas à démontrer cette exigence.
- API distante, backend développé par les étudiants ou API simulée à partir de JSON : les trois options sont admises. MirageJS est une suggestion de l'enseignant.
- Design libre ; Bootstrap ou Angular Material possibles ; **interdiction d'utiliser un template de site tout fait**.
- Projet **à rendre le 1er décembre 2026 avant 23 h 59**.
- **Démonstration le 2 décembre 2026**, durée **15 minutes maximum** ; elle doit montrer l'application fonctionnelle, **sans présentation de code**, avec possibilité de questions à tout moment.
- Notation : projet Angular **coefficient 2**, démonstration **coefficient 1**.
- Donner au professeur accès au dépôt Git et pouvoir échanger via merge requests.
- Nommer le dépôt et le projet suivant la convention de l'enseignant : `projet-nomduprojet-prénom1-prénom2` (adapter au cas d'une personne seule et confirmer si besoin).
- Tenir une liste de tâches et garder une version démontrable sur la branche principale.

## 3. Périmètre V1 : cinq fonctionnalités API obligatoires

Implémenter ces fonctionnalités **en priorité**, avec des données historiques réellement disponibles. Les chemins d'API ci-dessous sont **le contrat de notre propre API d'application**, et **non des endpoints promis par l'ONU**.

| ID | Fonctionnalité visible | Action utilisateur | Requête API à démontrer |
| --- | --- | --- | --- |
| F1 | Recherche et sélection d'un État | Rechercher « France » puis ouvrir sa fiche | `GET /api/countries?search=fra`, puis `GET /api/countries/FRA` |
| F2 | Historique des votes d'un État | Choisir une période et parcourir les votes | `GET /api/countries/FRA/votes?from=2000&to=2025&page=1&pageSize=20` |
| F3 | Comparaison de deux États | Choisir France et Inde, comparer leurs votes communs | `GET /api/compare?countryA=FRA&countryB=IND&from=2000&to=2025` |
| F4 | Évolution chronologique de la concordance | Modifier la période / granularité du graphique | `GET /api/compare/trend?countryA=FRA&countryB=IND&from=2000&to=2025&interval=year` |
| F5 | Recherche et consultation de résolutions | Rechercher une résolution puis ouvrir ses détails | `GET /api/resolutions?search=...&page=1`, puis `GET /api/resolutions/:id` |

**Critères d'acceptation par fonctionnalité :**
- Elle fonctionne à la souris **et au clavier**.
- Une action claire déclenche un appel HTTP via un service Angular.
- Des états **chargement / vide / erreur / succès** sont visibles.
- La réponse est typée en TypeScript, validée ou normalisée à la frontière de l'API.
- Aucun tableau ou graphique ne présente des nombres fictifs comme de vrais résultats.
- Un cas d'usage est prêt à être montré en démo en moins de 2 minutes.

Les filtres effectuent de nouveaux appels HTTP avec des paramètres ; éviter de télécharger toute la base pour trier uniquement côté navigateur.

### Hors périmètre V1

Pas de compte utilisateur, réseau social, chat, IA générative, actualités temps réel, cartes de frontières historiques, prédictions diplomatiques ni comparaison des pays à partir de critères autres que les votes ONU. Ajouter uniquement après validation et stabilisation des cinq fonctionnalités.

## 4. Données, sources, licences et limites

### Sources primaires

1. **Bibliothèque numérique de l'ONU — votes enregistrés de l'Assemblée générale** : https://digitallibrary.un.org/record/4060887
2. **Bibliothèque numérique de l'ONU — métadonnées des résolutions** : https://digitallibrary.un.org/record/4060945
3. **Documentation de la bibliothèque de l'ONU** : https://research.un.org/en/docs/unvoting/undl
4. **FAQ ONU sur les jeux de données et droits d'utilisation** : https://ask.un.org/faq/432839

Le jeu de votes officiel téléchargé et vérifié le **26 octobre 2026** est la **version 6 publiée le 15 octobre 2026**. Le CSV contient **954 382 lignes de vote**, avec une couverture effectivement observée **du 26 janvier 1946 au 17 septembre 2026**. Le titre des métadonnées annonce un début au 11 décembre 1946 : cette divergence est documentée dans `data/README.md`, sans modification des dates source. Le jeu peut être mis à jour : toujours afficher la **date effective du jeu téléchargé** plutôt que « en temps réel ».

**Licence :** les pages officielles indiquent © Nations unies, utilisation **non commerciale avec attribution**. Citer les Nations unies, fournir un lien vers le jeu d'origine et ne pas revendiquer une licence plus permissive pour les données elles-mêmes. Vérifier les conditions si le projet doit devenir commercial ou public au-delà d'un usage pédagogique.

### Ce que le jeu mesure — et ne mesure pas

- Il contient des votes individuels d'États sur des **résolutions adoptées ayant fait l'objet d'un vote enregistré**.
- Il ne couvre **pas la majorité des résolutions adoptées sans vote**, ni tous les projets rejetés ni nécessairement les votes sur les paragraphes individuels.
- Un vote de l'Assemblée générale ne permet **pas**, à lui seul, de conclure à une alliance ou à une relation bilatérale.
- Les États n'ont pas tous été membres de l'ONU sur toute la période ; les noms, frontières et codes des pays évoluent dans le temps.
- **Ne pas confondre** `Y` (pour), `N` (contre), `A` (abstention) et **absence de vote / non-participation / donnée manquante**. La documentation précise qu'un pays sans marque n'a pas voté.
- Les catégories thématiques ne sont pas nécessairement présentes ni normalisées : ne pas inventer une classification officielle. Si un filtre « thème » est ajouté, documenter sa provenance et sa méthode.

### Pipeline d'ingestion reproductible

1. Télécharger manuellement ou via un script documenté les deux fichiers CSV officiels (votes + résolutions) et leurs fichiers de métadonnées/codebook.
2. **Inspecter les en-têtes réels** avant d'écrire le parseur ; ne jamais supposer les noms de colonnes.
3. Sauvegarder la source, sa version, son URL et sa date de téléchargement dans un manifeste (`data/source-manifest.json`, par exemple).
4. Normaliser les pays avec des identifiants stables **si la source permet une correspondance fiable** ; documenter les exceptions historiques. Ne pas fusionner des États différents sous un même code actuel.
5. Normaliser les votes dans un type explicite (`YES`, `NO`, `ABSTAIN`, `NOT_VOTED`, `UNKNOWN`) ; garder la valeur brute pour audit. Ne pas assimiler automatiquement valeur absente et abstention.
6. Relier les lignes de votes aux résolutions par **clé vérifiée dans les métadonnées** ; ne pas déduire l'identifiant à partir d'un libellé approché.
7. Préparer des jeux JSON/index compacts (ou SQLite pour un petit backend) ; ne pas charger les ~947 000 lignes brutes dans le navigateur à chaque ouverture.
8. Prévoir les colonnes manquantes et les données incohérentes ; journaliser les rejets plutôt que corriger silencieusement.
9. Conserver au moins un petit jeu d'essai documenté pour les tests et les démos hors ligne.

Les transformations doivent pouvoir être rejouées. Ne jamais fabriquer des votes pour combler les trous.

## 5. Méthode de comparaison — contrat mathématique

Utiliser le nom **« taux de concordance des votes enregistrés »**, plutôt que « score d'amitié », « niveau d'alliance » ou « compatibilité diplomatique ».

Pour deux États \(A\) et \(B\), sur une période filtrée, on ne retient que les résolutions pour lesquelles **les deux États disposent d'un vote explicite** parmi `YES`, `NO`, `ABSTAIN`.

\[
\text{Concordance}(A,B) =
100 \times \frac{\#\{r : v_A(r)=v_B(r),\;v_A(r),v_B(r)\in\{Y,N,A\}\}}{\#\{r : v_A(r),v_B(r)\in\{Y,N,A\}\}}
\]

- `ABSTAIN` = `ABSTAIN` compte comme vote concordant dans **cette définition**, et une note méthodologique doit l'indiquer.
- Les absences et valeurs inconnues sont **exclues du dénominateur** ; elles ne sont ni un accord ni un désaccord.
- Si le nombre de votes communs est **0**, renvoyer `null` (jamais `0 %` ni `100 %`).
- Toujours afficher le **nombre de votes communs comparés** et les dates de couverture.
- Pour les faibles effectifs (seuil indicatif < 20), afficher « interprétation limitée : peu de votes comparables » sans inventer de résultat plus solide.
- Arrondir **uniquement pour l'affichage**, pas au cours des calculs.
- Le graphique annuel réutilise **exactement la même formule** par année ; afficher les effectifs annuels et gérer les années sans données.
- En supplément utile : montrer le décompte « mêmes votes / votes différents / non comparables », en explicitant que les non-comparables sont exclus du pourcentage.

**Tests impératifs** : deux votes identiques, deux votes différents, abstention/abstention, abstention/absence, absence/absence, aucune intersection temporelle, premier et dernier vote de la période, dénominateur nul, changement de période.

## 6. Choix techniques

- **Frontend : Angular** récent et stable installé dans le projet, **TypeScript strict**, composants standalone et Angular Router si compatibles avec la version retenue.
- `HttpClient` pour les appels API ; services Angular séparés de l'interface ; modèles TS typés.
- Formulaires réactifs pour les recherches/filtres ; RxJS adapté à l'annulation (`switchMap`), debounce des recherches et prévention des requêtes obsolètes.
- Visualisation : une librairie de graphiques légère, après vérification de sa compatibilité avec la version d'Angular ; éviter d'ajouter plusieurs bibliothèques concurrentes.
- CSS/SCSS maison, responsive, sans template préconstruit ; Angular Material ou Bootstrap sont autorisés si utiles.
- **Option de départ conseillée :** une API simulée avec MirageJS interceptant de vraies requêtes HTTP de l'application et s'appuyant sur des JSON **prétraités et limités**. **Ne pas importer tout le CSV brut** dans le bundle Angular.
- Si le volume des données rend MirageJS trop lourd, passer à une **petite API locale** (par exemple Node + SQLite) avec les mêmes routes, sans transformer le projet en gros chantier backend.
- Le frontend doit dépendre d'une **interface API stable** : changer MirageJS pour une API Node ne doit pas exiger de réécrire les pages.
- La démo ne doit dépendre ni d'un proxy CORS public ni du fait qu'un site externe soit accessible à cet instant.

### Contrats de réponses indicatifs

```ts
type VoteChoice = 'YES' | 'NO' | 'ABSTAIN' | 'NOT_VOTED' | 'UNKNOWN';

interface Country {
  id: string;          // Identifiant choisi et documenté
  name: string;
  iso3?: string;       // Seulement si correspondance historiquement fiable
}

interface Resolution {
  id: string;          // Clé stable issue de la source ou de la normalisation
  symbol?: string;     // Ex. A/RES/79/10 lorsque fourni
  title: string;
  date: string;        // ISO YYYY-MM-DD si date connue
  sourceUrl: string;
}

interface Vote {
  countryId: string;
  resolutionId: string;
  choice: VoteChoice;
  rawChoice?: string;
}

interface ComparisonResult {
  countryA: Country;
  countryB: Country;
  from: number;
  to: number;
  commonVoteCount: number;
  matchingVoteCount: number;
  differingVoteCount: number;
  agreementPercent: number | null;
  dataVersion: string;
}
```

Ces interfaces décrivent **notre modèle interne**. Ne pas les confondre avec le schéma exact des fichiers CSV de l'ONU.

## 7. Organisation cible du code

Adapter cette proposition à la structure réellement initialisée ; ne pas écraser un projet existant pour la reproduire à l'identique.

```text
src/app/
  core/
    models/                 # Types métier et DTO API
    services/               # CountriesService, VotesService, ResolutionsService
    api/                    # Mapping DTO, gestion d'erreurs
  features/
    countries/              # Recherche et fiche pays
    votes/                  # Historique des votes
    compare/                # Concordance et tendance
    resolutions/            # Recherche et détail des résolutions
  shared/
    components/             # Sélecteurs, états vides, chart cards, etc.
  app.routes.ts
src/assets/data/            # Échantillons / JSON optimisés (pas la base brute)
scripts/                    # Import, nettoyage, agrégation documentés
data/                       # Manifeste et documentation des sources
README.md                   # Installation, démarrage, méthodes, démo
AGENTS.md                   # Présent fichier
```

Découper en petits composants aux responsabilités nettes ; éviter les composants géants et les calculs dupliqués dans les templates. Centraliser les règles de calcul dans des fonctions testables.

## 8. UX et direction artistique

Viser une interface **« atlas diplomatique / archives contemporaines »** : typographie lisible, grandes données comparées, touches cartographiques discrètes, visuels sobres. Un mode sombre soigné est possible, mais la lisibilité prime.

Écrans cibles :
1. **Accueil** : pitch en une phrase, sélection rapide de deux pays.
2. **Pays** : recherche, fiche synthétique et historique des votes.
3. **Comparer** : deux sélecteurs de pays, période, concordance, votes comparables, exemples de divergences.
4. **Évolution** : graphique par année et nombre de votes sous-jacents.
5. **Résolutions** : moteur de recherche, liste paginée, détail sourcé avec votes.
6. **Méthodologie / Sources** : formule, limites, période, licence et version des données.

Accessibilité : labels explicites, contraste suffisant, navigation clavier, tableaux lisibles sans graphique, textes d'alternative aux couleurs et graphiques, états focus visibles, affichage mobile correct. Pas de couleurs rouge/vert comme seul indicateur d'accord/désaccord.

## 9. Qualité, sécurité et rigueur

**Pour tout code proposé ou modifié par un agent :**

- Lire d'abord les fichiers existants, le `package.json`, la structure Angular et les scripts disponibles.
- Éviter les dépendances inutiles ; utiliser les commandes déjà définies dans le dépôt.
- Ne jamais créer de fausse URL d'API ONU ou supposer que l'ONU expose les routes `/api/...` décrites ici.
- Éviter les secrets et jetons dans Git ; fournir un `.env.example` si nécessaire.
- N'utiliser que des données de source vérifiée ; séparer les **fixtures de test** des vraies données, les identifier visiblement.
- Afficher la **source, la période et la date de mise à jour** sur les résultats.
- Ne jamais produire d'interprétation partisane ou de causalité géopolitique non démontrée.
- Échapper les textes externes, ne pas injecter de HTML non fiable, valider les paramètres et la pagination côté API.
- Tester unités de calcul, mapping des votes, composants et services API ; suivre le runner existant dans le projet.
- Vérifier les commandes de build et de test avant de déclarer une tâche terminée ; signaler clairement ce qui n'a pas pu être exécuté.
- En cas de doute sur un code pays historique, un vote ou une relation entre jeux de données, **rendre l'incertitude visible** au lieu de deviner.

## 10. Plan de réalisation

### Phase A — Cadrage et données
- [ ] Présenter **les cinq fonctionnalités API** au professeur pour validation.
- [ ] Créer le dépôt Git au bon nom et y inviter le professeur.
- [ ] Vérifier et télécharger la version du dataset ONU et son dictionnaire de données.
- [ ] Écrire l'import CSV → données internes et trois ou quatre tests de conversion.
- [ ] Vérifier les clés de jointure votes ↔ résolutions, codes pays et champs de dates.

### Phase B — V1 fonctionnelle
- [ ] Créer le projet Angular et la navigation.
- [ ] Définir les contrats de l'API et un serveur mock / backend.
- [ ] Livrer F1 et F2 de bout en bout.
- [ ] Livrer F3 et tester les calculs.
- [ ] Livrer F4 avec gestion des années sans votes.
- [ ] Livrer F5 avec recherche paginée et liens vers les sources.

### Phase C — Stabilisation
- [ ] Ajouter états de chargement, messages d'erreur et cas sans données.
- [ ] Tester les parcours mobile et clavier.
- [ ] Ajouter README, méthodologie et attribution des Nations unies.
- [ ] Vérifier les **cinq appels API** dans l'onglet Réseau du navigateur.
- [ ] Faire un essai complet de la démo **sans connexion aux serveurs externes**.
- [ ] Vérifier build/tests et déposer le projet **avant le 01/12/2026 à 23 h 59**.

### Phase D — Démo du 02/12/2026 (15 min maximum)
- **1 min** : contexte startup et problème résolu.
- **2 min** : recherche d'un pays et historique (F1–F2).
- **4 min** : comparer deux pays sur une période (F3).
- **2 min** : examiner la courbe d'évolution (F4).
- **2 min** : rechercher une résolution et consulter ses détails (F5).
- **2 min** : explication courte des sources, de la méthode et des limites.
- **2 min de marge** : questions et imprévus.

Préparer un parcours précis, avec pays et périodes choisis **après vérification qu'il existe des données comparables**. La démo doit fonctionner sur la version livrée et ne nécessite **aucune vue sur le code**.

## 11. Règles de collaboration pour les agents IA

1. **Avant de coder**, résumer brièvement les fichiers concernés, l'objectif et les effets attendus.
2. Travailler par **petites modifications cohérentes** plutôt que reconstruire le projet entier.
3. Pour chaque fonctionnalité, relier explicitement : **action UI → service Angular → requête API → réponse → rendu**.
4. Ajouter les tests associés aux règles métier ; vérifier prioritairement la formule de concordance.
5. Ne pas changer les cinq fonctionnalités obligatoires ou les choix de données sans expliciter l'impact et demander validation si cela change le périmètre.
6. À la fin d'une tâche, préciser **les fichiers modifiés, les commandes exécutées, le résultat des tests et les étapes restantes**.
7. En l'absence d'une donnée ou d'un endpoint, utiliser une fixture **explicitement étiquetée comme fictive pour le développement**, sans la montrer comme donnée ONU lors de la démo.
8. Privilégier le code compréhensible par un étudiant Angular ; commenter les **choix métier** plutôt que chaque ligne de code.

## 12. Définition de « terminé »

Une V1 peut être annoncée prête **uniquement si** :

- [ ] L'enseignant a validé les cinq fonctionnalités.
- [ ] Les cinq parcours fonctionnent réellement et chacun réalise un appel API.
- [ ] Les données affichées sont vérifiables et attribuées.
- [ ] Les calculs de comparaison sont justes, testés et expliqués.
- [ ] Aucune absence de vote n'est prise pour une abstention.
- [ ] Les écrans principaux gèrent erreur, chargement et absence de données.
- [ ] Le projet peut être installé et lancé à partir du README.
- [ ] Une démo fonctionnelle de 15 minutes a été répétée.
- [ ] Le dépôt est accessible au professeur et le rendu a été effectué dans les délais.

---

**Rappel permanent :** faire une petite application exacte et convaincante, pas une grande application fragile. La règle « 5 fonctionnalités, chacune avec un appel API » prime sur toute autre idée.
