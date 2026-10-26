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

Les dates réellement observées dans le CSV de votes vont du **26 janvier 1946 au 17 septembre 2026**. Le titre du dictionnaire officiel indique un début au 11 décembre 1946 ; nous conservons les dates du CSV et signalons cette différence plutôt que les réécrire. L'API doit afficher sa couverture effective et la version du jeu.

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
