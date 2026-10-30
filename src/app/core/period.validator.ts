import { AbstractControl, ValidationErrors } from '@angular/forms';

// Validateur de groupe partagé : années entières, début avant ou égal à la fin,
// et seuil de votes entier quand le formulaire en contient un.
export function periodValidator(control: AbstractControl): ValidationErrors | null {
  const from = control.get('from')?.value;
  const to = control.get('to')?.value;
  const minVotes = control.get('minVotes');
  const values = minVotes ? [from, to, minVotes.value] : [from, to];
  return values.every(Number.isInteger) && from <= to ? null : { period: true };
}
