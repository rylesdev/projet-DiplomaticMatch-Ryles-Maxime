import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Country } from '../core/models/api.models';

// Sélecteur de pays partagé : groupes (12 pays au plus) et matrice sélectionnée (15 au plus).
@Component({
  selector: 'app-country-picker',
  imports: [ReactiveFormsModule],
  templateUrl: './country-picker.component.html',
  styleUrl: './country-picker.component.scss',
})
export class CountryPickerComponent {
  @Input() countries: Country[] = [];
  @Input() memberIds: string[] = [];
  @Input() disabled = false;
  @Input() max = 12;
  @Input() legend = 'Pays';
  @Input() hint = '';
  @Input() searchId = 'country-search';
  @Output() memberIdsChange = new EventEmitter<string[]>();
  readonly search = new FormControl('', { nonNullable: true });

  get available(): Country[] {
    const query = this.normalize(this.search.value.trim());
    return this.countries
      .filter(
        (country) =>
          !this.memberIds.includes(country.id) &&
          this.normalize(`${country.name} ${country.nameEn} ${country.id}`).includes(query),
      )
      .slice(0, 10);
  }
  label(id: string): string {
    return this.countries.find((country) => country.id === id)?.name ?? id;
  }
  add(id: string): void {
    if (this.disabled || this.memberIds.length >= this.max || this.memberIds.includes(id)) return;
    this.memberIdsChange.emit([...this.memberIds, id]);
    this.search.setValue('');
  }
  remove(id: string): void {
    if (!this.disabled) this.memberIdsChange.emit(this.memberIds.filter((member) => member !== id));
  }
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }
}
