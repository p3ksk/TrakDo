import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DATE_FORMAT_OPTIONS, UserSettings } from '../../core/models/settings.model';
import { SettingsService } from '../../core/services/settings.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  settingsForm = {} as UserSettings;
  timezoneOptions: string[] = [];
  dateFormatOptions = DATE_FORMAT_OPTIONS;
  hourStartOptions: number[] = Array.from({ length: 24 }, (_, i) => i);
  hourEndOptions: number[] = Array.from({ length: 24 }, (_, i) => i + 1);
  isSaving = false;
  isLoading = true;

  constructor(private settingsService: SettingsService, private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.timezoneOptions = this.settingsService.getTimezoneOptions();

    if (this.settingsService.isLoaded()) {
      this.settingsForm = { ...this.settingsService.settings() };
      this.isLoading = false;
      return;
    }

    queueMicrotask(() => {
      this.settingsService.loadSettings().subscribe({
        next: settings => {
          this.settingsForm = { ...settings };
          this.isLoading = false;
        },
        error: err => {
          console.error('Failed to load settings', err);
          this.notificationService.error('Failed to load settings.');
          this.isLoading = false;
        }
      });
    });
  }

  saveSettings(): void {
    if (this.isLoading) {
      return;
    }

    if (!this.settingsForm.timezone) {
      this.notificationService.error('Please select a timezone.');
      return;
    }

    if (this.settingsForm.workDayStartHour >= this.settingsForm.workDayEndHour) {
      this.notificationService.error('Work day end hour must be greater than start hour.');
      return;
    }

    this.isSaving = true;
    this.settingsService.updateSettings(this.settingsForm).subscribe({
      next: settings => {
        this.settingsForm = { ...settings };
        this.isSaving = false;
        this.notificationService.success('Settings saved.');
      },
      error: err => {
        console.error('Failed to update settings', err);
        this.isSaving = false;
        const errorMessage = err instanceof HttpErrorResponse
          ? (typeof err.error === 'string' ? err.error : 'Failed to save settings.')
          : 'Failed to save settings.';
        this.notificationService.error(errorMessage);
      }
    });
  }
}
