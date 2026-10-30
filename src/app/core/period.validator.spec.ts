import { FormControl, FormGroup } from '@angular/forms';
import { periodValidator } from './period.validator';

function errors(values: Record<string, unknown>) {
  const controls = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, new FormControl(value)]),
  );
  return periodValidator(new FormGroup(controls));
}

describe('periodValidator', () => {
  it('accepts whole years in order, including a single year', () => {
    expect(errors({ from: 2000, to: 2025 })).toBeNull();
    expect(errors({ from: 2010, to: 2010 })).toBeNull();
  });

  it('rejects reversed, fractional or missing years', () => {
    expect(errors({ from: 2025, to: 2000 })).toEqual({ period: true });
    expect(errors({ from: 2000.5, to: 2025 })).toEqual({ period: true });
    expect(errors({ from: null, to: 2025 })).toEqual({ period: true });
  });

  it('also checks the vote threshold when the form has one', () => {
    expect(errors({ from: 2000, to: 2025, minVotes: 20 })).toBeNull();
    expect(errors({ from: 2000, to: 2025, minVotes: 1.5 })).toEqual({ period: true });
  });
});
