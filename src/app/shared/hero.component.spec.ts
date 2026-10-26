import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Backend } from '../core/backend';
import { CatalogService } from '../core/services';
import { HeroComponent } from './hero.component';
import { makeCategory, makeProduct } from '../../testing/fixtures';
import { TestBackend } from '../../testing/test-backend';

describe('HeroComponent (built from the live catalog)', () => {
  let fixture: ComponentFixture<HeroComponent>;
  let backend: TestBackend;

  async function create(products = [] as ReturnType<typeof makeProduct>[], categories = [] as ReturnType<typeof makeCategory>[]) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [HeroComponent], providers: [provideRouter([]), { provide: Backend, useClass: TestBackend }] }).compileComponents();
    backend = TestBed.inject(Backend) as TestBackend;
    backend.on('listProducts', async () => products).on('listCategories', async () => categories);
    await TestBed.inject(CatalogService).load();
    fixture = TestBed.createComponent(HeroComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  const host = () => fixture.nativeElement as HTMLElement;

  it('shows a plain headline and no photo columns for an empty shop', async () => {
    const hero = await create();
    expect(hero.themes().length).toBe(1);
    expect(hero.themes()[0].imgs).toEqual([]);
    expect(hero.colCount()).toBe(0);
    expect(host().querySelector('.cols')).toBeNull();
    expect(host().querySelector('.dots')).toBeNull();
    expect(host().textContent).toContain('Get your next');
  });

  it('turns each category that has photos into a headline word with its own photos', async () => {
    const hero = await create(
      [makeProduct({ id: 'a', category: 'wed' }), makeProduct({ id: 'b', category: 'wed' }), makeProduct({ id: 'c', category: 'bday' }), makeProduct({ id: 'd', category: 'empty-cat', gallery: [] })],
      [makeCategory('wed', 'Wedding invitations'), makeCategory('bday', 'Birthday gifts'), makeCategory('empty-cat', 'No photos'), makeCategory('unused', 'Unused')],
    );
    expect(hero.themes().map((t) => t.word)).toEqual(['wedding invitations', 'birthday gifts']);
    expect(hero.themes()[0].imgs).toEqual(['/media/a.jpg', '/media/b.jpg']);
    expect(host().querySelectorAll('.dots button').length).toBe(2);
  });

  it('falls back to every product photo when there are no categories yet', async () => {
    const hero = await create([makeProduct({ id: 'a' }), makeProduct({ id: 'b' })]);
    expect(hero.themes()[0].word).toBe('keepsake');
    expect(hero.themes()[0].imgs.length).toBe(2);
    expect(hero.colCount()).toBe(3); // a few photos still make a small wave
  });

  it('uses at most five headlines and seven columns, however big the catalog is', async () => {
    const cats = Array.from({ length: 8 }, (_, i) => makeCategory('c' + i, 'Cat ' + i));
    const products = cats.flatMap((c, i) => Array.from({ length: 10 }, (_, j) => makeProduct({ id: `p${i}-${j}`, category: c.id })));
    const hero = await create(products, cats);
    expect(hero.themes().length).toBe(5);
    expect(hero.colCount()).toBe(7);
  });
});
