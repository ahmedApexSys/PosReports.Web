import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const ok = auth.isAuthenticated();
  if (ok) return true;

  // Imperative navigate is more reliable than returning a UrlTree in
  // Angular 21 when the guard fires during the very first navigation.
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
