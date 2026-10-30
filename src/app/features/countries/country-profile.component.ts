import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, finalize, of, switchMap } from 'rxjs';
import { CountryProfile, Theme } from '../../core/models/api.models';
import { periodValidator } from '../../core/period.validator';
import { DataPeriodService } from '../../core/services/data-period.service';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { voteClass, voteLabel } from '../../core/vote-labels';

interface ProfileRequest {
  id: string;
  from: number;
  to: number;
  theme: string;
}

// Fiche pays : répartition des votes et alignement sur la majorité de séance de l'Assemblée.
@Component({
  selector: 'app-country-profile',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './country-profile.component.html',
  styleUrl: './country-profile.component.scss',
})
export class CountryProfileComponent {
  readonly voteLabel = voteLabel;
  readonly voteClass = voteClass;
  private readonly period = inject(DataPeriodService);
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new BehaviorSubject<ProfileRequest | null>(null);
  private activeCountryId = '';

  @Input({ required: true })
  set countryId(id: string) {
    if (id === this.activeCountryId) return;
    this.activeCountryId = id;
    this.apply();
  }

  readonly form = new FormGroup(
    {
      from: new FormControl(this.period.defaultFrom, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
      }),
      to: new FormControl(this.period.lastYear, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
      }),
      theme: new FormControl('all', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: periodValidator },
  );

  readonly themes = signal<Theme[]>([]);
  readonly themesLoading = signal(false);
  readonly themesError = signal('');
  readonly result = signal<CountryProfile | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.requests
      .pipe(
        switchMap((request) => {
          this.result.set(null);
          if (!request) return of(null);
          this.loading.set(true);
          this.error.set('');
          return this.api.profile(request.id, request.from, request.to, request.theme).pipe(
            catchError((error: unknown) => {
              this.error.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.result.set(value));
    this.loadThemes();
  }

  loadThemes(): void {
    this.themesLoading.set(true);
    this.themesError.set('');
    this.api
      .themes()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.themesLoading.set(false)),
      )
      .subscribe({
        next: (themes) => this.themes.set(themes),
        error: (error: unknown) => this.themesError.set(apiErrorMessage(error)),
      });
  }

  themeLabel(id = 'all'): string {
    return (
      this.themes().find((theme) => theme.id === id)?.label ??
      (id === 'all' ? 'Tous les thèmes' : id)
    );
  }

  apply(): void {
    const { from, to, theme } = this.form.getRawValue();
    if (!this.activeCountryId) return;
    if (this.form.invalid) {
      this.requests.next(null);
      this.form.markAllAsTouched();
      this.error.set('Choisissez des années entières entre 1946 et 2100, dans l’ordre.');
      return;
    }
    this.requests.next({ id: this.activeCountryId, from, to, theme });
  }

  choicePercent(count: number, total: number): number {
    return total > 0 ? (100 * count) / total : 0;
  }
}
