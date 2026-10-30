import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';
import {
  CountryGroup,
  GroupAnalysisFilters,
  GroupSuggestions,
} from '../../core/models/groups.models';
import { GroupSuggestionsService } from '../../core/services/group-suggestions.service';
import { GroupsApiService, groupErrorMessage } from '../../core/services/groups-api.service';

// Pays candidats à ajouter au groupe (API Node). « Tester ce pays » est transmis aux scénarios.
@Component({
  selector: 'app-group-suggestions',
  imports: [DecimalPipe],
  templateUrl: './group-suggestions.component.html',
  styleUrl: './group-suggestions.component.scss',
})
export class GroupSuggestionsComponent implements OnChanges {
  @Input({ required: true }) group!: CountryGroup;
  @Input({ required: true }) filters!: GroupAnalysisFilters;
  @Input() disabled = false;
  // Un scénario est en cours de calcul : « Tester ce pays » attend la fin.
  @Input() testing = false;
  @Output() testCountry = new EventEmitter<string>();
  @Output() reloadGroup = new EventEmitter<void>();
  private readonly groupsApi = inject(GroupsApiService);
  private readonly api = inject(GroupSuggestionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<{
    group: CountryGroup;
    filters: GroupAnalysisFilters;
    includeHistorical: boolean;
  } | null>();
  readonly suggestions = signal<GroupSuggestions | null>(null);
  readonly suggesting = signal(false);
  readonly error = signal('');
  readonly includeHistorical = signal(false);

  constructor() {
    this.requests
      .pipe(
        switchMap((request) => {
          this.suggestions.set(null);
          this.error.set('');
          if (!request) return of(null);
          this.suggesting.set(true);
          // Vérifie d'abord que le groupe n'a pas changé ailleurs, puis interroge l'API Node.
          return this.groupsApi.checkRevision(request.group).pipe(
            switchMap(() =>
              this.api.suggestions(request.group, request.filters, request.includeHistorical),
            ),
            catchError((error: unknown) => {
              this.error.set(groupErrorMessage(error));
              return of(null);
            }),
            finalize(() => this.suggesting.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.suggestions.set(result));
  }

  // Un autre groupe, d'autres filtres ou un groupe en cours de modification effacent la liste ;
  // le simple calcul d'un scénario (testing) la conserve.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['group'] || changes['filters'] || changes['disabled']) this.requests.next(null);
  }

  request(): void {
    if (this.disabled || !this.group || this.group.memberIds.length >= 12) return;
    this.requests.next({
      group: this.group,
      filters: this.filters,
      includeHistorical: this.includeHistorical(),
    });
  }

  historicalChanged(value: boolean): void {
    const reload = this.suggesting() || this.suggestions() !== null;
    this.includeHistorical.set(value);
    this.requests.next(null);
    if (reload) this.request();
  }
}
