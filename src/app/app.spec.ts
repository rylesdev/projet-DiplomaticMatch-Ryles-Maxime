import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('MAXIME DARIA');
  });

  it('should change the background when each colored square is clicked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const page = compiled.querySelector('main')!;

    expect(page.classList.contains('background-white')).toBe(true);

    for (const color of ['red', 'green', 'blue', 'yellow']) {
      compiled.querySelector<HTMLButtonElement>(`button.${color}`)!.click();
      fixture.detectChanges();

      const backgrounds = Array.from(page.classList).filter((name) =>
        name.startsWith('background-'),
      );
      expect(backgrounds).toEqual([`background-${color}`]);
    }
  });
});
