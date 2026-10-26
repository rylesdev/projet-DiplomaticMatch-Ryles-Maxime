import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template:
    '<section class="page-heading"><span class="eyebrow">404 / HORS DES ARCHIVES</span><h1>Cette page reste<br>à découvrir.</h1><p>L’adresse ne correspond à aucune page de l’application.</p><a class="button button-primary" routerLink="/">Revenir à l’accueil →</a></section>',
})
export class NotFoundPage {}
