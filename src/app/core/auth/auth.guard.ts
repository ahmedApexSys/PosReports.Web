import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ok = auth.isAuthenticated();
  // Diagnostic — remove after the dashboard renders correctly.
  console.log('[authGuard]', { url: state.url, authenticated: ok, token: auth.token() ? 'present' : 'absent' });

  if (ok) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
