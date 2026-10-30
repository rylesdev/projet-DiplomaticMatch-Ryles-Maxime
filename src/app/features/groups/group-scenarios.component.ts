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
import { CountryGroup, GroupAnalysis, GroupAnalysisFilters } from '../../core/models/groups.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { GroupAnalysisService } from '../../core/services/group-analysis.service';
import { GroupsApiService, groupErrorMessage } from '../../core/services/groups-api.service';
import { GroupSuggestionsComponent } from './group-suggestions.component';

interface ScenarioRequest {
  group: CountryGroup;
  filters: GroupAnalysisFilters;
  memberIds: string[];
}

// Simule l'ajout ou le retrait d'un pays : l'API Node analyse la composition proposée,
// sans rien enregistrer. Seul « Appliquer au groupe » modifie le groupe (API mockée).
@Component({
  selector: 'app-group-scenarios',
  imports: [ReactiveFormsModule, DecimalPipe, GroupSuggestionsComponent],
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
  private readonly groupsApi = inject(GroupsApiService);
  private readonly analysisApi = inject(GroupAnalysisService);
  private readonly diplomatic = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scenarios = new Subject<ScenarioRequest | null>();
  readonly countries = signal<Country[]>([]);
  readonly preview = signal<GroupAnalysis | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly optionsError = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({ mode: 'add', countryId: '' });

  constructor() {
    this.scenarios
      .pipe(
        switchMap((request) => {
          this.preview.set(null);
          this.error.set('');
          if (!request) return of(null);
          this.loading.set(true);
          // Vérifie la version enregistrée (Mirage), puis analyse la composition proposée (API Node).
          return this.groupsApi.checkRevision(request.group).pipe(
            switchMap(() =>
              this.analysisApi.analyze(request.group, request.filters, request.memberIds),
            ),
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
    this.scenarios.next({ group: this.group, filters: this.filters, memberIds: members });
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
