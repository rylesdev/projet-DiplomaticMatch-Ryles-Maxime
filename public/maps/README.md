# Fond de carte mondial

Fond simplifié **Natural Earth, Admin 0 — Countries, 1:110m**, dans le domaine public.

- [Source GeoJSON figée](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_110m_admin_0_countries.geojson)
- [Conditions d’utilisation](https://www.naturalearthdata.com/about/terms-of-use/)
- SHA-256 : `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`

## Format

`world.json` contient `width`, `height` et `countries: [{ id, name, path }]`. Le champ `path` est un chemin SVG dans un viewBox `0 0 1200 500`. Utiliser `fill-rule="evenodd"` pour conserver les trous des polygones.

Projection équirectangulaire, longitudes −180 à 180 et latitudes 90 à −60. L’Antarctique est exclu. Les polygones sont déjà découpés à l’antiméridien ; le générateur vérifie l’absence de segments traversant toute la carte. Les coordonnées sont arrondies au centième pour alléger l’asset. Aucune bibliothèque géographique ni requête externe n’est nécessaire à l’exécution.

## Correspondance avec les votes

176 contours sont présents, dont 165 correspondent directement aux 202 codes du jeu de votes livré. Les identifiants proviennent de `ISO_A3_EH`, ou de `ADM0_A3` lorsque le premier vaut −99 (notamment pour les entités sans code ISO). France et Norvège conservent ainsi FRA et NOR. Les contours sans correspondance restent sans données ; aucune correspondance politique ou historique n’est inventée. Les frontières sont celles de ce fond contemporain simplifié et ne reconstituent pas les frontières historiques des années filtrées.

Les 37 codes de votes sans contour sont surtout des petites îles, micro-États et entités historiques :

- ATG — ANTIGUA AND BARBUDA
- BHR — BAHRAIN
- BRB — BARBADOS
- CPV — CABO VERDE
- COM — COMOROS
- CSK — Tchécoslovaquie (historique)
- YMD — Yémen démocratique (historique)
- DMA — DOMINICA
- DDR — RDA (historique)
- GER — RFA (historique)
- GRD — GRENADA
- MDV — MALDIVES
- MLT — MALTA
- MUS — MAURITIUS
- KNA — SAINT KITTS AND NEVIS
- LCA — SAINT LUCIA
- VCT — SAINT VINCENT AND THE GRENADINES
- WSM — SAMOA
- STP — SAO TOME AND PRINCIPE
- SYC — SEYCHELLES
- SGP — SINGAPORE
- SUN — Union soviétique (historique)
- YUG — Yougoslavie (historique)
- LIE — LIECHTENSTEIN
- MHL — MARSHALL ISLANDS
- FSM — MICRONESIA (FEDERATED STATES OF)
- SMR — SAN MARINO
- AND — ANDORRA
- MCO — MONACO
- PLW — PALAU
- KIR — KIRIBATI
- NRU — NAOERO
- TON — TONGA
- TUV — TUVALU
- SCG — Serbie-et-Monténégro (historique)
- EAT — TANGANYIKA
- EAZ — ZANZIBAR

## Régénération

Depuis la racine du dépôt, avec Node.js :

```sh
node scripts/build-world-map.mjs
```

Le script télécharge la source figée et contrôle son empreinte. Pour un fichier déjà téléchargé : `node scripts/build-world-map.mjs chemin/vers/source.geojson`.
