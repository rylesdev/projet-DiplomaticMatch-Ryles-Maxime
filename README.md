# INF1 — Projet Angular

Application Angular reprise du [TP1 de Daria et Maxime](https://github.com/dasha-may/dariaQuesnelMaximeDacostavieiraTP1), commit `52df89d`, pour le dépôt [rylesdev/projet-NOMDUPROJET-Ryles-Maxime.](https://github.com/rylesdev/projet-NOMDUPROJET-Ryles-Maxime.).

La structure et le fonctionnement du TP1 sont conservés : en-tête violet avec les prénoms, quatre carrés Microsoft cliquables qui changent la couleur du fond, et pied de page orange. Le logo s'adapte aussi aux petits écrans et ses boutons sont accessibles au clavier et nommés pour les lecteurs d'écran.

## Installation et lancement

Prérequis : Git, Node.js 24 LTS et npm (configuration utilisée : Node.js 24.21.0, npm 12.0.2).

```bash
git clone https://github.com/rylesdev/projet-NOMDUPROJET-Ryles-Maxime..git inf1-projet-angular
cd inf1-projet-angular
npm ci
npm start
```

Ouvrir http://localhost:4200/. Les modifications des sources sont rechargées automatiquement. Arrêter le serveur avec `Ctrl+C`.

Si le dépôt est déjà ouvert dans un terminal, exécuter simplement `npm ci`, puis `npm start` depuis le dossier contenant `package.json`. Aucune installation globale d'Angular CLI n'est nécessaire.

Pour utiliser un autre port :

```bash
npm start -- --port 4201
```

## Structure

```text
public/                         Fichiers statiques, favicon
src/
  app/
    header-violet/              En-tête, prénoms reçus avec @Input
    microsoft/                  Logo, couleur envoyée avec @Output
    footer-orange/              Pied de page
    app.ts, app.html, app.scss   Assemblage et couleur du fond
    app.config.ts               Configuration Angular
    app.routes.ts               Routes (vides comme dans le TP1)
  index.html                    Page HTML en français
  main.ts                       Démarrage de l'application
  styles.scss                   Styles globaux
angular.json                    Configuration compilation, serveur et tests
package.json                    Dépendances et commandes npm
package-lock.json               Versions verrouillées pour npm ci
```

Le projet Angular se trouve directement à la racine du dépôt. Il utilise Angular 21.2, TypeScript et SCSS, avec des composants standalone comme dans le TP1. Aucun service externe ou fichier de configuration secret n'est nécessaire.

## Vérifications

```bash
npm run build
npm test -- --watch=false
```

La compilation de production est générée dans `dist/inf1-projet-angular/browser/`. Les tests Vitest vérifient les composants, les prénoms affichés et le changement du fond lors des clics sur les carrés.
