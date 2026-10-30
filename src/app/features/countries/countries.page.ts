import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { Country, CountryVote, DataMetadata, Paginated } from '../../core/models/api.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { CountryRankingsComponent } from './country-rankings.component';
import { voteClass, voteLabel } from '../../core/vote-labels';

interface VoteRequest {
  id: string;
  from: number;
  to: number;
  page: number;
}

@Component({
  selector: 'app-countries-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, DatePipe, CountryRankingsComponent],
  templateUrl: './countries.page.html',
  styleUrl: './countries.page.scss',
})
export class CountriesPage {
  readonly voteLabel = voteLabel;
  readonly voteClass = voteClass;
  readonly Math = Math;
  private readonly api = inject(DiplomaticApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly voteRequest = new BehaviorSubject<VoteRequest | null>(null);

  readonly search = new FormControl('', { nonNullable: true });
  readonly filters = new FormGroup({
    from: new FormControl(2000, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
    }),
    to: new FormControl(2026, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
    }),
  });
  readonly countries = signal<Country[]>([]);
  readonly selected = signal<Country | null>(null);
  readonly votes = signal<Paginated<CountryVote> | null>(null);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly searchLoading = signal(false);
  readonly countryLoading = signal(false);
  readonly votesLoading = signal(false);
  readonly searchError = signal('');
  readonly countryError = signal('');
  readonly votesError = signal('');
  readonly page = signal(1);

  constructor() {
    this.api
      .metadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (value) => this.metadata.set(value), error: () => undefined });

    this.search.valueChanges
      .pipe(
        startWith(''),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          this.searchLoading.set(true);
          this.searchError.set('');
          return this.api.countries(query.trim()).pipe(
            catchError((error: unknown) => {
              this.searchError.set(apiErrorMessage(error));
              return of([]);
            }),
            finalize(() => this.searchLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.countries.set(value));

    this.voteRequest
      .pipe(
        switchMap((request) => {
          this.votes.set(null);
          if (!request) return of(null);
          this.votesLoading.set(true);
          this.votesError.set('');
          return this.api.votes(request.id, request.from, request.to, request.page).pipe(
            catchError((error: unknown) => {
              this.votesError.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.votesLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.votes.set(value));

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        switchMap((id) => {
          this.selected.set(null);
          this.voteRequest.next(null);
          this.countryError.set('');
          if (!id) return of(null);
          this.countryLoading.set(true);
          return this.api.country(id).pipe(
            catchError((error: unknown) => {
              this.countryError.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.countryLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        this.selected.set(value);
        if (value) this.applyVotes();
      });
  }

  applyVotes(page = 1): void {
    const country = this.selected();
    const { from, to } = this.filters.getRawValue();
    if (!country) return;
    if (this.filters.invalid || from > to) {
      this.voteRequest.next(null);
      this.votesError.set(
        'Choisissez deux années valides, avec une année de début antérieure ou égale à la fin.',
      );
      return;
    }
    const previous = this.voteRequest.value;
    const nextPage =
      previous?.id === country.id && previous.from === from && previous.to === to ? page : 1;
    this.page.set(nextPage);
    this.voteRequest.next({ id: country.id, from, to, page: nextPage });
  }
}
