import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { Country, DataMetadata } from '../../core/models/api.models';
import { MapExplorerComponent } from '../map/map-explorer.component';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ReactiveFormsModule, DecimalPipe, DatePipe, MapExplorerComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly api = inject(DiplomaticApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group(
    { countryA: 'FRA', countryB: 'IND' },
    {
      validators: (control: AbstractControl) =>
        control.value.countryA !== control.value.countryB ? null : { sameCountry: true },
    },
  );
  readonly countries = signal<Country[]>([]);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly metadataError = signal('');

  constructor() {
    this.loadMetadata();
    this.loadCountries();
  }

  loadMetadata(): void {
    this.metadataError.set('');
    this.api
      .metadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metadata) => this.metadata.set(metadata),
        error: (error: unknown) => this.metadataError.set(apiErrorMessage(error)),
      });
  }

  loadCountries(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .countries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (countries) => {
          this.countries.set(countries);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  compare(): void {
    if (this.loading() || !this.countries().length) return;
    if (this.form.invalid) {
      this.error.set('Choisissez deux pays différents pour les comparer.');
      return;
    }
    this.error.set('');
    void this.router.navigate(['/comparer'], {
      queryParams: { ...this.form.getRawValue(), from: 2000, to: 2025 },
    });
  }
}
