import { Component, inject, signal } from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../../../core/services/auth.service';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Icon} from '../../../shared/icon/icon';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    Icon
  ],
  templateUrl: './login.html',
  styleUrl: '../auth.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  constructor() {
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl('/');
    }
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(returnUrl).then(r => {
          if (!r) {
            console.error('Redirect failed');
          }
        });
      },
      error: (error) => {
        this.errorMessage.set(error.status === 401 || error.status === 400
          ? 'That username and password combination didn\'t work.'
          : error.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : error.error?.message || 'Sign in failed. Please try again.');
        this.isLoading.set(false);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }
}
