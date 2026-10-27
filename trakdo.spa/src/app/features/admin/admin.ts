import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { format, parseISO } from 'date-fns';
import { AdminStats, AdminUser } from '../../core/models/admin.model';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { NotificationService } from '../../core/services/notification.service';
import { formatHuman, pluralize } from '../../core/utils/duration';
import { Icon } from '../../shared/icon/icon';
import { Modal } from '../../shared/modal/modal';
import { PageHeader } from '../../shared/page-header/page-header';

interface RegistrationPoint {
  date: string;
  label: string;
  tooltip: string;
  count: number;
  heightPercent: number;
}

const MIN_PASSWORD_LENGTH = 6;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, Icon, Modal, PageHeader],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private notificationService = inject(NotificationService);

  readonly formatHuman = formatHuman;
  readonly pluralize = pluralize;
  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  stats = signal<AdminStats | null>(null);
  users = signal<AdminUser[]>([]);
  registrationEnabled = signal(true);
  isLoading = signal(true);
  hasError = signal(false);
  isSavingSettings = signal(false);
  busyUserId = signal<number | null>(null);

  passwordTarget = signal<AdminUser | null>(null);
  newPassword = signal('');
  confirmPassword = signal('');
  isSubmittingPassword = signal(false);

  deleteTarget = signal<AdminUser | null>(null);
  deleteConfirmation = signal('');
  isDeleting = signal(false);

  private currentUsername = computed(() => this.authService.currentUser()?.username ?? null);

  registrationsTotal = computed(() =>
    (this.stats()?.registrationsPerDay ?? []).reduce((total, day) => total + day.count, 0));

  registrationTrend = computed<RegistrationPoint[]>(() => {
    const days = this.stats()?.registrationsPerDay ?? [];
    const max = Math.max(1, ...days.map(day => day.count));
    return days.map((day, index) => {
      const date = parseISO(day.date);
      // Label today and every fifth day back from it; 30 labels don't fit side by side.
      const isLabelled = (days.length - 1 - index) % 5 === 0;
      return {
        date: day.date,
        label: isLabelled ? format(date, 'd MMM') : '',
        tooltip: `${format(date, 'EEE, d MMM')} · ${pluralize(day.count, 'registration')}`,
        count: day.count,
        heightPercent: (day.count / max) * 100
      };
    });
  });

  passwordTooShort = computed(() => this.newPassword().length > 0 && this.newPassword().length < MIN_PASSWORD_LENGTH);
  passwordMismatch = computed(() => this.confirmPassword().length > 0 && this.confirmPassword() !== this.newPassword());
  canSubmitPassword = computed(() =>
    this.newPassword().length >= MIN_PASSWORD_LENGTH && this.newPassword() === this.confirmPassword());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      stats: this.adminService.getStats(),
      users: this.adminService.getUsers(),
      settings: this.adminService.getSettings()
    }).subscribe({
      next: ({ stats, users, settings }) => {
        this.stats.set(stats);
        this.users.set(users);
        this.registrationEnabled.set(settings.registrationEnabled);
        this.isLoading.set(false);
      },
      error: err => {
        console.error('Failed to load admin data', err);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  isSelf(user: AdminUser): boolean {
    return user.username === this.currentUsername();
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Never';
    }

    const date = this.dateTimeFormat.parseApiDateTime(value);
    return `${this.dateTimeFormat.formatDate(date)} ${this.dateTimeFormat.formatTime(date)}`;
  }

  setRegistrationEnabled(enabled: boolean): void {
    if (enabled === this.registrationEnabled() || this.isSavingSettings()) {
      return;
    }

    this.isSavingSettings.set(true);
    this.adminService.updateSettings({ registrationEnabled: enabled }).subscribe({
      next: settings => {
        this.registrationEnabled.set(settings.registrationEnabled);
        this.isSavingSettings.set(false);
        this.notificationService.success(settings.registrationEnabled ? 'Registration is open.' : 'Registration is closed.');
      },
      error: err => this.handleError(err, 'Failed to update the registration setting.', () => this.isSavingSettings.set(false))
    });
  }

  toggleAdmin(user: AdminUser): void {
    if (this.isSelf(user) || this.busyUserId() !== null) {
      return;
    }

    this.busyUserId.set(user.id);
    this.adminService.setAdmin(user.id, !user.isAdmin).subscribe({
      next: updated => {
        this.users.update(users => users.map(existing => existing.id === updated.id ? updated : existing));
        this.busyUserId.set(null);
        this.refreshStats();
        this.notificationService.success(updated.isAdmin
          ? `${updated.username} is now an admin.`
          : `${updated.username} is no longer an admin.`);
      },
      error: err => this.handleError(err, 'Failed to change admin rights.', () => this.busyUserId.set(null))
    });
  }

  openPasswordModal(user: AdminUser): void {
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.passwordTarget.set(user);
  }

  closePasswordModal(): void {
    if (!this.isSubmittingPassword()) {
      this.passwordTarget.set(null);
    }
  }

  submitPassword(): void {
    const target = this.passwordTarget();
    if (!target || !this.canSubmitPassword() || this.isSubmittingPassword()) {
      return;
    }

    this.isSubmittingPassword.set(true);
    this.adminService.resetPassword(target.id, this.newPassword()).subscribe({
      next: () => {
        this.isSubmittingPassword.set(false);
        this.passwordTarget.set(null);
        this.notificationService.success(`Password for ${target.username} was reset.`);
      },
      error: err => this.handleError(err, 'Failed to reset the password.', () => this.isSubmittingPassword.set(false))
    });
  }

  openDeleteModal(user: AdminUser): void {
    if (this.isSelf(user)) {
      return;
    }

    this.deleteConfirmation.set('');
    this.deleteTarget.set(user);
  }

  closeDeleteModal(): void {
    if (!this.isDeleting()) {
      this.deleteTarget.set(null);
    }
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleteConfirmation() !== target.username || this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.adminService.deleteUser(target.id).subscribe({
      next: () => {
        this.users.update(users => users.filter(user => user.id !== target.id));
        this.isDeleting.set(false);
        this.deleteTarget.set(null);
        this.refreshStats();
        this.notificationService.success(`${target.username} was deleted.`);
      },
      error: err => this.handleError(err, 'Failed to delete the account.', () => this.isDeleting.set(false))
    });
  }

  private refreshStats(): void {
    this.adminService.getStats().subscribe({
      next: stats => this.stats.set(stats),
      error: err => console.error('Failed to refresh admin stats', err)
    });
  }

  private handleError(err: unknown, fallback: string, cleanup: () => void): void {
    console.error(fallback, err);
    cleanup();
    const message = err instanceof HttpErrorResponse && typeof err.error === 'string' && err.error
      ? err.error
      : fallback;
    this.notificationService.error(message);
  }
}
