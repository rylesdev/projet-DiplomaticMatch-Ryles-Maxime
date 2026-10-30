import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, Input, OnChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { Theme } from '../../core/models/api.models';
import { GroupReport, GroupReportSummary } from '../../core/models/groups.models';
import { DiplomaticApiService } from '../../core/services/diplomatic-api.service';
import { GroupReportsService } from '../../core/services/group-reports.service';
import { groupErrorMessage } from '../../core/services/groups-api.service';
import { GroupAnalysisViewComponent } from './group-analysis-view.component';

@Component({
  selector: 'app-group-reports',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, GroupAnalysisViewComponent],
  templateUrl: './group-reports.component.html',
  styleUrl: './group-reports.component.scss',
})
export class GroupReportsComponent implements OnChanges {
  @Input({ required: true }) groupId = '';
  @Input() refreshKey = 0;
  private readonly api = inject(GroupReportsService);
  private readonly diplomatic = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lists = new Subject<string>();
  private readonly selections = new Subject<{ groupId: string; a: string; b: string } | null>();
  readonly reports = signal<GroupReportSummary[]>([]);
  readonly themes = signal<Theme[]>([]);
  readonly first = signal<GroupReport | null>(null);
  readonly second = signal<GroupReport | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly detailError = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({ first: '', second: '' });

  constructor() {
    this.lists
      .pipe(
        switchMap((id) => {
          this.loading.set(true);
          this.error.set('');
          this.reports.set([]);
          this.selections.next(null);
          return this.api.reports(id).pipe(
            catchError((error: unknown) => {
              this.error.set(groupErrorMessage(error));
              return of([]);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((reports) => {
        this.reports.set(reports);
        this.form.patchValue(
          {
            first: reports[1]?.id ?? reports[0]?.id ?? '',
            second: reports.length > 1 ? reports[0].id : '',
          },
          { emitEvent: false },
        );
        this.loadSelected();
      });
    this.selections
      .pipe(
        switchMap((selection) => {
          this.first.set(null);
          this.second.set(null);
          this.detailError.set('');
          if (!selection?.a) return of(null);
          this.detailLoading.set(true);
          return forkJoin({
            first: this.api.report(selection.groupId, selection.a),
            second:
              selection.b && selection.b !== selection.a
                ? this.api.report(selection.groupId, selection.b)
                : of(null),
          }).pipe(
            catchError((error: unknown) => {
              this.detailError.set(groupErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.detailLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.first.set(result?.first ?? null);
        this.second.set(result?.second ?? null);
      });
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSelected());
    this.diplomatic
      .themes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (themes) => this.themes.set(themes), error: () => undefined });
  }

  ngOnChanges(): void {
    this.reload();
  }
  reload(): void {
    if (this.groupId) this.lists.next(this.groupId);
  }
  loadSelected(): void {
    const { first, second } = this.form.getRawValue();
    this.selections.next(
      this.groupId && first ? { groupId: this.groupId, a: first, b: second } : null,
    );
  }
  label(id: string): string {
    return this.themes().find((theme) => theme.id === id)?.label ?? id;
  }
  comparable(): boolean {
    const a = this.first()?.analysis;
    const b = this.second()?.analysis;
    if (!a || !b) return false;
    return (
      a.filters.from === b.filters.from &&
      a.filters.to === b.filters.to &&
      a.filters.theme === b.filters.theme &&
      a.filters.minVotes === b.filters.minVotes &&
      a.dataVersion === b.dataVersion &&
      a.methodVersion === b.methodVersion &&
      a.themeClassificationVersion === b.themeClassificationVersion
    );
  }
  delta(): number | null {
    const a = this.first()?.analysis.cohesionPercent;
    const b = this.second()?.analysis.cohesionPercent;
    return !this.comparable() || a === null || a === undefined || b === null || b === undefined
      ? null
      : b - a;
  }
}
