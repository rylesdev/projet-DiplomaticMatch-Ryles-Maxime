import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-header-violet',
  imports: [],
  templateUrl: './header-violet.html',
  styleUrl: './header-violet.scss',
})
export class HeaderViolet {
  @Input() prenoms: string = '';
}
