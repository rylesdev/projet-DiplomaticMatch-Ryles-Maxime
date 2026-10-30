# Données de Diplomatic Match

Les données de production proviennent des deux CSV de la Bibliothèque numérique des Nations unies, téléchargés le **26 octobre 2026**. Il s'agit de la **version 6 du 15 octobre 2026**, plus récente que la version 5 citée dans la première idée du projet.

## Sources et fichiers

| Jeu                  | Page officielle                                                | Fichier effectivement téléchargé | Taille             | Lignes annoncées et vérifiées |
| -------------------- | -------------------------------------------------------------- | -------------------------------- | ------------------ | ----------------------------- |
| Votes enregistrés    | [Notice 4060887](https://digitallibrary.un.org/record/4060887) | `2026_10_15_votes_ga.csv`        | 368 130 256 octets | 954 382 votes                 |
| Résolutions adoptées | [Notice 4060945](https://digitallibrary.un.org/record/4060945) | `2026_10_15_outcomes_ga.csv`     | 7 523 446 octets   | 20 834 résolutions            |

Liens directs utilisés : [votes CSV](https://digitallibrary.un.org/record/4060887/files/2026_10_15_votes_ga.csv?version=1), [résolutions CSV](https://digitallibrary.un.org/record/4060945/files/2026_10_15_outcomes_ga.csv?version=1), [dictionnaire des votes](https://digitallibrary.un.org/record/4060887/files/2026_10_15_votes_ga_1.md?version=1), [dictionnaire des résolutions](https://digitallibrary.un.org/record/4060945/files/2026_10_15_ga_outcomes.md?version=1).

Les dictionnaires sont conservés dans `source-docs/`. Les CSV bruts restent dans `raw/`, hors Git, et ne sont jamais intégrés au bundle Angular. L'API locale interroge les données préparées : le navigateur ne reçoit que les résultats nécessaires à chaque requête.

Empreintes SHA-256 des CSV téléchargés :

```text
2026_10_15_votes_ga.csv
8c2e1c6aaf427c685835e7fdf74833375ed711a28d1ee9e393163903e99e11a5

2026_10_15_outcomes_ga.csv
573a6b6b5f76e706de58da0188f585195dfa128510386ec75ace838051e1b02b
```

## Schéma vérifié et jointure

Les deux fichiers possèdent les colonnes `undl_id`, `resolution`, `date` et `undl_link`. La clé de liaison est **`undl_id`**, identifiant de la notice de vote ; elle n'est pas reconstruite depuis un titre. `resolution` conserve le symbole documentaire original et `undl_link` le lien de provenance. Exemple vérifié dans les deux CSV : `undl_id = 280722`, symbole `A/RES/41/60A`, date `1986-12-03`.

Dans le CSV de votes, `ms_code` identifie la série de pays définie par la source, `ms_name` conserve le nom officiel enregistré, et `ms_vote` fournit le vote brut. Une ligne représente le vote d'un pays pour une notice. L'audit des 954 382 lignes n'a trouvé aucun doublon de la paire `undl_id` + `ms_code`.

| Valeur brute            | Valeur interne                  | Nombre de lignes dans cette version |
| ----------------------- | ------------------------------- | ----------------------------------- |
| `Y`                     | `YES` — pour                    | 716 604                             |
| `N`                     | `NO` — contre                   | 47 096                              |
| `A`                     | `ABSTAIN` — abstention          | 101 386                             |
| `X`                     | `NOT_VOTED` — non-participation | 89 296                              |
| Autre valeur éventuelle | `UNKNOWN`                       | 0 observée lors de cet audit        |

`X` est explicitement défini comme non-votant dans le dictionnaire v6. Une abstention n'est donc jamais assimilée à une absence. La comparaison porte uniquement sur des paires de votes `Y`, `N` ou `A` ; les autres paires sont exclues du dénominateur. Deux abstentions concordent selon la définition retenue dans le projet. Sans vote comparable, le pourcentage vaut `null`.

Le CSV des résolutions contient également `modality` : les résolutions adoptées sans vote ou sans vote individuel enregistré peuvent être consultées, mais ne créent pas de faux votes pays.

## Couverture et limites historiques

Les dates réellement observées dans le CSV de votes vont du **26 janvier 1946 au 17 septembre 2026**. Le titre du dictionnaire officiel indique un début au 11 décembre 1946 ; nous conservons les dates du CSV et signalons cette différence plutôt que les réécrire. L'API expose cette couverture effective et la version du jeu (`GET /api/metadata`).

La source contient **202 codes de séries de pays**, incluant des États historiques. Ce total n'est pas un décompte des membres actuels de l'ONU. Les codes sont conservés sans fusion : `SUN`/`RUS`, `DDR`/`GER`/`DEU`, `CSK`/`CZE`, `YUG`/`SCG`/`SRB` et `YMD`/`YEM` restent distincts. Un code source ne doit pas être présenté automatiquement comme un code ISO actuel.

Un même code peut aussi avoir plusieurs libellés historiques, parfois avec des périodes qui se chevauchent dans la source : par exemple `CZE` a les noms « CZECH REPUBLIC » et « CZECHIA ». Les noms bruts restent la référence ; cette application n'établit pas d'équivalence géopolitique supplémentaire. Les périodes disponibles diffèrent selon les pays.

Ce jeu ne décrit pas toutes les activités de l'Assemblée générale, ni les votes sur chaque paragraphe ou tous les projets rejetés. Une concordance de votes ne prouve ni alliance, ni amitié, ni causalité diplomatique. Voir la [documentation officielle des votes](https://research.un.org/en/docs/unvoting/undl).

## Attribution et conditions d'utilisation

**© Nations unies — utilisation non commerciale avec attribution.** Les données sont attribuées à la Bibliothèque Dag Hammarskjöld des Nations unies. Leur licence ne devient pas celle du code de l'application. Voir la [FAQ officielle sur les jeux de données](https://ask.un.org/faq/432839) et les conditions liées dans les dictionnaires conservés.

Citation : Nations unies, Bibliothèque Dag Hammarskjöld, jeux de données des votes et résolutions de l'Assemblée générale, version 6 du 15 octobre 2026, téléchargés le 26 octobre 2026, notices 4060887 et 4060945.

## Reproduction de l'import

Depuis la racine du dépôt, les scripts du projet téléchargent les deux CSV et les deux dictionnaires, puis importent les données locales :

```bash
npm run data:download
npm run data:import
```

L'import produit `data/dataset.json`, `data/source-manifest.json` et `data/import-report.json`. Le manifeste décrit la source, la couverture et les contrôles effectués ; les données prêtes à l'emploi évitent un téléchargement pendant la démonstration.

En alternative, télécharger manuellement les CSV dans `data/raw/` avec les noms exacts suivants, puis exécuter l'import. Les empreintes permettent de vérifier que les mêmes fichiers sont utilisés.

```powershell
New-Item -ItemType Directory -Path data/raw -Force
curl.exe --fail --location --output data/raw/2026_10_15_votes_ga.csv "https://digitallibrary.un.org/record/4060887/files/2026_10_15_votes_ga.csv?version=1"
curl.exe --fail --location --output data/raw/2026_10_15_outcomes_ga.csv "https://digitallibrary.un.org/record/4060945/files/2026_10_15_outcomes_ga.csv?version=1"
npm run data:import
```

L'import contrôle les colonnes et la liaison des notices. Ne pas remplacer une erreur de téléchargement par des votes inventés. Les fixtures synthétiques des tests restent séparées des données affichées.

## Regroupements thématiques du projet

Les filtres « Écologie et environnement », « Sécurité et paix », « Droits », « Développement », « Décolonisation », « Institutions », « Moyen-Orient et question palestinienne », « Droit international et justice », « Espace, Antarctique et sciences », « Situations de pays et conflits » et « Économie, commerce et finances » sont **des regroupements définis pour Diplomatic Match**, pas une taxonomie officielle publiée par l'ONU. Ils sont fondés uniquement sur la colonne documentaire `subjects` du CSV des résolutions. Aucun thème n'est déduit du titre, d'un pays cité ou d'une interprétation politique.

L'audit du 27 octobre 2026 a porté sur les **20 834 résolutions** : **14 117** ont un champ `subjects` renseigné, **6 717** n'en ont pas. Le séparateur réellement observé est **`|`**, présent dans 1 332 champs ; ni le point-virgule ni le retour à la ligne ne servent de séparateur. Les **15 515 libellés** ainsi extraits sont conservés comme tableau `subjects` de chaque résolution, dans leur ordre et leur graphie source. Les subdivisions `--` restent à l'intérieur d'un libellé. La casse et les espaces externes ne sont ignorés que pour appliquer les règles, sans modifier la valeur conservée.

Les expressions exactes figurent dans [`server/themes.mjs`](../server/themes.mjs). Leur version est **`diplomatic-match-subject-rules-v2`** : la v2 ajoute cinq thèmes sans modifier les six règles de la v1. `source-manifest.json` (`themeClassification.rules`) et `import-report.json` décrivent encore la v1, appliquée lors de l'import ; l'API recalcule les thèmes v2 au démarrage à partir des `subjects` conservés, sans réimport. Une résolution peut relever de plusieurs thèmes : par exemple `ENVIRONMENT--SUSTAINABLE DEVELOPMENT` relève de l'environnement et du développement. Elle n'est comptée qu'une fois dans chaque thème.

| Identifiant      | Principaux motifs documentaires reconnus                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment`    | `ENVIRONMENT`, `CLIMATE`, `BIOLOGICAL DIVERSITY`, désertification, pollution, ozone, forêts, écosystèmes et ressources marines, conservation de la nature                       |
| `security`       | `DISARMAMENT`, armes, conflits armés, terrorisme, paix, maintien/consolidation de la paix, sécurité internationale/régionale/collective, non-prolifération et essais nucléaires |
| `rights`         | `HUMAN RIGHTS`, droits explicitement nommés, discrimination, racisme, apartheid, torture, génocide, droits/avancement des femmes, réfugiés et protection des personnes          |
| `development`    | `DEVELOPMENT`, pays en développement, pauvreté, santé, éducation, établissements humains, coopération et assistance économique/sociale, commerce, alimentation                  |
| `decolonization` | Décolonisation, pays coloniaux, territoires non autonomes ou sous tutelle, autodétermination et mouvements de libération                                                        |
| `institutions`   | Sujet commençant par `UN`, organes/programmes ONU explicitement identifiés, budget, personnel et services de conférence ; un simple qualificatif `--UN...` ne suffit pas        |
| `middle-east`    | `PALESTINE QUESTION`, Palestiniens, `MIDDLE EAST` (dont `MIDDLE EAST SITUATION`), `TERRITORIES OCCUPIED BY ISRAEL`, Golan syrien, Jérusalem, Israël, `UNRWA`                    |
| `law`            | Droit de la mer, droit international, Cour pénale internationale, tribunaux internationaux, CIJ, règlement des différends, traités, prévention du crime et justice pénale       |
| `science`        | `OUTER SPACE`, `ANTARCTICA`, science et technologie, télécommunications, rayonnements ionisants                                                                                 |
| `conflicts`      | Sujets nommés « … SITUATION » (sauf Moyen-Orient), `CUBA`, `UKRAINE`, `IRAQ`, `NICARAGUA`, `AFGHANISTAN`, `NAMIBIA QUESTION`, `WESTERN SAHARA`, Malouines…                      |
| `economy`        | Mondialisation, dette extérieure, nouvel ordre économique international, produits de base, sanctions et mesures économiques unilatérales, commerce, questions financières       |
| `unclassified`   | Sujets absents ou aucun motif reconnu ; ce n'est pas une absence de vote                                                                                                        |
| `all`            | Filtre virtuel sans restriction, jamais un thème attribué à une résolution                                                                                                      |

Quelques exclusions préviennent les rapprochements abusifs : `NUCLEAR ENERGY` seul ne signifie pas armement nucléaire ; `FOOD SECURITY` relève du développement, pas de la sécurité militaire ; `SUSTAINABLE DEVELOPMENT` seul ne devient pas automatiquement un sujet écologique. Les thèmes `middle-east`, `science` et `conflicts` ne reposent que sur des libellés de l'ONU qui nomment explicitement la région ou la situation (`PALESTINE QUESTION`, `ANTARCTICA`, `AFGHANISTAN SITUATION`…), jamais sur le titre ou les pays votants. Un sujet non reconnu reste consultable avec « Tous les sujets » et « Sans thème attribué ».

### Exemples vérifiés dans le fichier source

| Notice `undl_id` | Libellé exact observé                                                            | Regroupement obtenu          |
| ---------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| 281124           | `ENVIRONMENT`                                                                    | environnement                |
| 282760           | `CLIMATE`                                                                        | environnement                |
| 281221           | `DESERTIFICATION`                                                                | environnement                |
| 283753           | `ENVIRONMENT--SUSTAINABLE DEVELOPMENT`                                           | environnement, développement |
| 280722           | `DISARMAMENT--UN. GENERAL ASSEMBLY (12TH SPECIAL SESS. : 1982)--RECOMMENDATIONS` | sécurité                     |
| 280857           | `DISARMAMENT--GENERAL AND COMPLETE`                                              | sécurité                     |
| 281148           | `NON-NUCLEAR-WEAPON STATES`                                                      | sécurité                     |
| 280730           | `TERRITORIES OCCUPIED BY ISRAEL--HUMAN RIGHTS--REPORTS`                          | droits, Moyen-Orient         |
| 280785           | `HUMAN RIGHTS ADVANCEMENT--UN SYSTEM`                                            | droits                       |
| 285182           | `WOMEN'S ADVANCEMENT--CONFERENCES (4TH : 1995 : BEIJING)`                        | droits                       |
| 405445           | `RIGHTS OF THE CHILD`                                                            | droits                       |
| 285181           | `WOMEN IN DEVELOPMENT`                                                           | développement                |
| 280947           | `INTERNATIONAL TRADE`                                                            | développement, économie      |
| 455672           | `POVERTY--INTERNATIONAL DECADES`                                                 | développement                |
| 280834           | `DECOLONIZATION`                                                                 | décolonisation               |
| 281755           | `NON-SELF-GOVERNING TERRITORIES--REPORTS`                                        | décolonisation               |
| 278854           | `COLONIAL COUNTRIES--INDEPENDENCE--FOREIGN INTERESTS`                            | décolonisation               |
| 280748           | `NATIONAL LIBERATION MOVEMENTS--OBSERVER STATUS`                                 | décolonisation               |
| 280819           | `UN--BUDGET (1986-1987)`                                                         | institutions                 |
| 280790           | `UN. ECONOMIC AND SOCIAL COUNCIL--REPORTS`                                       | institutions                 |
| 280874           | `UNRWA`                                                                          | institutions, Moyen-Orient   |
| 280797           | `MIDDLE EAST SITUATION`                                                          | Moyen-Orient                 |
| 280765           | `ANTARCTICA`                                                                     | espace et sciences           |
| 280897           | `AGEING PERSONS`                                                                 | sans thème attribué          |

### Couverture des regroupements (règles v2)

| Filtre                                  | Résolutions | Résolutions possédant des votes individuels | Lignes de vote, non-votes inclus |
| --------------------------------------- | ----------: | ------------------------------------------: | -------------------------------: |
| Tous les sujets                         |      20 834 |                                       5 730 |                          954 382 |
| Écologie et environnement               |         272 |                                          21 |                            3 840 |
| Sécurité et paix                        |       2 779 |                                       1 193 |                          216 106 |
| Droits et protection des personnes      |       2 133 |                                         863 |                          158 351 |
| Développement et conditions de vie      |       1 749 |                                         244 |                           45 321 |
| Décolonisation et autodétermination     |       1 010 |                                         347 |                           63 673 |
| Institutions et fonctionnement de l'ONU |       3 336 |                                         518 |                           92 155 |
| Moyen-Orient et question palestinienne  |         922 |                                         829 |                          150 735 |
| Droit international et justice          |         912 |                                         248 |                           46 370 |
| Espace, Antarctique et sciences         |         276 |                                         128 |                           23 084 |
| Situations de pays et conflits          |         239 |                                         117 |                           20 319 |
| Économie, commerce et finances          |         456 |                                         112 |                           20 369 |
| Sans thème attribué                     |       8 823 |                                       1 993 |                          275 427 |

Les deux premières colonnes sont calculées par l'API au démarrage et renvoyées par `GET /api/themes` ; la troisième compte les lignes de vote du jeu rattachées à chaque thème. Les lignes ne s'additionnent pas : les thèmes peuvent se recouper. Les 8 823 résolutions sans thème attribué comprennent les 6 717 champs absents et 2 106 résolutions dont les libellés ne correspondent pas aux règles. Chaque thème ajouté en v2 regroupe plus de 100 résolutions avec votes individuels ; des regroupements trop rares (humanitaire et catastrophes : 24 résolutions votées) n'ont pas été créés. L'absence de champ ne doit pas être comblée par une classification inventée.

**Limite particulière de l'écologie :** parmi les 272 résolutions reconnues, seules 21 disposent de votes individuels dans cette copie historique. Beaucoup d'autres textes ont été adoptés sans vote enregistré. Une période courte ou un seuil minimal élevé peut donc ne laisser aucune paire comparable. Le classement ou la matrice affiche alors un état vide ou une case sans résultat, sans transformer l'absence de données en `0 %`. Un résultat inférieur à 20 votes comparables garde l'avertissement d'effectif limité.

Le réimport préserve les **954 382 votes, 20 834 résolutions et 202 codes**, avec zéro rejet, et les empreintes SHA-256 des deux CSV bruts restent identiques. Le manifeste et le rapport d'import contiennent les effectifs des six thèmes de la v1, appliquée lors de l'import ; les effectifs des onze thèmes de la v2 sont ceux de `GET /api/themes`.
