import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, finalize, map, of, switchMap } from 'rxjs';
import { ConcordanceMatrix, Theme } from '../../core/models/api.models';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { MapCountry, WorldMap, mapCountries, parseWorldMap } from './map-data';

@Component({
  selector: 'app-map-page',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './map.page.html',
  styleUrl: './map.page.scss',
})
export class MapPage {
  private readonly api = inject(DiplomaticApiService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly requests = new Subject<{
    from: number;
    to: number;
    minVotes: number;
    theme: string;
  }>();
  readonly geography = signal<WorldMap | null>(null);
  readonly data = signal<ConcordanceMatrix | null>(null);
  readonly themes = signal<Theme[]>([]);
  readonly referenceId = signal(this.query.get('country') ?? 'FRA');
  readonly hoveredId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly mapLoading = signal(false);
  readonly error = signal('');
  readonly mapError = signal('');
  readonly themesError = signal('');
  readonly zoom = signal(1);
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      from: [
        Number(this.query.get('from') ?? 2000),
        [Validators.required, Validators.min(1946), Validators.max(2100)],
      ],
      to: [
        Number(this.query.get('to') ?? 2025),
        [Validators.required, Validators.min(1946), Validators.max(2100)],
      ],
      theme: [this.query.get('theme') ?? 'all', Validators.required],
      minVotes: [
        Number(this.query.get('minVotes') ?? 20),
        [Validators.required, Validators.min(1), Validators.max(100000)],
      ],
    },
    {
      validators: (control: AbstractControl) => {
        const { from, to, minVotes } = control.value;
        return [from, to, minVotes].every(Number.isInteger) && from <= to ? null : { period: true };
      },
    },
  );
  readonly countries = computed(() =>
    mapCountries(this.geography(), this.data(), this.referenceId()),
  );
  readonly selectable = computed(() => this.countries().filter((shape) => shape.country !== null));
  readonly reference = computed(
    () => this.data()?.countries.find((country) => country.id === this.referenceId()) ?? null,
  );
  readonly referenceOnMap = computed(() =>
    this.selectable().some((shape) => shape.country?.id === this.referenceId()),
  );
  readonly inspected = computed(
    () => this.countries().find((shape) => shape.id === this.hoveredId()) ?? null,
  );
  readonly eligible = computed(
    () =>
      this.selectable().filter(
        (shape) => shape.country?.id !== this.referenceId() && shape.percentage !== null,
      ).length,
  );
  readonly themeLabel = computed(
    () =>
      this.themes().find((theme) => theme.id === this.data()?.theme)?.label ?? this.data()?.theme,
  );
  readonly comparisonParams = computed(() => ({
    countryA: this.referenceId(),
    countryB: this.inspected()?.country?.id,
    from: this.data()?.from,
    to: this.data()?.to,
    theme: this.data()?.theme,
  }));

  constructor() {
    this.requests
      .pipe(
        switchMap((filters) => {
          this.loading.set(true);
          this.error.set('');
          // Effacer les anciens taux évite de les attribuer à de nouveaux filtres.
          this.data.set(null);
          return this.api.matrix(filters.from, filters.to, filters.minVotes, filters.theme).pipe(
            catchError((error: unknown) => {
              this.error.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.data.set(data);
        this.ensureReference();
      });
    this.loadMap();
    this.loadThemes();
    this.apply();
  }

  loadMap(): void {
    this.mapLoading.set(true);
    this.mapError.set('');
    this.http
      .get<unknown>('/maps/world.json')
      .pipe(
        map(parseWorldMap),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mapLoading.set(false)),
      )
      .subscribe({
        next: (geography) => {
          this.geography.set(geography);
          this.ensureReference();
        },
        error: () => this.mapError.set('Le fond de carte ne peut pas être chargé. Réessayez.'),
      });
  }

  loadThemes(): void {
    this.themesError.set('');
    this.api
      .themes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (themes) => this.themes.set(themes),
        error: (error: unknown) => this.themesError.set(apiErrorMessage(error)),
      });
  }

  apply(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        'Choisissez des années entières entre 1946 et 2100, dans l’ordre, et un seuil valide.',
      );
      return;
    }
    this.hoveredId.set(null);
    this.requests.next(this.form.getRawValue());
  }

  selectCountry(id: string): void {
    if (!this.data()?.countries.some((country) => country.id === id)) return;
    this.referenceId.set(id);
    this.hoveredId.set(null);
  }

  inspect(shape: MapCountry): void {
    this.hoveredId.set(shape.id);
  }

  onCountryKey(event: KeyboardEvent, shape: MapCountry): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (shape.country) this.selectCountry(shape.country.id);
    }
  }

  description(shape: MapCountry): string {
    if (!shape.country) return `${shape.name} : absent du jeu de votes.`;
    if (shape.country.id === this.referenceId()) return `${shape.name} : pays de référence.`;
    if (shape.percentage === null)
      return `${shape.name} : ${shape.common ? 'seuil non atteint' : 'aucun vote commun'}.`;
    return `${shape.name} : ${shape.percentage.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de concordance, ${shape.common} votes comparables. Cliquer pour choisir ce pays comme référence.`;
  }

  changeZoom(delta: number): void {
    this.zoom.update((zoom) => Math.max(1, Math.min(3, zoom + delta)));
  }

  private ensureReference(): void {
    if (!this.geography() || !this.data()) return;
    const countries = this.data()!.countries;
    if (!countries.some((country) => country.id === this.referenceId())) {
      this.referenceId.set(
        countries.find((country) => country.id === 'FRA')?.id ?? countries[0]?.id ?? '',
      );
    }
  }
}
