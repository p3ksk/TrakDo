import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminSettings, AdminStats, AdminUser } from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/stats`);
  }

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/users`);
  }

  setAdmin(userId: number, isAdmin: boolean): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.baseUrl}/users/${userId}/admin`, { isAdmin });
  }

  resetPassword(userId: number, password: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/users/${userId}/password`, { password });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${userId}`);
  }

  getSettings(): Observable<AdminSettings> {
    return this.http.get<AdminSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(settings: AdminSettings): Observable<AdminSettings> {
    return this.http.put<AdminSettings>(`${this.baseUrl}/settings`, settings);
  }
}
