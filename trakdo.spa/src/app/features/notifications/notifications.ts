import {Component, inject} from '@angular/core';
import {NotificationService, Notification} from '../../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  imports: [],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  private notificationService = inject(NotificationService);
  notifications = this.notificationService.notifications;

  close(id: string): void {
    this.notificationService.remove(id);
  }

  getIcon(type: Notification['type']): string {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'i'
    };
    return icons[type];
  }
}
