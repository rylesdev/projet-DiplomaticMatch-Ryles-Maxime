# Commerce et diplomatie

Le module `/commerce` compare les échanges de marchandises et les votes de la même année.
Il réutilise les pays et les thèmes de l’application. Le thème et le minimum de votes communs
agissent uniquement sur les votes. Aucun score global ni relation causale n’est calculé.

## Source et périmètre

Source : **Fonds monétaire international, International Trade in Goods by partner country
(IMTS, anciennement DOTS)**, [page du jeu](https://data.imf.org/Datasets/IMTS).
[Conditions applicables aux données statistiques](https://www.imf.org/en/About/copyright-and-terms).
Cette extraction, les calculs et les graphiques sont propres à Diplomatic Match, sans affiliation au FMI.

La copie locale est disponible sans téléchargement au démarrage :

- `trade-dataset.json` : 524 840 observations directionnelles, 190 pays, 2000–2024 ;
- `trade-manifest.json` : date, requête exacte, SHA-256, exclusions, statuts et taille ;
- `source-docs/imf-trade-derivation-types.json` : codes source de dérivation et provenance.

L’extraction officielle complète comprend 792 827 observations. Nous retirons les 267 987
observations hors périmètre commun aux deux sources : agrégats, territoires sans votes et
entités historiques. Les neuf codes historiques `SUN`, `DDR`, `GER`, `CSK`, `YUG`, `SCG`,
`YMD`, `EAT`, `EAZ` sont explicitement exclus du rapprochement. Les autres identifiants sont
rapprochés par correspondance exacte ISO3 ou code source, sans inférence depuis les noms.
Trois pays du jeu de votes ne possèdent aucun flux retenu : leurs résultats restent vides.
Aucun transfert n’est effectué entre code historique et code actuel. Certaines séries FMI sont
rétrospectives et peuvent précéder les premiers votes du pays : elles restent sous leur code
source, avec des votes absents tant que les archives n’en contiennent pas.

Il s’agit d’une photographie téléchargée le 30 octobre 2026, pas d’un flux en temps réel.
Les séries peuvent être révisées par le FMI. Les services et le détail par produit sont exclus.
Le tableau des partenaires porte sur le périmètre commun documenté, pas tous les territoires mondiaux.

## Mesure et calculs

L’indicateur annuel `XG_FOB_USD` représente les exportations de marchandises, en **USD courants,
base FOB** (frontière de l’exportateur). Les valeurs `OBS_VALUE` de cette API sont déjà exprimées
en dollars : l’attribut `SCALE=6` ne doit pas provoquer une seconde multiplication par un million.
Exemple de contrôle : France → Inde, 2020, **6 562 106 659 USD**.

Pour A et B sur une même année :

```text
Flux A → B = exportations de A à destination de B publiées dans IMTS
Flux B → A = exportations de B à destination de A publiées dans IMTS
Échanges bilatéraux = flux A → B + flux B → A
Écart des flux FOB pour A = flux A → B − flux B → A
```

L’écart des deux exportations FOB n’est pas le solde commercial officiel exports FOB−imports CIF.
Nous n’additionnons pas une exportation et son importation miroir, ce qui compterait deux fois
le même mouvement. Nous ne remplaçons pas une série absente par une importation déclarée par
l’autre pays. Les totaux et écarts restent `null` si une direction manque ; un véritable zéro
publié reste zéro. Les courbes sont interrompues dans les années manquantes.

Les prix et taux de change influencent les montants courants : une hausse en USD ne mesure pas
à elle seule une hausse du volume réel échangé. La base géographique et les méthodes peuvent
différer selon les pays et évoluer dans le temps.

Chaque observation conserve **DERIVATION_TYPE** (cinquième colonne) et **STATUS** (sixième).
Dans notre extraction, toutes portent `M` (données mixtes). Parmi les valeurs retenues,
**37 366 portent le statut `e`** d’estimation ; 487 474 n’ont pas de statut spécifié.
L’absence de `e` ne certifie pas une donnée brute officielle. Les estimations et reconstructions
effectuées par le FMI restent donc possibles, même si l’application n’en produit aucune.

Le taux ONU annuel utilise uniquement les votes explicites `Y/N/A` communs de cette année.
En dessous du seuil demandé (20 par défaut), le taux est `null` et l’effectif reste fourni.
La synthèse utilise la dernière année où les deux flux sont disponibles dans la période demandée,
en indiquant son année exacte. Elle ne reporte pas les votes d’une autre année.
Les réponses et exports distinguent la version commerciale FMI de la version des votes ONU.

Les montants et pourcentages ont des graphiques distincts alignés sur les mêmes années.
Le nuage des partenaires place les échanges en abscisse logarithmique et la concordance annuelle
en ordonnée. Il ne trace que les partenaires avec deux flux connus et assez de votes ; le tableau
conserve les flux partiels et les taux absents. Aucun coefficient de corrélation ni indice d’alliance
n’est déduit de ce rapprochement descriptif.

## API et reproduction

```text
GET /api/trade/metadata
GET /api/trade/compare?countryA=FRA&countryB=IND&from=2000&to=2024&theme=all&minVotes=20
GET /api/trade/partners?country=FRA&year=2024&theme=all&minVotes=20
```

Les paramètres sont validés côté serveur. Les erreurs de saisie renvoient 400, un pays inconnu
404 et un snapshot absent 503 ; les autres fonctionnalités peuvent continuer sans commerce.

Pour actualiser intentionnellement le snapshot :

```bash
npm run trade:download
npm run trade:import
```

Requête officielle utilisée (aucune clé nécessaire lors de l’acquisition) :

```text
https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IMTS,1.0.0/.XG_FOB_USD..A?startPeriod=2000&endPeriod=2024
```

Le téléchargement conserve le XML SDMX, car `detail=dataonly` retire les attributs d’estimation.
Le parseur traite les séries en flux et refuse les montants invalides, les séries inattendues
et les fichiers tronqués. L’import refuse les doublons et vérifie le SHA-256 du fichier brut
contre son manifeste d’acquisition. Le XML brut (58,7 Mo) reste dans `data/raw/trade/`, ignoré
par Git. Le JSON compact est livré au serveur, jamais envoyé intégralement au navigateur.

Schéma d’un flux : `[année, exportateur, destinataire, USD, dérivation, statut]`.
Après import, redémarrer l’API pour charger le nouveau snapshot. La commande `npm run check`
vérifie compilation Angular, contrats HTTP et calculs, dont données manquantes, vrais zéros,
inversion de direction, seuils annuels, estimation et intégrité du parseur d’import.
