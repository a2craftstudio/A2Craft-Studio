import { Directive, ElementRef, inject, input, OnDestroy, OnInit } from '@angular/core';

/** Fades and lifts an element into view the first time it scrolls on screen. */
@Directive({ selector: '[appReveal]', standalone: true })
export class RevealDirective implements OnInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  delay = input(0, { alias: 'appReveal' });
  private io?: IntersectionObserver;

  ngOnInit() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') return;
    this.el.classList.add('rv');
    this.el.style.transitionDelay = `${this.delay()}ms`;
    this.io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          this.el.classList.add('rv-in');
          this.io?.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    this.io.observe(this.el);
  }

  ngOnDestroy() { this.io?.disconnect(); }
}
