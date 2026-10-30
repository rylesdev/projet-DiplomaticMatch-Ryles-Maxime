// Échelle de concordance de la carte : rouge faible, bleu élevé.
export function concordanceColor(value: number | null): string {
  if (value === null) return '#e3e7eb';
  const low = [190, 50, 50];
  const middle = [248, 247, 242];
  const high = [36, 89, 171];
  const bounded = Math.max(0, Math.min(100, value));
  const start = bounded <= 50 ? low : middle;
  const end = bounded <= 50 ? middle : high;
  const fraction = bounded <= 50 ? bounded / 50 : (bounded - 50) / 50;
  return `rgb(${start.map((channel, index) => Math.round(channel + (end[index] - channel) * fraction)).join(', ')})`;
}
