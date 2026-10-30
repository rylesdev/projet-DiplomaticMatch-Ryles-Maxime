# Polices locales

Ces fichiers sont servis directement par l'application. Aucune connexion à Google Fonts ni à un CDN n'est nécessaire lors de la consultation du site.

| Fichier | Famille | Style | Graisse | Taille |
| --- | --- | --- | --- | --- |
| `dm-sans-latin.woff2` | DM Sans | normal | variable, 400–700 | 36 932 octets |
| `instrument-serif-italic-latin.woff2` | Instrument Serif | italique | 400 | 22 128 octets |

Les sous-ensembles latins incluent les lettres accentuées françaises, les ligatures Œ/œ et la ponctuation usuelle. Les caractères non couverts utilisent les polices de repli déclarées dans le CSS.

## Sources et licences

Fichiers récupérés depuis les serveurs officiels Google Fonts :

- [DM Sans WOFF2, version Google Fonts v17](https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2)
- [Instrument Serif Italic WOFF2, version Google Fonts v5](https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7M.woff2)

Les deux familles sont distribuées sous licence **SIL Open Font License 1.1**. Les licences originales sont conservées dans `DM-Sans-OFL.txt` et `Instrument-Serif-OFL.txt` ; elles proviennent respectivement de [google/fonts/ofl/dmsans](https://github.com/google/fonts/tree/main/ofl/dmsans) et [google/fonts/ofl/instrumentserif](https://github.com/google/fonts/tree/main/ofl/instrumentserif).

## Déclarations CSS

```css
@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/dm-sans-latin.woff2') format('woff2');
}

@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/instrument-serif-italic-latin.woff2') format('woff2');
}
```
