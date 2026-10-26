import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, finalize, of, startWith, Subject, switchMap } from 'rxjs';
import { DataMetadata, ResolutionDetail, VoteChoice } from '../../core/models/api.models';
import { apiErrorMessage, DiplomaticApiService } from '../../core/services/diplomatic-api.service';

@Component({
  selector: 'app-resolution-detail-page',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './resolution-detail.page.html',
  styleUrl: './resolution-detail.page.scss',
})
export class ResolutionDetailPage {
  private readonly api = inject(DiplomaticApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly retries = new Subject<void>();
  readonly resolution = signal<ResolutionDetail | null>(null);
  readonly metadata = signal<DataMetadata | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.api
      .metadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (value) => this.metadata.set(value), error: () => undefined });
    combineLatest([this.route.paramMap, this.retries.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params]) => {
          const id = params.get('id');
          this.resolution.set(null);
          this.error.set('');
          if (!id) {
            this.error.set('Sélectionnez une résolution depuis les archives.');
            return of(null);
          }
          this.loading.set(true);
          return this.api.resolution(id).pipe(
            catchError((error: unknown) => {
              this.error.set(apiErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.resolution.set(value));
  }

  reload(): void {
    this.retries.next();
  }
  voteLabel(choice: VoteChoice): string {
    return {
      YES: 'Pour',
      NO: 'Contre',
      ABSTAIN: 'Abstention',
      NOT_VOTED: 'Non-vote',
      UNKNOWN: 'Inconnu',
    }[choice];
  }
  voteClass(choice: VoteChoice): string {
    return {
      YES: 'tag-yes',
      NO: 'tag-no',
      ABSTAIN: 'tag-abstain',
      NOT_VOTED: 'tag-missing',
      UNKNOWN: 'tag-missing',
    }[choice];
  }
}
