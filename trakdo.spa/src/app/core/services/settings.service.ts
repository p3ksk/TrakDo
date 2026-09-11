import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserSettings } from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private userSettings = signal<UserSettings | null>(null);
  public isLoaded = computed(() => this.userSettings() !== null);
  public settings = computed(() => {
    const settings = this.userSettings();
    if (!settings) {
      throw new Error('Settings are not loaded yet.');
    }

    return settings;
  });

  constructor(private http: HttpClient) {}

  loadSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${environment.apiUrl}/settings`).pipe(
      tap(settings => this.userSettings.set(settings))
    );
  }

  updateSettings(settings: UserSettings): Observable<UserSettings> {
    return this.http.put<UserSettings>(`${environment.apiUrl}/settings`, settings).pipe(
      tap(updatedSettings => this.userSettings.set(updatedSettings))
    );
  }

  resetSettings(): void {
    this.userSettings.set(null);
  }

  getTimezoneOptions(): string[] {
    const intlWithSupportedValues = Intl as typeof globalThis.Intl & { supportedValuesOf?: (key: string) => string[] };
    const timezones = intlWithSupportedValues.supportedValuesOf?.('timeZone');
    if (!timezones || timezones.length === 0) {
      return ['UTC'];
    }

    return timezones.includes('UTC') ? timezones : ['UTC', ...timezones];
  }
}
