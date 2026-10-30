import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { periodValidator } from '../../core/period.validator';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { ConcordanceMatrix, Theme } from '../../core/models/api.models';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { DataPeriodService, DEFAULT_FROM } from '../../core/services/data-period.service';
import { concordanceColor } from './matrix-colors';

interface MatrixFilters {
  from: number;
  to: number;
  minVotes: number;
  theme: string;
}

@Component({
  selector: 'app-matrix-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  templateUrl: './matrix.page.html',
  styleUrl: './matrix.page.scss',
})
export class MatrixPage implements AfterViewInit {
  private readonly period = inject(DataPeriodService);
  private readonly api = inject(DiplomaticApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<MatrixFilters>();
  @ViewChild('heatmap') private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport') private viewport?: ElementRef<HTMLDivElement>;
  private readonly viewReady = signal(false);
  readonly data = signal<ConcordanceMatrix | null>(null);
  readonly themes = signal<Theme[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly optionsError = signal('');
  readonly cellSize = signal(4);
  readonly activeRow = signal(0);
  readonly activeColumn = signal(0);
  readonly labelWidth = 140;
  readonly headerHeight = 62;
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      from: [DEFAULT_FROM, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      to: [this.period.lastYear, [Validators.required, Validators.min(1946), Validators.max(2100)]],
      minVotes: [20, [Validators.required, Validators.min(1), Validators.max(100000)]],
      theme: ['all', Validators.required],
    },
    { validators: periodValidator },
  );
  readonly focus = inject(FormBuilder).nonNullable.group({ row: 'FRA', column: 'IND' });
  readonly plotSize = computed(() => (this.data()?.countries.length ?? 0) * this.cellSize());
  readonly selected = computed(() => {
    const data = this.data();
    if (!data || !data.countries.length) return null;
    const row = this.activeRow();
    const column = this.activeColumn();
    return {
      a: data.countries[row],
      b: data.countries[column],
      row,
      column,
      percentage: data.agreementPercents[row][column],
      common: data.commonVoteCounts[row][column],
      matching: data.matchingVoteCounts[row][column],
    };
  });
  readonly selectedText = computed(() => {
    const cell = this.selected();
    if (!cell) return 'Sélectionnez une paire de pays.';
    const rate =
      cell.percentage === null
        ? cell.common
          ? 'seuil non atteint'
          : 'aucun vote commun'
        : `${cell.percentage.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de concordance`;
    return `${cell.a.name} et ${cell.b.name} : ${rate}, ${cell.common} votes comparables.`;
  });
  readonly usablePairs = computed(() => {
    const data = this.data();
    if (!data) return 0;
    let count = 0;
    for (let row = 0; row < data.countries.length; row++)
      for (let column = row + 1; column < data.countries.length; column++)
        if (data.agreementPercents[row][column] !== null) count++;
    return count;
  });
  readonly selectedTheme = computed(() =>
    this.themes().find((theme) => theme.id === this.data()?.theme),
  );

  constructor() {
    this.requests
      .pipe(
        switchMap((filters) => {
          this.loading.set(true);
          this.error.set('');
          return this.api.matrix(filters.from, filters.to, filters.minVotes, filters.theme).pipe(
            catchError((error: unknown) => {
              this.error.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.data.set(data);
        if (data?.countries.length) {
          this.selectCell(
            Math.max(
              0,
              data.countries.findIndex((country) => country.id === this.focus.controls.row.value),
            ),
            Math.max(
              0,
              data.countries.findIndex(
                (country) => country.id === this.focus.controls.column.value,
              ),
            ),
          );
        }
      });
    effect(() => {
      const data = this.data();
      const size = this.cellSize();
      if (this.viewReady())
        setTimeout(() => {
          if (!this.destroyRef.destroyed && this.data() === data && this.cellSize() === size)
            this.draw(data, size);
        });
    });
    this.loadThemes();
    this.apply();
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  loadThemes(): void {
    this.optionsError.set('');
    this.api
      .themes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (themes) => this.themes.set(themes),
        error: (error: unknown) => this.optionsError.set(apiErrorMessage(error)),
      });
  }

  apply(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        'Choisissez une période dans l’ordre, avec des années entières et un minimum de votes valide.',
      );
      return;
    }
    this.requests.next(this.form.getRawValue());
  }

  private draw(data: ConcordanceMatrix | null, size: number): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas || !data) return;
    const dimension = data.countries.length * size;
    canvas.width = dimension;
    canvas.height = dimension;
    const context = canvas.getContext('2d');
    if (!context) return;
    const gap = size >= 10 ? 1 : 0;
    for (let row = 0; row < data.countries.length; row++) {
      for (let column = 0; column < data.countries.length; column++) {
        context.fillStyle = concordanceColor(data.agreementPercents[row][column]);
        context.fillRect(column * size, row * size, size - gap, size - gap);
      }
    }
  }

  selectCell(row: number, column: number): void {
    const data = this.data();
    if (!data?.countries.length) return;
    const last = data.countries.length - 1;
    const selectedRow = Math.max(0, Math.min(last, row));
    const selectedColumn = Math.max(0, Math.min(last, column));
    this.activeRow.set(selectedRow);
    this.activeColumn.set(selectedColumn);
    this.focus.patchValue(
      { row: data.countries[selectedRow].id, column: data.countries[selectedColumn].id },
      { emitEvent: false },
    );
  }

  inspectPair(): void {
    const data = this.data();
    if (!data) return;
    this.selectCell(
      data.countries.findIndex((country) => country.id === this.focus.controls.row.value),
      data.countries.findIndex((country) => country.id === this.focus.controls.column.value),
    );
    this.revealCell();
  }

  point(event: MouseEvent): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    this.selectCell(
      Math.floor((event.clientY - bounds.top) / this.cellSize()),
      Math.floor((event.clientX - bounds.left) / this.cellSize()),
    );
  }

  openComparison(): void {
    const data = this.data();
    const cell = this.selected();
    if (!data || !cell || cell.a.id === cell.b.id) return;
    void this.router.navigate(['/comparer'], {
      queryParams: {
        countryA: cell.a.id,
        countryB: cell.b.id,
        from: data.from,
        to: data.to,
        theme: data.theme,
      },
    });
  }

  onKey(event: KeyboardEvent): void {
    let row = this.activeRow();
    let column = this.activeColumn();
    const last = (this.data()?.countries.length ?? 1) - 1;
    switch (event.key) {
      case 'ArrowDown':
        row++;
        break;
      case 'ArrowUp':
        row--;
        break;
      case 'ArrowRight':
        column++;
        break;
      case 'ArrowLeft':
        column--;
        break;
      case 'Home':
        column = 0;
        if (event.ctrlKey) row = 0;
        break;
      case 'End':
        column = last;
        if (event.ctrlKey) row = last;
        break;
      case 'PageDown':
        row += 20;
        break;
      case 'PageUp':
        row -= 20;
        break;
      case 'Enter':
        event.preventDefault();
        this.openComparison();
        return;
      default:
        return;
    }
    event.preventDefault();
    this.selectCell(row, column);
    this.revealCell();
  }

  private revealCell(): void {
    const viewport = this.viewport?.nativeElement;
    if (!viewport) return;
    const x = this.activeColumn() * this.cellSize();
    const y = this.activeRow() * this.cellSize();
    if (x < viewport.scrollLeft) viewport.scrollLeft = x;
    else if (x + this.cellSize() > viewport.scrollLeft + viewport.clientWidth - this.labelWidth)
      viewport.scrollLeft = x + this.cellSize() - viewport.clientWidth + this.labelWidth;
    if (y < viewport.scrollTop) viewport.scrollTop = y;
    else if (y + this.cellSize() > viewport.scrollTop + viewport.clientHeight - this.headerHeight)
      viewport.scrollTop = y + this.cellSize() - viewport.clientHeight + this.headerHeight;
  }

  showLabel(index: number, active: number): boolean {
    return (
      this.cellSize() >= 10 || index === active || (Math.abs(index - active) > 2 && index % 5 === 0)
    );
  }
}
