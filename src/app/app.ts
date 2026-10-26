import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { Microsoft } from './microsoft/microsoft';
import { HeaderViolet } from './header-violet/header-violet';
import { FooterOrange } from './footer-orange/footer-orange';

@Component({
  selector: 'app-root',
  imports: [NgClass, Microsoft, HeaderViolet, FooterOrange],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected noms: string = 'MAXIME DARIA';
  protected backgroundColor : string = 'background-white';

  protected changeBackgroundColor(color: string): void {
    this.backgroundColor = color;
  }
}
