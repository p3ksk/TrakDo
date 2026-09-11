import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SessionBusService {
  private sessionsChanged = new Subject<void>();
  public sessionsChanged$ = this.sessionsChanged.asObservable();

  notifySessionsChanged(): void {
    this.sessionsChanged.next();
  }
}
