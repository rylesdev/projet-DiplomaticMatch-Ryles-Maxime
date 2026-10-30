import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { DataPeriodService } from '../../core/services/data-period.service';
import { differentCountries } from '../../core/different-countries.validator';
import { periodValidator } from '../../core/period.validator';
import { voteClass, voteLabel } from '../../core/vote-labels';
import {
  ComparisonResult,
  Country,
  DataMetadata,
  ExplicitVoteChoice,
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
  search: string;
}
interface DivergencePairFilter {
  choiceA: ExplicitVoteChoice;
  choiceB: ExplicitVoteChoice;
}
export type ResolutionTab = 'agreements' | 'divergences' | 'all';
export interface KeywordSuggestion {
  label: string;
  keyword: string;
  from?: number;
  to?: number;
}
@Component({
  selector: 'app-compare-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './compare.page.html',
  styleUrl: './compare.page.scss',
})
export class ComparePage {
  readonly voteLabel = voteLabel;
  readonly voteClass = voteClass;
  readonly explicitChoices: ExplicitVoteChoice[] = ['YES', 'NO', 'ABSTAIN'];
  readonly keywordSuggestions: KeywordSuggestion[] = [
    { label: 'Palestine', keyword: 'Palestine' },
    { label: 'Taïwan / Chine (1950–1971)', keyword: 'Taïwan', from: 1950, to: 1971 },
    { label: 'Ukraine', keyword: 'Ukraine' },
    { label: 'Nucléaire', keyword: 'Nucléaire' },
    { label: 'Droits humains', keyword: 'Droits humains' },
    { label: 'Apartheid (1952–1994)', keyword: 'Apartheid', from: 1952, to: 1994 },
    { label: 'Cuba', keyword: 'Cuba' },
  ];
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly period = inject(DataPeriodService);
  private readonly route = inject(ActivatedRoute);
  // null efface le résultat affiché et annule la requête en cours (formulaire invalide).
  private readonly comparisons = new Subject<Filters | null>();
  private readonly trends = new Subject<(Filters & { interval: 'year' | 'decade' }) | null>();
  private readonly focusRequests = new Subject<Filters | null>();
  readonly countries = signal<Country[]>([]);
  readonly themes = signal<Theme[]>([]);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly result = signal<ComparisonResult | null>(null);
  readonly trend = signal<TrendResult | null>(null);
  readonly focusedYear = signal<number | null>(null);
  readonly focusedComparison = signal<ComparisonResult | null>(null);
  readonly focusLoading = signal(false);
  readonly focusError = signal('');
  readonly selectedDivergencePair = signal<DivergencePairFilter | null>(null);
  readonly resolutionTab = signal<ResolutionTab>('divergences');
  readonly showAllResolutions = signal(false);
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
      search: [''],
      from: [
        this.period.defaultFrom,
        [Validators.required, Validators.min(1946), Validators.max(2100)],
      ],
      to: [this.period.lastYear, [Validators.required, Validators.min(1946), Validators.max(2100)]],
    },
    { validators: [periodValidator, differentCountries] },
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
  readonly inflections = computed(() => this.trend()?.inflections ?? null);
  readonly activeComparison = computed(() => this.focusedComparison() ?? this.result());
  readonly breakdownSummary = computed(() => {
    const comp = this.activeComparison();
    const matrix = comp?.breakdown;
    if (!comp || !matrix) return null;
    const strictOppositionCount = matrix.YES.NO + matrix.NO.YES;
    const abstentionDivergenceCount =
      matrix.YES.ABSTAIN + matrix.NO.ABSTAIN + matrix.ABSTAIN.YES + matrix.ABSTAIN.NO;
    return {
      matrix,
      commonVoteCount: comp.commonVoteCount,
      matchingVoteCount: comp.matchingVoteCount,
      differingVoteCount: comp.differingVoteCount,
      doubleYesCount: matrix.YES.YES,
      doubleNoCount: matrix.NO.NO,
      doubleAbstainCount: matrix.ABSTAIN.ABSTAIN,
      strictOppositionCount,
      abstentionDivergenceCount,
    };
  });
  readonly filteredDivergences = computed(() => {
    const comp = this.activeComparison();
    if (!comp) return [];
    const pair = this.selectedDivergencePair();
    if (!pair) return comp.divergences.slice(0, 12);
    return comp.divergences.filter(
      (item) => item.choiceA === pair.choiceA && item.choiceB === pair.choiceB,
    );
  });
  readonly matchingPoolResolutions = computed(() => {
    const comp = this.activeComparison();
    if (!comp) return [];
    const pair = this.selectedDivergencePair();
    const agreements = comp.agreements ?? [];
    const divergences = comp.divergences ?? [];
    if (pair) {
      const source = pair.choiceA === pair.choiceB ? agreements : divergences;
      return source.filter(
        (item) => item.choiceA === pair.choiceA && item.choiceB === pair.choiceB,
      );
    }
    const tab = this.resolutionTab();
    if (tab === 'agreements') return agreements;
    if (tab === 'divergences') return divergences;
    return [...agreements, ...divergences].sort(
      (a, b) =>
        b.resolution.date.localeCompare(a.resolution.date) ||
        a.resolution.symbol.localeCompare(b.resolution.symbol),
    );
  });
  readonly displayedResolutions = computed(() => {
    const pool = this.matchingPoolResolutions();
    if (this.showAllResolutions() || this.selectedDivergencePair()) {
      return pool;
    }
    const defaultLimit = this.activeComparison()?.search?.trim() ? 25 : 12;
    return pool.slice(0, defaultLimit);
  });

  constructor() {
    this.comparisons
      .pipe(
        switchMap((filters) => {
          this.error.set('');
          this.result.set(null);
          if (!filters) return of(null);
          this.loading.set(true);
          return this.api
            .compare(
              filters.countryA,
              filters.countryB,
              filters.from,
              filters.to,
              filters.theme,
              filters.search.trim(),
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
      .subscribe((result) => this.result.set(result));
    this.trends
      .pipe(
        switchMap((filters) => {
          this.trendError.set('');
          this.trend.set(null);
          if (!filters) return of(null);
          this.trendLoading.set(true);
          return this.api
            .trend(
              filters.countryA,
              filters.countryB,
              filters.from,
              filters.to,
              filters.interval,
              filters.theme,
              filters.search.trim(),
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
    this.focusRequests
      .pipe(
        switchMap((filters) => {
          this.focusedComparison.set(null);
          this.focusError.set('');
          if (!filters) {
            this.focusLoading.set(false);
            return of(null);
          }
          this.focusLoading.set(true);
          return this.api
            .compare(
              filters.countryA,
              filters.countryB,
              filters.from,
              filters.to,
              filters.theme,
              filters.search.trim(),
            )
            .pipe(
              catchError((error: unknown) => {
                this.focusError.set(apiErrorMessage(error));
                return of(null);
              }),
              finalize(() => this.focusLoading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((focused) => this.focusedComparison.set(focused));
    this.loadOptions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.form.patchValue({
        countryA: params.get('countryA') ?? 'FRA',
        countryB: params.get('countryB') ?? 'IND',
        theme: params.get('theme') ?? 'all',
        search: params.get('search') ?? '',
        from: Number(params.get('from') ?? this.period.defaultFrom),
        to: Number(params.get('to') ?? this.period.lastYear),
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
    if (this.form.invalid) {
      this.activeFilters.set(null);
      this.comparisons.next(null);
      this.trends.next(null);
      return;
    }
    const filters = this.form.getRawValue();
    this.activeFilters.set(filters);
    this.selectedDivergencePair.set(null);
    this.showAllResolutions.set(false);
    if (filters.search.trim()) {
      this.resolutionTab.set('agreements');
    }
    this.clearPeriodFocus();
    this.comparisons.next(filters);
    this.trends.next({ ...filters, interval: this.interval() });
  }

  applyKeywordSuggestion(suggestion: KeywordSuggestion): void {
    const patch: Partial<Filters> = {
      search: suggestion.keyword,
      theme: 'all',
    };
    if (suggestion.from !== undefined && suggestion.to !== undefined) {
      patch.from = suggestion.from;
      patch.to = suggestion.to;
    }
    this.form.patchValue(patch);
    this.resolutionTab.set('agreements');
    this.compare();
  }

  clearSearch(): void {
    this.form.patchValue({ search: '' });
    this.compare();
  }

  applyArchiveHint(fromYear: number, toYear: number): void {
    this.form.patchValue({ from: fromYear, to: toYear });
    this.resolutionTab.set('agreements');
    this.compare();
  }

  setResolutionTab(tab: ResolutionTab): void {
    this.selectedDivergencePair.set(null);
    this.showAllResolutions.set(false);
    this.resolutionTab.set(tab);
  }

  refreshTrend(value: string): void {
    if (value !== 'year' && value !== 'decade') return;
    this.interval.set(value);
    this.clearPeriodFocus();
    const filters = this.activeFilters();
    if (!filters) return;
    this.trends.next({ ...filters, interval: value });
  }

  focusTrendYear(year: number): void {
    const filters = this.activeFilters();
    if (!filters) return;
    if (this.focusedYear() === year) {
      this.clearPeriodFocus();
      return;
    }
    const step = this.interval() === 'decade' ? 10 : 1;
    const from = Math.max(filters.from, year);
    const to = Math.min(filters.to, year + step - 1);
    this.focusedYear.set(year);
    this.selectedDivergencePair.set(null);
    this.showAllResolutions.set(false);
    this.focusRequests.next({ ...filters, from, to });
  }

  clearPeriodFocus(): void {
    this.focusedYear.set(null);
    this.focusRequests.next(null);
  }

  toggleDivergencePair(choiceA: ExplicitVoteChoice, choiceB: ExplicitVoteChoice): void {
    const current = this.selectedDivergencePair();
    if (current?.choiceA === choiceA && current.choiceB === choiceB) {
      this.selectedDivergencePair.set(null);
    } else {
      this.selectedDivergencePair.set({ choiceA, choiceB });
      this.resolutionTab.set(choiceA === choiceB ? 'agreements' : 'divergences');
    }
  }

  isPairSelected(choiceA: ExplicitVoteChoice, choiceB: ExplicitVoteChoice): boolean {
    const current = this.selectedDivergencePair();
    return current?.choiceA === choiceA && current.choiceB === choiceB;
  }

  cellKind(
    choiceA: ExplicitVoteChoice,
    choiceB: ExplicitVoteChoice,
  ): 'match' | 'opposition' | 'reserve' {
    if (choiceA === choiceB) return 'match';
    if ((choiceA === 'YES' && choiceB === 'NO') || (choiceA === 'NO' && choiceB === 'YES')) {
      return 'opposition';
    }
    return 'reserve';
  }

  cellKindLabel(choiceA: ExplicitVoteChoice, choiceB: ExplicitVoteChoice): string {
    return {
      match: 'Accord',
      opposition: 'Opposition',
      reserve: 'Réserve',
    }[this.cellKind(choiceA, choiceB)];
  }

  cellPercent(count: number, total: number): number {
    return total > 0 ? (100 * count) / total : 0;
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
}
