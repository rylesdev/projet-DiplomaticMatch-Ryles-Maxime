import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { DiplomaticApiService } from './diplomatic-api.service';

// Début par défaut des analyses, fixé par l'énoncé des fonctionnalités.
export const DEFAULT_FROM = 2000;

// Dernière année entièrement couverte par les données. Exemple : une couverture
// qui s'arrête au 2026-09-17 donne 2025, car 2026 est incomplète.
export function lastCompleteYear(coverageTo: string): number {
  const year = Number(coverageTo.slice(0, 4));
  return coverageTo.endsWith('-12-31') ? year : year - 1;
}

// Période par défaut des formulaires, calculée une fois au démarrage à partir de
// /api/metadata (voir app.config.ts), puis lue directement par les pages.
@Injectable({ providedIn: 'root' })
export class DataPeriodService {
  private readonly api = inject(DiplomaticApiService);
  // Valeurs de secours, utilisées seulement si l'API ne répond pas au démarrage.
  firstYear = DEFAULT_FROM;
  lastYear = new Date().getFullYear() - 1;

  load(): Observable<void> {
    return this.api.metadata().pipe(
      map((metadata) => {
        this.firstYear = Number(metadata.coverage.from.slice(0, 4));
        this.lastYear = lastCompleteYear(metadata.coverage.to);
      }),
      // Sans API, l'application démarre quand même et chaque page affiche son erreur.
      catchError(() => of(undefined)),
    );
  }
}
