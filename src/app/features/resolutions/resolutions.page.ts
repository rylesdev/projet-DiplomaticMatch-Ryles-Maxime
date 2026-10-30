import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { periodValidator } from '../../core/period.validator';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';
import { DataMetadata, Paginated, Resolution } from '../../core/models/api.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';

interface ResolutionRequest {
  search: string;
  from: number;
  to: number;
  page: number;
}

@Component({
  selector: 'app-resolutions-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './resolutions.page.html',
  styleUrl: './resolutions.page.scss',
})
export class ResolutionsPage {
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new BehaviorSubject<ResolutionRequest | null>({
    search: '',
    from: 1946,
    to: 2026,
    page: 1,
  });
  readonly Math = Math;
  readonly form = new FormGroup(
    {
      search: new FormControl('', { nonNullable: true }),
      from: new FormControl(1946, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
      }),
      to: new FormControl(2026, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1946), Validators.max(2100)],
      }),
    },
    { validators: periodValidator },
  );
  readonly result = signal<Paginated<Resolution> | null>(null);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);

  constructor() {
    this.api
      .metadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (value) => this.metadata.set(value), error: () => undefined });
    this.requests
      .pipe(
        switchMap((request) => {
          this.result.set(null);
          if (!request) return of(null);
          this.loading.set(true);
          this.error.set('');
          return this.api
            .resolutions(request.search, request.page, 20, request.from, request.to)
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
    this.form.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applySearch());
  }

  applySearch(page = 1): void {
    const { search, from, to } = this.form.getRawValue();
    if (this.form.invalid) {
      this.requests.next(null);
      this.error.set(
        'Choisissez une période valide : l’année de début doit précéder ou égaler l’année de fin.',
      );
      return;
    }
    const previous = this.requests.value;
    const query = search.trim();
    const nextPage =
      previous?.search === query && previous.from === from && previous.to === to ? page : 1;
    this.page.set(nextPage);
    this.requests.next({ search: query, from, to, page: nextPage });
  }
}
