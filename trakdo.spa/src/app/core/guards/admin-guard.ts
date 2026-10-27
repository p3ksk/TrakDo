import {CanActivateFn, Router} from '@angular/router';
import {inject} from '@angular/core';
import {catchError, map, of} from 'rxjs';
import {AuthService} from '../services/auth.service';

/** Asks the API rather than trusting the cached login, since admin rights can change at any time. */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const fallback = router.createUrlTree(['/boards']);

  return authService.loadMe().pipe(
    map(me => me.isAdmin ? true : fallback),
    catchError(() => of(fallback))
  );
};
