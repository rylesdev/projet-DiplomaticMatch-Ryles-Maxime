import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { Country } from '../../core/models/api.models';
import {
  CountryGroup,
  GroupAnalysis,
  GroupAnalysisFilters,
  GroupPreviewRequest,
  GroupSuggestions,
  GroupSuggestionsRequest,
} from '../../core/models/groups.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { GroupsApiService, groupErrorMessage } from '../../core/services/groups-api.service';

@Component({
  selector: 'app-group-scenarios',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './group-scenarios.component.html',
  styleUrl: './group-scenarios.component.scss',
})
export class GroupScenariosComponent implements OnChanges {
  @Input({ required: true }) group!: CountryGroup;
  @Input({ required: true }) filters!: GroupAnalysisFilters;
  @Input() baseAnalysis: GroupAnalysis | null = null;
  @Input() disabled = false;
  @Output() applyMembers = new EventEmitter<string[]>();
  @Output() reloadGroup = new EventEmitter<void>();
  private readonly api = inject(GroupsApiService);
  private readonly diplomatic = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scenarios = new Subject<{ id: string; input: GroupPreviewRequest } | null>();
  private readonly suggestionRequests = new Subject<{
    id: string;
    input: GroupSuggestionsRequest;
  } | null>();
  readonly countries = signal<Country[]>([]);
  readonly preview = signal<GroupAnalysis | null>(null);
  readonly suggestions = signal<GroupSuggestions | null>(null);
  readonly loading = signal(false);
  readonly suggesting = signal(false);
  readonly error = signal('');
  readonly suggestionsError = signal('');
  readonly optionsError = signal('');
  readonly includeHistorical = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({ mode: 'add', countryId: '' });

  constructor() {
    this.scenarios
      .pipe(
        switchMap((request) => {
          this.preview.set(null);
          this.error.set('');
          if (!request) return of(null);
          this.loading.set(true);
          return this.api.preview(request.id, request.input).pipe(
            catchError((error: unknown) => {
              this.error.set(groupErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((analysis) => this.preview.set(analysis));
    this.suggestionRequests
      .pipe(
        switchMap((request) => {
          this.suggestions.set(null);
          this.suggestionsError.set('');
          if (!request) return of(null);
          this.suggesting.set(true);
          return this.api.suggestions(request.id, request.input).pipe(
            catchError((error: unknown) => {
              this.suggestionsError.set(groupErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.suggesting.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.suggestions.set(result));
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scenarios.next(null));
    this.form.controls.mode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.countryId.setValue('', { emitEvent: false }));
    this.loadCountries();
  }

  ngOnChanges(): void {
    this.scenarios.next(null);
    this.suggestionRequests.next(null);
    this.form.reset({ mode: 'add', countryId: '' }, { emitEvent: false });
  }

  loadCountries(): void {
    this.optionsError.set('');
    this.diplomatic
      .countries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (countries) => this.countries.set(countries),
        error: (error: unknown) => this.optionsError.set(apiErrorMessage(error)),
      });
  }

  options(): Country[] {
    const ids = new Set(this.group?.memberIds ?? []);
    return this.countries().filter((country) =>
      this.form.controls.mode.value === 'remove' ? ids.has(country.id) : !ids.has(country.id),
    );
  }

  countryName(id: string): string {
    return this.countries().find((country) => country.id === id)?.name ?? id;
  }

  simulate(): void {
    if (this.disabled || !this.group || !this.filters) return;
    const { mode, countryId } = this.form.getRawValue();
    if (!countryId) {
      this.error.set('Choisissez le pays à ajouter ou retirer.');
      return;
    }
    const members =
      mode === 'remove'
        ? this.group.memberIds.filter((id) => id !== countryId)
        : [...this.group.memberIds, countryId];
    if (
      members.length < 2 ||
      members.length > 12 ||
      new Set(members).size !== members.length ||
      (mode === 'remove' && !this.group.memberIds.includes(countryId))
    ) {
      this.error.set('Le scénario doit conserver entre 2 et 12 pays distincts.');
      return;
    }
    this.scenarios.next({
      id: this.group.id,
      input: { ...this.filters, expectedRevision: this.group.revision, memberIds: members },
    });
  }

  requestSuggestions(): void {
    if (this.disabled || !this.group || this.group.memberIds.length >= 12) return;
    this.suggestionRequests.next({
      id: this.group.id,
      input: {
        ...this.filters,
        expectedRevision: this.group.revision,
        includeHistorical: this.includeHistorical(),
      },
    });
  }

  historicalChanged(value: boolean): void {
    const reload = this.suggesting() || this.suggestions() !== null;
    this.includeHistorical.set(value);
    this.suggestionRequests.next(null);
    if (reload) this.requestSuggestions();
  }

  testSuggestion(id: string): void {
    if (this.disabled) return;
    this.form.patchValue({ mode: 'add', countryId: id });
    this.simulate();
  }

  apply(): void {
    const preview = this.preview();
    if (!preview || this.disabled || preview.groupRevision !== this.group.revision) return;
    this.applyMembers.emit([...preview.memberIds]);
  }

  delta(): number | null {
    const before = this.baseAnalysis?.cohesionPercent;
    const after = this.preview()?.cohesionPercent;
    return before === null || before === undefined || after === null || after === undefined
      ? null
      : after - before;
  }
}
