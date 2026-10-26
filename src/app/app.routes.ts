import { inject } from '@angular/core';
import { CanMatchFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/services';
import { LEGAL_SLUGS } from './core/pages-content';

/** UX convenience only. Real authorization is enforced by Postgres RLS and edge functions. */
const adminOnly: CanMatchFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() || inject(Router).createUrlTree(['/account'], { queryParams: { next: 'admin' } });
};

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
  { path: 'explore', redirectTo: (r) => inject(Router).createUrlTree(['/shop'], { queryParams: r.queryParams }) },
  { path: 'shop', loadComponent: () => import('./pages/catalog.page').then((m) => m.CatalogPage), data: { mode: 'shop' } },
  { path: 'product/:slug', loadComponent: () => import('./pages/product.page').then((m) => m.ProductPage) },
  { path: 'studio/:slug', loadComponent: () => import('./pages/studio.page').then((m) => m.StudioPage) },
  { path: 'videos', redirectTo: () => inject(Router).parseUrl('/shop?type=video') },
  { path: 'our-work', loadComponent: () => import('./pages/portfolio.page').then((m) => m.PortfolioPage) },
  { path: 'custom-order', loadComponent: () => import('./pages/custom-order.page').then((m) => m.CustomOrderPage) },
  { path: 'faq', loadComponent: () => import('./pages/faq.page').then((m) => m.FaqPage) },
  { path: 'contact', loadComponent: () => import('./pages/contact.page').then((m) => m.ContactPage) },
  { path: 'cart', loadComponent: () => import('./pages/cart.page').then((m) => m.CartPage) },
  { path: 'checkout', loadComponent: () => import('./pages/checkout.page').then((m) => m.CheckoutPage) },
  { path: 'order/:id', loadComponent: () => import('./pages/order.page').then((m) => m.OrderPage) },
  { path: 'account', loadComponent: () => import('./pages/account.page').then((m) => m.AccountPage) },
  { path: 'admin', canMatch: [adminOnly], loadComponent: () => import('./pages/admin.page').then((m) => m.AdminPage) },
  ...LEGAL_SLUGS.map((slug) => ({
    path: slug,
    loadComponent: () => import('./pages/legal.page').then((m) => m.LegalPage),
    data: { slug },
  })),
  { path: '**', loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage) },
];

