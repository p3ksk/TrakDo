import { Component, inject, signal } from '@angular/core';
import {AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {AuthService} from '../../../core/services/auth.service';
import {Router, RouterLink} from '@angular/router';
import {Icon} from '../../../shared/icon/icon';

function passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
  const password = form.get('password')?.value;
  const confirmPassword = form.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Icon
  ],
  templateUrl: './register.html',
  styleUrl: '../auth.css',
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(32)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  isLoading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  constructor() {
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl('/');
    }
  }

  get username() { return this.registerForm.get('username'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { confirmPassword, ...registerData } = this.registerForm.getRawValue();

    this.authService.register(registerData).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.errorMessage.set(error.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : (typeof error.error === 'string' && error.error) || error.error?.message || 'Registration failed. The username may already be taken.');
        this.isLoading.set(false);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }
}
