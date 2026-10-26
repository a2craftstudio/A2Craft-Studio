import { ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { Backend } from './core/backend';
import { ApiBackend } from './core/api-backend';
import { ToastService } from './core/services';

class AppErrorHandler implements ErrorHandler {
  private toast = inject(ToastService);
  handleError(error: unknown) {
    console.error(error);
    // A skipped view transition (rapid navigation, background tab) is harmless; don't alarm the user.
    if (/Transition was aborted/i.test(String((error as Error)?.message ?? error))) return;
    this.toast.show('Something went wrong. Please try again.', 'error');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    { provide: Backend, useClass: ApiBackend },
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideAppInitializer(async () => {
      const backend = inject(Backend);
      try {
        await backend.init();
      } catch (e) {
        console.error('Backend failed to initialise', e);
        backend.ready.set(true);
        inject(ToastService).show((e as Error).message, 'error');
      }
    }),
  ],
};
