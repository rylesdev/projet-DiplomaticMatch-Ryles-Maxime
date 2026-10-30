import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { Country, Theme } from '../../core/models/api.models';
import {
  TradeComparison,
  TradeFilters,
  TradeMetadata,
  TradePartners,
  TradePoint,
} from '../../core/models/trade.models';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { TradeApiService } from '../../core/services/trade-api.service';

const periodValidator = (control: AbstractControl) => {
  const { countryA, countryB, from, to, minVotes } = control.value;
  if (countryA === countryB) return { sameCountry: true };
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return { period: true };
  if (!Number.isInteger(minVotes)) return { threshold: true };
  return null;
};

export function csvCell(value: unknown): string {
  let result = value === null || value === undefined ? '' : String(value);
  if (/^[\s]*[=+@]/.test(result) || (typeof value === 'string' && /^[\s]*-/.test(result)))
    result = `'${result}`;
  return `"${result.replace(/"/g, '""')}"`;
}

export function chartSegments<T>(
  points: T[],
  coordinate: (point: T, index: number) => string | null,
): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    const value = coordinate(point, index);
    if (value === null) {
      if (current.length) segments.push(current.join(' '));
      current = [];
    } else current.push(value);
  });
  if (current.length) segments.push(current.join(' '));
  return segments;
}

@Component({
  selector: 'app-trade-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, DatePipe],
  templateUrl: './trade.page.html',
  styleUrl: './trade.page.scss',
})
export class TradePage {
  private readonly api = inject(TradeApiService);
  private readonly diplomatic = inject(DiplomaticApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<TradeFilters>();
  private readonly partnerRequests = new Subject<{ filters: TradeFilters; year: number } | null>();
  private routeSubscribed = false;
  readonly countries = signal<Country[]>([]);
  readonly themes = signal<Theme[]>([]);
  readonly metadata = signal<TradeMetadata | null>(null);
  readonly result = signal<TradeComparison | null>(null);
  readonly partners = signal<TradePartners | null>(null);
  readonly active = signal<TradeFilters | null>(null);
  readonly loading = signal(false);
  readonly partnersLoading = signal(false);
  readonly optionsLoading = signal(false);
  readonly error = signal('');
  readonly partnersError = signal('');
  readonly optionsError = signal('');
  readonly submitted = signal(false);
  readonly partnerYear = signal(2024);
  readonly highlightedPartner = signal<string | null>(null);
  readonly showAllPartners = signal(false);
  readonly thresholds = [1, 5, 10, 20, 50];
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      countryA: ['FRA', Validators.required],
      countryB: ['IND', Validators.required],
      from: [2000, [Validators.required, Validators.min(1900), Validators.max(2100)]],
      to: [2024, [Validators.required, Validators.min(1900), Validators.max(2100)]],
      theme: ['all', Validators.required],
      minVotes: [20, [Validators.required, Validators.min(1), Validators.max(100000)]],
    },
    { validators: periodValidator },
  );
  readonly latest = computed(() => this.result()?.summary.latest ?? null);
  readonly hasTrade = computed(
    () =>
      this.result()?.points.some((p) => p.exportsAtoB !== null || p.exportsBtoA !== null) ?? false,
  );
  readonly maxTrade = computed(() =>
    Math.max(
      1,
      ...(this.result()?.points.flatMap((p) => [p.exportsAtoB ?? 0, p.exportsBtoA ?? 0]) ?? []),
    ),
  );
  readonly plots = computed(() =>
    (this.result()?.points ?? []).map((p, i, all) => ({
      ...p,
      x: this.x(i, all.length),
      aY: p.exportsAtoB === null ? null : 190 - (p.exportsAtoB / this.maxTrade()) * 145,
      bY: p.exportsBtoA === null ? null : 190 - (p.exportsBtoA / this.maxTrade()) * 145,
      voteY: p.agreementPercent === null ? null : 170 - p.agreementPercent * 1.3,
    })),
  );
  readonly aSegments = computed(() =>
    chartSegments(this.plots(), (p) => (p.aY === null ? null : `${p.x},${p.aY}`)),
  );
  readonly bSegments = computed(() =>
    chartSegments(this.plots(), (p) => (p.bY === null ? null : `${p.x},${p.bY}`)),
  );
  readonly voteSegments = computed(() =>
    chartSegments(this.plots(), (p) => (p.voteY === null ? null : `${p.x},${p.voteY}`)),
  );
  readonly yearTicks = computed(() => {
    const points = this.plots();
    const step = Math.max(1, Math.ceil((points.length - 1) / 5));
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  });
  readonly years = computed(() => {
    const filters = this.active();
    return filters
      ? Array.from({ length: filters.to - filters.from + 1 }, (_, i) => filters.from + i)
      : [];
  });
  readonly scatterPoints = computed(() => {
    const eligible = (this.partners()?.partners ?? []).filter(
      (p) => p.totalTrade !== null && p.agreementPercent !== null,
    );
    const max = Math.max(1, ...eligible.map((p) => p.totalTrade!));
    return eligible.map((p) => ({
      ...p,
      x: 68 + (Math.log1p(p.totalTrade!) / Math.log1p(max)) * 770,
      y: 235 - p.agreementPercent! * 1.9,
    }));
  });
  readonly scatterMax = computed(() =>
    Math.max(1, ...this.scatterPoints().map((p) => p.totalTrade!)),
  );
  readonly scatterTicks = computed(() =>
    [0, 1e3, 1e6, 1e9, 1e12]
      .filter((v) => v <= this.scatterMax())
      .map((value) => ({
        value,
        x: 68 + (Math.log1p(value) / Math.log1p(this.scatterMax())) * 770,
      })),
  );
  readonly highlighted = computed(
    () => this.scatterPoints().find((p) => p.country.id === this.highlightedPartner()) ?? null,
  );
  readonly visiblePartners = computed(() =>
    this.showAllPartners()
      ? (this.partners()?.partners ?? [])
      : (this.partners()?.partners ?? []).slice(0, 10),
  );

  constructor() {
    this.requests
      .pipe(
        switchMap((filters) => {
          this.loading.set(true);
          this.error.set('');
          this.result.set(null);
          return this.api.compare(filters).pipe(
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
    this.partnerRequests
      .pipe(
        switchMap((request) => {
          this.partners.set(null);
          this.partnersError.set('');
          this.highlightedPartner.set(null);
          if (!request) {
            this.partnersLoading.set(false);
            return of(null);
          }
          this.partnersLoading.set(true);
          return this.api
            .partners(
              request.filters.countryA,
              request.year,
              request.filters.theme,
              request.filters.minVotes,
            )
            .pipe(
              catchError((error: unknown) => {
                this.partnersError.set(apiErrorMessage(error));
                return of(null);
              }),
              finalize(() => this.partnersLoading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.partners.set(result));
    this.loadOptions();
  }

  loadOptions(): void {
    this.optionsLoading.set(true);
    this.optionsError.set('');
    forkJoin({
      metadata: this.api.metadata(),
      countries: this.diplomatic.countries(),
      themes: this.diplomatic.themes(),
    })
      .pipe(
        finalize(() => this.optionsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ metadata, countries, themes }) => {
          this.metadata.set(metadata);
          this.countries.set(countries);
          this.themes.set(themes);
          if (!this.routeSubscribed) {
            this.routeSubscribed = true;
            this.route.queryParamMap
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe((params) => {
                this.form.setValue({
                  countryA: params.get('countryA') ?? 'FRA',
                  countryB: params.get('countryB') ?? 'IND',
                  from: Number(params.get('from') ?? Math.max(metadata.coverage.from, 2000)),
                  to: Number(params.get('to') ?? metadata.coverage.to),
                  theme: params.get('theme') ?? 'all',
                  minVotes: Number(params.get('minVotes') ?? 20),
                });
                this.run(false);
              });
          }
        },
        error: (error: unknown) => this.optionsError.set(apiErrorMessage(error)),
      });
  }

  run(updateUrl = true): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    const filters = this.form.getRawValue();
    const prior = this.active();
    this.active.set(filters);
    if (updateUrl || !prior || JSON.stringify(prior) !== JSON.stringify(filters))
      this.requests.next(filters);
    const partnerContextChanged =
      !prior ||
      prior.countryA !== filters.countryA ||
      prior.from !== filters.from ||
      prior.to !== filters.to ||
      prior.theme !== filters.theme ||
      prior.minVotes !== filters.minVotes;
    if (partnerContextChanged) {
      const end = Math.min(filters.to, this.metadata()?.coverage.to ?? filters.to);
      this.partnerYear.set(Math.max(filters.from, end));
      this.showAllPartners.set(false);
      this.refreshPartners();
    }
    if (updateUrl)
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: filters,
        replaceUrl: true,
      });
  }

  retryComparison(): void {
    const filters = this.active();
    if (!filters) return;
    this.requests.next(filters);
  }
  refreshPartners(): void {
    const filters = this.active();
    this.partnerRequests.next(filters ? { filters, year: this.partnerYear() } : null);
  }
  changePartnerYear(event: Event): void {
    this.partnerYear.set(Number((event.target as HTMLSelectElement).value));
    this.refreshPartners();
  }
  choosePartner(id: string): void {
    const filters = this.active();
    if (!filters || id === filters.countryA) return;
    this.form.patchValue({ ...filters, countryB: id });
    this.run();
  }
  x(index: number, length: number): number {
    return length === 1 ? 453 : 68 + (index / (length - 1)) * 770;
  }
  money(value: number | null, full = false, status?: string | null): string {
    if (value === null) return '—';
    return (
      new Intl.NumberFormat('fr-FR', {
        notation: full ? 'standard' : 'compact',
        maximumFractionDigits: full ? 0 : 2,
      }).format(value) +
      ' $' +
      (status === 'e' ? ' *' : '')
    );
  }
  themeLabel(id: string): string {
    return this.themes().find((t) => t.id === id)?.label ?? id;
  }
  pointDescription(point: TradePoint): string {
    const result = this.result();
    return `${point.year} : ${result?.countryA.name} → ${result?.countryB.name} ${this.money(point.exportsAtoB, true, point.statusAtoB)} ; sens inverse ${this.money(point.exportsBtoA, true, point.statusBtoA)} ; accord ONU ${point.agreementPercent === null ? 'non disponible' : point.agreementPercent.toFixed(1) + ' %'} (${point.commonVoteCount} votes).`;
  }
  exportCsv(): void {
    const result = this.result();
    if (!result) return;
    const rows: unknown[][] = [
      [
        'source_commerce',
        'version_commerce',
        'date_extraction',
        'pays_A',
        'pays_B',
        'annee',
        'exports_A_vers_B_USD_courants_FOB',
        'exports_B_vers_A_USD_courants_FOB',
        'total_deux_sens_USD_courants_FOB',
        'ecart_flux_FOB_A_USD_courants',
        'accord_ONU_pourcent',
        'votes_communs',
        'theme_votes',
        'seuil_votes',
        'derivation_A_vers_B',
        'derivation_B_vers_A',
        'statut_A_vers_B',
        'statut_B_vers_A',
        'source_votes',
        'version_votes',
      ],
    ];
    result.points.forEach((p) =>
      rows.push([
        result.metadata.sourceUrl,
        result.metadata.version,
        result.metadata.retrievedAt,
        result.countryA.name,
        result.countryB.name,
        p.year,
        p.exportsAtoB,
        p.exportsBtoA,
        p.totalTrade,
        p.balanceA,
        p.agreementPercent,
        p.commonVoteCount,
        result.theme,
        result.minVotes,
        p.derivationAtoB ?? '',
        p.derivationBtoA ?? '',
        p.statusAtoB ?? '',
        p.statusBtoA ?? '',
        'https://digitallibrary.un.org/record/4060887',
        result.voteDataVersion ?? '',
      ]),
    );
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `commerce-${result.countryA.id}-${result.countryB.id}-${result.from}-${result.to}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
