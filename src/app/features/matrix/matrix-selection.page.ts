import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { ConcordanceMatrix, Country, Theme } from '../../core/models/api.models';
import { periodValidator } from '../../core/period.validator';
import { DataPeriodService, DEFAULT_FROM } from '../../core/services/data-period.service';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { CountryPickerComponent } from '../../shared/country-picker.component';
import { concordanceColor, concordanceTextColor } from '../../shared/concordance-colors';

interface SelectionRequest {
  countries: string[];
  from: number;
  to: number;
  minVotes: number;
  theme: string;
}

// Matrice de 2 à 15 pays choisis : un tableau HTML avec le taux et le nombre de votes par case.
@Component({
  selector: 'app-matrix-selection-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, CountryPickerComponent],
  templateUrl: './matrix-selection.page.html',
  styleUrl: './matrix-selection.page.scss',
})
export class MatrixSelectionPage {
  private readonly period = inject(DataPeriodService);
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<SelectionRequest | null>();
  readonly maxCountries = 15;
  readonly color = concordanceColor;
  readonly textColor = concordanceTextColor;
  readonly countries = signal<Country[]>([]);
  readonly themes = signal<Theme[]>([]);
  // Sélection de départ : les cinq membres permanents du Conseil de sécurité et l'Inde.
  readonly selectedIds = signal<string[]>(['FRA', 'USA', 'GBR', 'CHN', 'RUS', 'IND']);
  readonly data = signal<ConcordanceMatrix | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly optionsError = signal('');
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      from: [DEFAULT_FROM, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      to: [this.period.lastYear, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      minVotes: [20, [Validators.required, Validators.min(1), Validators.max(100000)]],
      theme: ['all', Validators.required],
    },
    { validators: periodValidator },
  );
  readonly themeLabel = computed(
    () =>
      this.themes().find((theme) => theme.id === this.data()?.theme)?.label ?? this.data()?.theme,
  );

  constructor() {
    this.requests
      .pipe(
        switchMap((request) => {
          this.data.set(null);
          if (!request) return of(null);
          this.loading.set(true);
          this.error.set('');
          return this.api
            .matrixSelection(
              request.countries,
              request.from,
              request.to,
              request.minVotes,
              request.theme,
            )
            .pipe(
              catchError((error: unknown) => {
                this.error.set(apiErrorMessage(error));
                return of(null);
              }),
              finalize(() => this.loading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.data.set(data));
    this.loadOptions();
    this.apply();
  }

  loadOptions(): void {
    this.optionsError.set('');
    forkJoin({ countries: this.api.countries(), themes: this.api.themes() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ countries, themes }) => {
          this.countries.set(countries);
          this.themes.set(themes);
        },
        error: (error: unknown) => this.optionsError.set(apiErrorMessage(error)),
      });
  }

  apply(): void {
    const countries = this.selectedIds();
    this.form.markAllAsTouched();
    if (this.form.invalid || countries.length < 2 || countries.length > this.maxCountries) {
      this.requests.next(null);
      this.error.set(
        'Choisissez entre 2 et 15 pays, des années entières dans l’ordre et un seuil valide.',
      );
      return;
    }
    this.requests.next({ countries, ...this.form.getRawValue() });
  }
}
