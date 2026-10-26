import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-microsoft',
  imports: [],
  templateUrl: './microsoft.html',
  styleUrl: './microsoft.scss',
})
export class Microsoft {
  @Output() colorSelected = new EventEmitter<string>();

  public selectColor(color: string): void {
    this.colorSelected.emit(color);
  }
}
