import { Injectable, signal } from '@angular/core';
import {LoginRequest, RegisterRequest, User} from '../models/user.model';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {Observable, tap} from 'rxjs';
import {environment} from '../../../environments/environment';
import {SettingsService} from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly USER = 'trakdo_user'
  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false)

  constructor(private http: HttpClient, private router: Router, private settingsService: SettingsService) {
    // Migrate old localStorage key
    const oldData = localStorage.getItem('user;');
    if (oldData) {
      localStorage.setItem(this.USER, oldData);
      localStorage.removeItem('user;');
    }
    this.loadUserFromLocalStorage()
  }

  getToken() {
    if (this.currentUser()?.token != null) {
      return this.currentUser()!.token
    } else {
      this.loadUserFromLocalStorage();
      return this.currentUser()?.token
    }
  }

  login(request: LoginRequest): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap(resp => this.setCurrentUser(resp))
    )
  }

  register(request: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, request).pipe(
      tap(resp => this.setCurrentUser(resp))
    )
  }

  logout() {
    localStorage.removeItem(this.USER);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.settingsService.resetSettings();
    this.router.navigate(['/auth/login']).then(r => {
      if (!r) {
        console.error('Navigation to login page failed during logout.');
      }
    });
  }

  private setCurrentUser(user: User) {
    localStorage.setItem(this.USER, JSON.stringify(user));
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    this.settingsService.loadSettings().subscribe({
      error: (err) => console.error('Failed to load user settings', err)
    });
  }

  private loadUserFromLocalStorage() {
    const userJson = localStorage.getItem(this.USER);
    if(userJson) {
      const user = JSON.parse(userJson);
      this.setCurrentUser(user);
    }
  }
}
