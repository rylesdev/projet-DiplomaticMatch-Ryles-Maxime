import { Component } from '@angular/core';
import { MapExplorerComponent } from './map-explorer.component';

@Component({
  selector: 'app-map-page',
  imports: [MapExplorerComponent],
  templateUrl: './map.page.html',
  styleUrl: './map.page.scss',
})
export class MapPage {}
