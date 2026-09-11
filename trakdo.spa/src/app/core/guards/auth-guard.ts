import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';
import {inject} from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true
  }

  // Store the attempted URL for redirecting after login
  const returnUrl = state.url;

  // Redirect to login page
  router.navigate(['/auth/login'], {
    queryParams: { returnUrl: returnUrl }
  });

  return false;
};
