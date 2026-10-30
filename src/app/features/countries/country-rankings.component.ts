import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, finalize, of, switchMap } from 'rxjs';
import { CountryRankings, Theme } from '../../core/models/api.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';

interface RankingRequest {
  id: string;
  from: number;
  to: number;
  minVotes: number;
  theme: string;
}

@Component({
  selector: 'app-country-rankings',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './country-rankings.component.html',
  styleUrl: './country-rankings.component.scss',
})
export class CountryRankingsComponent {
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new BehaviorSubject<RankingRequest | null>(null);
  private activeCountryId = '';

  @Input({ required: true })
  set countryId(id: string) {
    if (id === this.activeCountryId) return;
    this.activeCountryId = id;
    this.apply();
  }

  readonly form = new FormGroup({
    from: new FormControl(2000, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
    }),
    to: new FormControl(2026, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
    }),
    minVotes: new FormControl(50, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100000)],
    }),
    theme: new FormControl('all', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly themes = signal<Theme[]>([]);
  readonly themesLoading = signal(false);
  readonly themesError = signal('');
  readonly result = signal<CountryRankings | null>(null);
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
          return this.api
            .rankings(request.id, request.from, request.to, request.minVotes, request.theme)
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
    const { from, to, minVotes, theme } = this.form.getRawValue();
    if (!this.activeCountryId) return;
    if (this.form.invalid || ![from, to, minVotes].every(Number.isInteger) || from > to) {
      this.requests.next(null);
      this.form.markAllAsTouched();
      this.error.set(
        'Choisissez des années entières entre 1946 et 2100, dans l’ordre, et un seuil de votes valide.',
      );
      return;
    }
    this.requests.next({ id: this.activeCountryId, from, to, minVotes, theme });
  }
}
