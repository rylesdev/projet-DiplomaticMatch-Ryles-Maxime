import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterOrange } from './footer-orange';

describe('FooterOrange', () => {
  let component: FooterOrange;
  let fixture: ComponentFixture<FooterOrange>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterOrange],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterOrange);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
