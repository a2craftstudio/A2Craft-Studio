import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Backend } from '../core/backend';
import { ProductCardComponent } from './product-card.component';
import { makeProduct } from '../../testing/fixtures';
import { TestBackend } from '../../testing/test-backend';

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([]), { provide: Backend, useClass: TestBackend }] }).compileComponents();
    fixture = TestBed.createComponent(ProductCardComponent);
  });

  it('shows the title and INR price, and a discount only when genuine', () => {
    fixture.componentRef.setInput('p', makeProduct({ title: 'Peony invite', priceInr: 300, originalPriceInr: 400 }));
    fixture.detectChanges();
    expect(host().textContent).toContain('Peony invite');
    expect(host().textContent).toContain('₹');
    expect(host().textContent).toContain('25% off');
    fixture.componentRef.setInput('p', makeProduct({ title: 'Plain', priceInr: 300 }));
    fixture.detectChanges();
    expect(host().textContent).not.toContain('% off');
  });

  it('marks video designs with a play badge', () => {
    fixture.componentRef.setInput('p', makeProduct({ formats: ['MP4'] }));
    fixture.detectChanges();
    expect(host().querySelector('.play')).not.toBeNull();
    fixture.componentRef.setInput('p', makeProduct({ formats: ['PDF'] }));
    fixture.detectChanges();
    expect(host().querySelector('.play')).toBeNull();
  });

  it('has an accessible favourite button that toggles and is stored on the device for visitors', async () => {
    fixture.componentRef.setInput('p', makeProduct({ id: 'fav-1' }));
    fixture.detectChanges();
    const btn = host().querySelector<HTMLButtonElement>('button.fav')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('a2.favs')!)).toContain('fav-1');
  });
});
