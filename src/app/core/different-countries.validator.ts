import { AbstractControl, ValidationErrors } from '@angular/forms';

// Validateur de groupe partagé (comparaison, accueil) : les champs countryA et countryB
// doivent désigner deux pays différents.
export function differentCountries(control: AbstractControl): ValidationErrors | null {
  return control.get('countryA')?.value === control.get('countryB')?.value
    ? { sameCountry: true }
    : null;
}
