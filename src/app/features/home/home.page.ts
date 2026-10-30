import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { ComparisonResult, Country, DataMetadata } from '../../core/models/api.models';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, DatePipe],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({ countryA: 'FRA', countryB: 'IND' });
  readonly countries = signal<Country[]>([]);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly preview = signal<ComparisonResult | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.preview.set(null);
    forkJoin({
      metadata: this.api.metadata(),
      countries: this.api.countries(),
      preview: this.api.compare('FRA', 'IND', 2000, 2025),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.metadata.set(data.metadata);
          this.countries.set(data.countries);
          this.preview.set(data.preview);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.loading.set(false);
        },
      });
  }
}
