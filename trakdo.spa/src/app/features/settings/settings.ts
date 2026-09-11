import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { formatInTimeZone } from 'date-fns-tz';
import { DATE_FORMAT_OPTIONS, UserSettings } from '../../core/models/settings.model';
import { SettingsService } from '../../core/services/settings.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeader } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, PageHeader],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  private settingsService = inject(SettingsService);
  private notificationService = inject(NotificationService);

  readonly timezoneOptions = this.settingsService.getTimezoneOptions();
  readonly dateFormatOptions = DATE_FORMAT_OPTIONS;
  readonly hourStartOptions: number[] = Array.from({ length: 24 }, (_, i) => i);
  readonly hourEndOptions: number[] = Array.from({ length: 24 }, (_, i) => i + 1);
  readonly browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  form = signal<UserSettings>({ ...this.settingsService.settings() });
  isSaving = signal(false);

  isDirty = computed(() => {
    const saved = this.settingsService.settings();
    const current = this.form();
    return (Object.keys(saved) as (keyof UserSettings)[]).some(key => saved[key] !== current[key]);
  });

  hoursError = computed(() => this.form().workDayStartHour >= this.form().workDayEndHour
    ? 'The work day must end after it starts.'
    : null);

  datePreview = computed(() => this.formatPreview(this.form().dateFormat.replace('YYYY', 'yyyy').replace('DD', 'dd')));
  timePreview = computed(() => this.formatPreview(this.form().use24HourTime ? 'HH:mm' : 'hh:mm a'));

  ngOnInit(): void {
    this.form.set({ ...this.settingsService.settings() });
  }

  update<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    this.form.update(form => ({ ...form, [key]: value }));
  }

  useBrowserTimezone(): void {
    if (this.timezoneOptions.includes(this.browserTimezone)) {
      this.update('timezone', this.browserTimezone);
    }
  }

  formatHour(hour: number): string {
    return hour === 24 ? '24:00' : `${hour.toString().padStart(2, '0')}:00`;
  }

  reset(): void {
    this.form.set({ ...this.settingsService.settings() });
  }

  saveSettings(): void {
    if (!this.isDirty() || this.hoursError() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.settingsService.updateSettings(this.form()).subscribe({
      next: settings => {
        this.form.set({ ...settings });
        this.isSaving.set(false);
        this.notificationService.success('Settings saved.');
      },
      error: err => {
        console.error('Failed to update settings', err);
        this.isSaving.set(false);
        const errorMessage = err instanceof HttpErrorResponse && typeof err.error === 'string'
          ? err.error
          : 'Failed to save settings.';
        this.notificationService.error(errorMessage);
      }
    });
  }

  private formatPreview(pattern: string): string {
    try {
      return formatInTimeZone(new Date(), this.form().timezone, pattern);
    } catch {
      return '';
    }
  }
}
