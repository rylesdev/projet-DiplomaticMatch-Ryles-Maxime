import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { periodValidator } from '../../core/period.validator';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs';
import { Country, Theme } from '../../core/models/api.models';
import {
  CountryGroup,
  GroupAnalysis,
  GroupAnalysisFilters,
  GroupDraft,
} from '../../core/models/groups.models';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { DataPeriodService, DEFAULT_FROM } from '../../core/services/data-period.service';
import { GroupsApiService, groupErrorMessage } from '../../core/services/groups-api.service';
import { CountryPickerComponent } from '../../shared/country-picker.component';
import { GroupAnalysisViewComponent } from './group-analysis-view.component';
import { GroupScenariosComponent } from './group-scenarios.component';
import { GroupReportsComponent } from './group-reports.component';

// Même règle que le serveur : 2 à 80 caractères une fois les espaces retirés.
const groupNameValidator = (control: AbstractControl) => {
  const length = String(control.value ?? '').trim().length;
  return length >= 2 && length <= 80 ? null : { groupName: true };
};

interface AnalysisRequest {
  group: CountryGroup;
  filters: GroupAnalysisFilters;
}

@Component({
  selector: 'app-groups-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    CountryPickerComponent,
    GroupAnalysisViewComponent,
    GroupScenariosComponent,
    GroupReportsComponent,
  ],
  templateUrl: './groups.page.html',
  styleUrl: './groups.page.scss',
})
export class GroupsPage {
  private readonly period = inject(DataPeriodService);
  private readonly api = inject(GroupsApiService);
  private readonly dataApi = inject(DiplomaticApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listRequests = new BehaviorSubject<void>(undefined);
  private readonly reloadRequests = new Subject<void>();
  private readonly selectionChanges = new Subject<void>();
  private readonly analysisRequests = new Subject<AnalysisRequest | null>();
  private readonly formBuilder = inject(FormBuilder);
  readonly groups = signal<CountryGroup[]>([]);
  readonly group = signal<CountryGroup | null>(null);
  readonly countries = signal<Country[]>([]);
  readonly themes = signal<Theme[]>([]);
  readonly memberIds = signal<string[]>([]);
  readonly listLoading = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly reportSaving = signal(false);
  readonly analysisLoading = signal(false);
  readonly listError = signal('');
  readonly loadError = signal('');
  readonly optionsError = signal('');
  readonly actionError = signal('');
  readonly analysisError = signal('');
  readonly notice = signal('');
  readonly conflict = signal(false);
  readonly deleteConfirmation = signal(false);
  readonly submitted = signal(false);
  readonly analysis = signal<GroupAnalysis | null>(null);
  readonly appliedFilters = signal<GroupAnalysisFilters | null>(null);
  readonly reportRefresh = signal(0);
  readonly busy = computed(() => this.saving() || this.deleting() || this.reportSaving());
  readonly editor = this.formBuilder.nonNullable.group({
    name: ['', groupNameValidator],
    description: ['', Validators.maxLength(500)],
  });
  private readonly editorValue = toSignal(
    this.editor.valueChanges.pipe(startWith(this.editor.getRawValue())),
    { initialValue: this.editor.getRawValue() },
  );
  readonly draft = computed<GroupDraft>(() => ({
    name: this.editorValue().name ?? '',
    description: this.editorValue().description ?? '',
    memberIds: this.memberIds(),
  }));
  readonly dirty = computed(() => {
    const saved = this.group();
    const draft = this.draft();
    return saved
      ? draft.name !== saved.name ||
          draft.description !== saved.description ||
          draft.memberIds.join('\0') !== saved.memberIds.join('\0')
      : Boolean(draft.name || draft.description || draft.memberIds.length);
  });
  readonly filters = this.formBuilder.nonNullable.group(
    {
      from: [DEFAULT_FROM, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      to: [this.period.lastYear, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      theme: ['all', Validators.required],
      minVotes: [20, [Validators.required, Validators.min(1), Validators.max(100000)]],
    },
    { validators: periodValidator },
  );

  constructor() {
    this.listRequests
      .pipe(
        switchMap(() => {
          this.listLoading.set(true);
          this.listError.set('');
          return this.api.getGroups().pipe(
            catchError((error: unknown) => {
              this.listError.set(groupErrorMessage(error));
              return of([]);
            }),
            finalize(() => this.listLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((groups) => this.groups.set(groups));
    this.analysisRequests
      .pipe(
        switchMap((request) => {
          this.analysis.set(null);
          this.appliedFilters.set(null);
          if (!request) return of(null);
          this.analysisLoading.set(true);
          this.analysisError.set('');
          return this.api
            .preview(request.group.id, {
              ...request.filters,
              expectedRevision: request.group.revision,
            })
            .pipe(
              catchError((error: unknown) => {
                this.handleError(error, this.analysisError);
                return of(null);
              }),
              finalize(() => this.analysisLoading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((analysis) => {
        this.analysis.set(analysis);
        this.appliedFilters.set(analysis?.filters ?? null);
      });
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
      ),
      this.reloadRequests.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([id]) => {
          this.resetSelection();
          if (!id) return of(null);
          this.loading.set(true);
          return this.api.getGroup(id).pipe(
            catchError((error: unknown) => {
              this.loadError.set(groupErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((group) => {
        if (group) this.acceptGroup(group);
      });
    this.editor.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearAnalysis());
    this.loadOptions();
  }

  reloadGroups(): void {
    this.listRequests.next();
  }
  reloadGroup(): void {
    this.reloadRequests.next();
  }
  loadOptions(): void {
    this.optionsError.set('');
    forkJoin({ countries: this.dataApi.countries(), themes: this.dataApi.themes() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ countries, themes }) => {
          this.countries.set(countries);
          this.themes.set(themes);
        },
        error: (error: unknown) => this.optionsError.set(apiErrorMessage(error)),
      });
  }
  startNew(): void {
    this.resetSelection();
    void this.router.navigate(['/groupes']);
  }
  changeMembers(ids: string[]): void {
    this.memberIds.set(ids);
    this.clearAnalysis();
  }
  save(): void {
    this.submitted.set(true);
    this.editor.markAllAsTouched();
    const draft = this.draft();
    if (
      this.busy() ||
      this.conflict() ||
      this.editor.invalid ||
      draft.memberIds.length < 2 ||
      draft.memberIds.length > 12
    )
      return;
    const saved = this.group();
    this.saving.set(true);
    this.actionError.set('');
    this.notice.set('');
    const request = saved
      ? this.api.updateGroup(saved.id, draft, saved.revision)
      : this.api.createGroup(draft);
    request
      .pipe(
        takeUntil(this.selectionChanges),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (group) => {
          this.acceptGroup(group);
          this.reloadGroups();
          this.notice.set('Le groupe a été enregistré.');
          if (!saved) void this.router.navigate(['/groupes', group.id]);
        },
        error: (error: unknown) => this.handleError(error, this.actionError),
      });
  }
  remove(): void {
    const group = this.group();
    if (!group || this.busy() || this.conflict()) return;
    this.deleting.set(true);
    this.actionError.set('');
    this.api
      .deleteGroup(group.id, group.revision)
      .pipe(
        takeUntil(this.selectionChanges),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deleting.set(false)),
      )
      .subscribe({
        next: () => {
          this.resetSelection();
          this.reloadGroups();
          void this.router.navigate(['/groupes']);
        },
        error: (error: unknown) => this.handleError(error, this.actionError),
      });
  }
  analyze(): void {
    const group = this.group();
    this.filters.markAllAsTouched();
    if (!group || this.busy() || this.dirty() || this.conflict()) return;
    if (this.filters.invalid) {
      this.analysisRequests.next(null);
      this.analysisError.set(
        'Choisissez une période valide, des années entières et un seuil de votes valide.',
      );
      return;
    }
    this.analysisRequests.next({ group, filters: this.filters.getRawValue() });
  }
  hasUnappliedFilters(): boolean {
    const applied = this.appliedFilters();
    const current = this.filters.getRawValue();
    return (
      !applied ||
      Object.keys(current).some(
        (key) =>
          current[key as keyof GroupAnalysisFilters] !== applied[key as keyof GroupAnalysisFilters],
      )
    );
  }
  saveReport(): void {
    const group = this.group();
    const filters = this.appliedFilters();
    if (
      !group ||
      !filters ||
      this.busy() ||
      this.dirty() ||
      this.conflict() ||
      this.hasUnappliedFilters()
    )
      return;
    this.reportSaving.set(true);
    this.actionError.set('');
    this.notice.set('');
    this.api
      .saveReport(group.id, { ...filters, expectedRevision: group.revision })
      .pipe(
        takeUntil(this.selectionChanges),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.reportSaving.set(false)),
      )
      .subscribe({
        next: () => {
          this.reportRefresh.update((key) => key + 1);
          this.notice.set(
            'Le rapport a été enregistré avec sa composition, sa méthode et sa version de données.',
          );
        },
        error: (error: unknown) => this.handleError(error, this.actionError),
      });
  }
  applyMembers(memberIds: string[]): void {
    const group = this.group();
    if (!group || this.busy() || this.dirty() || this.conflict()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.api
      .updateGroup(
        group.id,
        { name: group.name, description: group.description, memberIds },
        group.revision,
      )
      .pipe(
        takeUntil(this.selectionChanges),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.reloadGroups();
          this.reloadGroup();
        },
        error: (error: unknown) => this.handleError(error, this.actionError),
      });
  }
  themeLabel(id: string): string {
    return this.themes().find((theme) => theme.id === id)?.label ?? id;
  }
  private acceptGroup(group: CountryGroup): void {
    this.group.set(group);
    this.editor.setValue({ name: group.name, description: group.description });
    this.memberIds.set([...group.memberIds]);
    this.editor.markAsPristine();
    this.submitted.set(false);
    this.conflict.set(false);
    this.deleteConfirmation.set(false);
    this.clearAnalysis();
  }
  private clearAnalysis(): void {
    this.analysisRequests.next(null);
    this.analysisError.set('');
  }
  private resetSelection(): void {
    this.selectionChanges.next();
    this.group.set(null);
    this.memberIds.set([]);
    this.editor.reset({ name: '', description: '' });
    this.conflict.set(false);
    this.deleteConfirmation.set(false);
    this.submitted.set(false);
    this.loadError.set('');
    this.actionError.set('');
    this.notice.set('');
    this.clearAnalysis();
  }
  private handleError(error: unknown, target: { set: (message: string) => void }): void {
    if (error instanceof HttpErrorResponse && error.status === 409) this.conflict.set(true);
    target.set(groupErrorMessage(error));
  }
}
