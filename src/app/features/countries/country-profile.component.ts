import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, finalize, of, switchMap } from 'rxjs';
import { CountryProfile, Theme, VoteChoice } from '../../core/models/api.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';

interface ProfileRequest {
  id: string;
  from: number;
  to: number;
  theme: string;
}

@Component({
  selector: 'app-country-profile',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './country-profile.component.html',
  styleUrl: './country-profile.component.scss',
})
export class CountryProfileComponent {
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

  readonly form = new FormGroup({
    from: new FormControl(2000, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
    }),
    to: new FormControl(2026, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
    }),
    theme: new FormControl('all', { nonNullable: true, validators: [Validators.required] }),
  });

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
    if (this.form.invalid || ![from, to].every(Number.isInteger) || from > to) {
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

  voteLabel(choice: VoteChoice): string {
    return {
      YES: 'Pour',
      NO: 'Contre',
      ABSTAIN: 'Abstention',
      NOT_VOTED: 'Non-vote',
      UNKNOWN: 'Inconnu',
    }[choice];
  }

  voteClass(choice: VoteChoice): string {
    return {
      YES: 'tag-yes',
      NO: 'tag-no',
      ABSTAIN: 'tag-abstain',
      NOT_VOTED: 'tag-missing',
      UNKNOWN: 'tag-missing',
    }[choice];
  }
}

