import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../core/services';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `<div class="container empty"><p class="eyebrow">404</p><h1>This page wandered off</h1><p>Let’s get you back to something beautiful.</p><a class="btn" routerLink="/shop">Browse the shop</a></div>`,
})
export class NotFoundPage implements OnInit {
  private seo = inject(SeoService);
  ngOnInit() { this.seo.set({ title: 'Page not found' }); }
}
