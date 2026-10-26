import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DiplomaticApiService, apiErrorMessage } from '../../core/services/diplomatic-api.service';
import { DataMetadata } from '../../core/models/api.models';

@Component({
  selector: 'app-methodology-page',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './methodology.page.html',
  styles: [
    ':host{display:block}.method-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:24px}.method-grid section{margin-bottom:24px}.method-grid p,.method-grid li{font-size:13px;color:var(--muted)}.method-grid h2{font-size:22px}.formula{font-family:Georgia,serif;font-size:22px;background:var(--accent-light);padding:24px;border-radius:8px;color:var(--accent);margin:22px 0}.method-grid li{margin:12px 0}.source-card a{overflow-wrap:anywhere}.source-card dl>div{border-bottom:1px solid var(--line);padding:12px 0}.source-card dt{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}.source-card dd{margin:4px 0 0;font-size:13px}.source-card .tag{margin-bottom:20px}.method-grid ul{padding-left:20px}@media(max-width:700px){.method-grid{grid-template-columns:1fr}.formula{font-size:19px;padding:18px}}',
  ],
})
export class MethodologyPage {
  private readonly api = inject(DiplomaticApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);
  constructor() {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .metadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metadata) => {
          this.metadata.set(metadata);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(apiErrorMessage(error));
          this.loading.set(false);
        },
      });
  }
}
