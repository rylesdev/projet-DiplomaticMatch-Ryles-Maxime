import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import {
  ComparisonResult,
  Country,
  DataMetadata,
  TrendResult,
  Theme,
  VoteChoice,
} from '../../core/models/api.models';

interface Filters {
  countryA: string;
  countryB: string;
  from: number;
  to: number;
  theme: string;
}
const periodValidator = (control: AbstractControl) => {
  const from = Number(control.get('from')?.value);
  const to = Number(control.get('to')?.value);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return { period: true };
  if (control.get('countryA')?.value === control.get('countryB')?.value)
    return { sameCountry: true };
  return null;
};

@Component({
  selector: 'app-compare-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './compare.page.html',
  styleUrl: './compare.page.scss',
})
export class ComparePage {
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly comparisons = new Subject<Filters>();
  private readonly trends = new Subject<Filters & { interval: 'year' | 'decade' }>();
  readonly countries = signal<Country[]>([]);
  readonly themes = signal<Theme[]>([]);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly result = signal<ComparisonResult | null>(null);
  readonly trend = signal<TrendResult | null>(null);
  readonly loading = signal(false);
  readonly trendLoading = signal(false);
  readonly error = signal('');
  readonly trendError = signal('');
  readonly optionsError = signal('');
  readonly interval = signal<'year' | 'decade'>('year');
  readonly submitted = signal(false);
  private readonly activeFilters = signal<Filters | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      countryA: ['FRA', Validators.required],
      countryB: ['IND', Validators.required],
      theme: ['all', Validators.required],
      from: [2000, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      to: [2025, [Validators.required, Validators.min(1946), Validators.max(2100)]],
    },
    { validators: periodValidator },
  );
  readonly plottedPoints = computed(() => {
    const points = this.trend()?.points ?? [];
    return points.map((point, index) => ({
      ...point,
      x: 48 + (index / Math.max(1, points.length - 1)) * 820,
      y: point.agreementPercent === null ? null : 210 - point.agreementPercent * 1.8,
    }));
  });
  readonly chartSegments = computed(() => {
    const segments: string[] = [];
    let segment: string[] = [];
    for (const point of this.plottedPoints()) {
      if (point.y === null) {
        if (segment.length) segments.push(segment.join(' '));
        segment = [];
      } else segment.push(`${point.x},${point.y}`);
    }
    if (segment.length) segments.push(segment.join(' '));
    return segments;
  });
  readonly hasTrendData = computed(() => this.plottedPoints().some((point) => point.y !== null));

  constructor() {
    this.comparisons
      .pipe(
        switchMap((filters) => {
          this.loading.set(true);
          this.error.set('');
          this.result.set(null);
          return this.api
            .compare(filters.countryA, filters.countryB, filters.from, filters.to, filters.theme)
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
      .subscribe((result) => this.result.set(result));
    this.trends
      .pipe(
        switchMap((filters) => {
          this.trendLoading.set(true);
          this.trendError.set('');
          this.trend.set(null);
          return this.api
            .trend(
              filters.countryA,
              filters.countryB,
              filters.from,
              filters.to,
              filters.interval,
              filters.theme,
            )
            .pipe(
              catchError((error: unknown) => {
                this.trendError.set(apiErrorMessage(error));
                return of(null);
              }),
              finalize(() => this.trendLoading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((trend) => this.trend.set(trend));
    this.loadOptions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.form.patchValue({
        countryA: params.get('countryA') ?? 'FRA',
        countryB: params.get('countryB') ?? 'IND',
        theme: params.get('theme') ?? 'all',
        from: Number(params.get('from') ?? 2000),
        to: Number(params.get('to') ?? 2025),
      });
      this.compare();
    });
  }

  loadOptions(): void {
    this.optionsError.set('');
    forkJoin({
      countries: this.api.countries(),
      metadata: this.api.metadata(),
      themes: this.api.themes(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ countries, metadata, themes }) => {
          this.countries.set(countries);
          this.metadata.set(metadata);
          this.themes.set(themes);
        },
        error: (error: unknown) => this.optionsError.set(apiErrorMessage(error)),
      });
  }

  compare(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const filters = this.form.getRawValue();
    this.activeFilters.set(filters);
    this.comparisons.next(filters);
    this.trends.next({ ...filters, interval: this.interval() });
  }

  refreshTrend(value: string): void {
    if (value !== 'year' && value !== 'decade') return;
    this.interval.set(value);
    const filters = this.activeFilters();
    if (!filters) return;
    this.trends.next({ ...filters, interval: value });
  }

  themeLabel(id = 'all'): string {
    return (
      this.themes().find((theme) => theme.id === id)?.label ??
      (id === 'all' ? 'Tous les thèmes' : id)
    );
  }

  periodLabel(year: number, trend: TrendResult): string {
    return trend.interval === 'year'
      ? String(year)
      : `${Math.max(year, trend.from)}–${Math.min(year + 9, trend.to)}`;
  }

  voteLabel(choice: VoteChoice): string {
    return {
      YES: 'Pour',
      NO: 'Contre',
      ABSTAIN: 'Abstention',
      NOT_VOTED: 'Sans vote',
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
