import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DataPeriodService, lastCompleteYear } from './data-period.service';
import { DiplomaticApiService } from './diplomatic-api.service';

describe('lastCompleteYear', () => {
  it('ignores a year that is not finished in the data', () => {
    expect(lastCompleteYear('2026-09-17')).toBe(2025);
  });

  it('keeps a year covered until 31 December', () => {
    expect(lastCompleteYear('2025-12-31')).toBe(2025);
  });
});

describe('DataPeriodService', () => {
  function setup(metadata: () => unknown) {
    TestBed.configureTestingModule({
      providers: [{ provide: DiplomaticApiService, useValue: { metadata } }],
    });
    return TestBed.inject(DataPeriodService);
  }

  it('reads the first year and the last complete year from the metadata', () => {
    const period = setup(() => of({ coverage: { from: '1946-01-26', to: '2026-09-17' } }));
    period.load().subscribe();
    expect(period.firstYear).toBe(1946);
    expect(period.lastYear).toBe(2025);
  });

  it('still lets the application start when the API does not answer', () => {
    const period = setup(() => throwError(() => new Error('API indisponible')));
    const done = vi.fn();
    period.load().subscribe({ complete: done });
    expect(done).toHaveBeenCalled();
    expect(Number.isInteger(period.lastYear)).toBe(true);
  });
});
