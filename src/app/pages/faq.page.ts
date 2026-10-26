import { Component, inject, OnInit } from '@angular/core';
import { FAQ } from '../core/faq-content';
import { SeoService, SettingsService } from '../core/services';
import { FaqComponent } from '../shared/faq.component';

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [FaqComponent],
  template: `<div class="wrap"><app-faq [page]="true" /></div>`,
  styles: [`.wrap { padding-block: 32px 64px; }`],
})
export class FaqPage implements OnInit {
  private seo = inject(SeoService);
  private settings = inject(SettingsService);
  ngOnInit() {
    this.seo.set({
      title: 'FAQ',
      description: 'Answers about personalizing, delivery, payments, refunds and licensing.',
      path: '/faq',
      // FAQPage structured data lets search engines show these answers directly.
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: (this.settings.faq() ?? FAQ).flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      },
    });
  }
}
