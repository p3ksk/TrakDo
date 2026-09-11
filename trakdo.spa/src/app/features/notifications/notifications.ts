import {Component, inject} from '@angular/core';
import {NotificationService, Notification} from '../../core/services/notification.service';
import {Icon, IconName} from '../../shared/icon/icon';

@Component({
  selector: 'app-notifications',
  imports: [Icon],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  private notificationService = inject(NotificationService);
  notifications = this.notificationService.notifications;

  close(id: string): void {
    this.notificationService.remove(id);
  }

  getIcon(type: Notification['type']): IconName {
    const icons: Record<Notification['type'], IconName> = {
      success: 'check',
      error: 'alert',
      warning: 'alert',
      info: 'info'
    };
    return icons[type];
  }
}
