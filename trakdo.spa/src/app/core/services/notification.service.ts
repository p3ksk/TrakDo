import {ChangeDetectorRef, Injectable, signal} from '@angular/core';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSignal = signal<Notification[]>([]);
  public notifications = this.notificationsSignal.asReadonly();

  private defaultDuration = 4000;

  show(message: string, type: Notification['type'] = 'info', duration?: number): void {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      duration: duration || this.defaultDuration
    };

    this.notificationsSignal.update(notifications => [...notifications, notification]);

    if (notification.duration) {
      setTimeout(() => this.remove(notification.id), notification.duration);
    }
  }

  success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  remove(id: string): void {
    this.notificationsSignal.update(notifications =>
      notifications.filter(n => n.id !== id)
    );
  }

  clear(): void {
    this.notificationsSignal.set([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
