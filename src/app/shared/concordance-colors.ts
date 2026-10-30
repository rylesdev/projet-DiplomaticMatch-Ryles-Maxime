// Échelle commune à la matrice et à sa légende : rouge faible, bleu élevé.
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

// Texte blanc sur les cases foncées (taux proches de 0 % ou de 100 %), foncé ailleurs.
export function concordanceTextColor(value: number | null): string {
  return value !== null && (value <= 25 || value >= 75) ? '#ffffff' : '#152b2b';
}
