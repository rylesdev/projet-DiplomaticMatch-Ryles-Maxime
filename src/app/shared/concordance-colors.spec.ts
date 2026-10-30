import { concordanceColor, concordanceTextColor } from './concordance-colors';

describe('concordanceColor', () => {
  it('maps a real zero concordance to red and full concordance to blue', () => {
    expect(concordanceColor(0)).toBe('rgb(190, 50, 50)');
    expect(concordanceColor(100)).toBe('rgb(36, 89, 171)');
  });

  it('uses a neutral midpoint and a separate gray for missing or ineligible values', () => {
    expect(concordanceColor(50)).toBe('rgb(248, 247, 242)');
    expect(concordanceColor(null)).toBe('#e3e7eb');
    expect(concordanceColor(null)).not.toBe(concordanceColor(0));
  });

  it('clamps percentages at the ends of the scale', () => {
    expect(concordanceColor(-5)).toBe(concordanceColor(0));
    expect(concordanceColor(105)).toBe(concordanceColor(100));
  });
});

describe('concordanceTextColor', () => {
  it('writes in white on dark cells and in dark ink on light or gray cells', () => {
    expect(concordanceTextColor(0)).toBe('#ffffff');
    expect(concordanceTextColor(100)).toBe('#ffffff');
    expect(concordanceTextColor(50)).toBe('#152b2b');
    expect(concordanceTextColor(null)).toBe('#152b2b');
  });
});
