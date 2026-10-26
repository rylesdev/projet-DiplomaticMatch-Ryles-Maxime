import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderViolet } from './header-violet';

describe('HeaderViolet', () => {
  let component: HeaderViolet;
  let fixture: ComponentFixture<HeaderViolet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderViolet],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderViolet);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
