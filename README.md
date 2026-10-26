# INF1 — Projet Angular

Base Angular vierge pour démarrer le projet [Ryles et Maxime](https://github.com/rylesdev/projet-NOMDUPROJET-Ryles-Maxime.). La page d'accueil est volontairement blanche : le composant racine contient uniquement l'emplacement du routeur, sans page ni fonctionnalité préexistante.

## Installation et lancement

Prérequis : Git, Node.js 24 LTS et npm (configuration utilisée : Node.js 24.21.0, npm 12.0.2).

```bash
git clone https://github.com/rylesdev/projet-NOMDUPROJET-Ryles-Maxime..git inf1-projet-angular
cd inf1-projet-angular
npm ci
npm start
```

Ouvrir http://localhost:4200/. Une page blanche est le résultat attendu. Les modifications des sources sont rechargées automatiquement. Arrêter le serveur avec `Ctrl+C`.

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
    app.ts, app.html, app.scss   Composant racine vierge
    app.spec.ts                 Test de démarrage
    app.config.ts               Configuration Angular
    app.routes.ts               Routes à définir
  index.html                    Page HTML en français
  main.ts                       Démarrage de l'application
  styles.scss                   Styles globaux
angular.json                    Configuration compilation, serveur et tests
package.json                    Dépendances et commandes npm
package-lock.json               Versions verrouillées pour npm ci
```

Le projet Angular se trouve directement à la racine du dépôt. Il utilise Angular 21.2, TypeScript et SCSS, avec un composant standalone. Aucun service externe ou fichier de configuration secret n'est nécessaire.

## Vérifications

```bash
npm run build
npm test -- --watch=false
```

La compilation de production est générée dans `dist/inf1-projet-angular/browser/`. Le test Vitest vérifie que l'application démarre avec un contenu vide.
