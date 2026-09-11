import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionsService } from '../../core/services/sessions.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { NotificationService } from '../../core/services/notification.service';
import { formatHuman } from '../../core/utils/duration';
import { Modal } from '../modal/modal';
import { Icon } from '../icon/icon';

export interface EditableSession {
  id: number;
  taskTitle: string;
  startTime: Date;
  endTime?: Date;
  notes: string;
  color?: string;
}

const MINUTES_PER_DAY = 24 * 60;

/** Edit / delete dialog for a tracked session. Broadcasts changes on the SessionBus. */
@Component({
  selector: 'app-session-edit',
  imports: [FormsModule, Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Edit session" (closed)="closed.emit()">
      <span modalEyebrow class="session-task">
        <span class="session-task-dot" [style.background]="session().color || '#09C1BF'"></span>
        {{ session().taskTitle }}
      </span>
      <form (ngSubmit)="save()">
        <div class="modal-body">
          <div class="field">
            <label class="field-label" for="session-date">Date</label>
            <input id="session-date" type="date" class="input" [ngModel]="date()" (ngModelChange)="date.set($event)" name="date" required/>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field-label" for="session-start">Start</label>
              <input id="session-start" type="time" class="input" [ngModel]="startTime()" (ngModelChange)="startTime.set($event)" name="startTime" required/>
            </div>
            <div class="field">
              <label class="field-label" for="session-end">End</label>
              <input id="session-end" type="time" class="input" [class.is-invalid]="!!validationError()"
                     [ngModel]="endTime()" (ngModelChange)="endTime.set($event)" name="endTime"/>
            </div>
          </div>

          <div class="duration-preview" [class.is-warning]="endsNextDay()" [class.is-error]="!!validationError()">
            @if (validationError(); as error) {
              <app-icon name="alert" [size]="16"/> {{ error }}
            } @else if (!endTime()) {
              <span class="live-dot"></span> Still running — set an end time to stop it.
            } @else {
              <app-icon name="clock" [size]="16"/>
              <span><strong class="mono">{{ durationLabel() }}</strong>@if (endsNextDay()) { · ends the next day}</span>
            }
          </div>

          <div class="field">
            <label class="field-label" for="session-note">Note <span class="optional">optional</span></label>
            <textarea id="session-note" class="input" rows="3" maxlength="5000" placeholder="What did you work on?"
                      [ngModel]="note()" (ngModelChange)="note.set($event)" name="note"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger" (click)="remove()" [disabled]="isBusy()">
            <app-icon name="trash" [size]="15"/> Delete
          </button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="!canSave()">Save</button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [`
    .session-task { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--color-text-secondary); }
    .session-task-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .optional { font-weight: 400; color: var(--color-text-tertiary); }
    .duration-preview {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.6rem 0.75rem; font-size: 0.875rem;
      color: var(--color-text-secondary); background: var(--color-surface-1);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
    }
    .duration-preview strong { color: var(--color-text-primary); }
    .duration-preview.is-warning { color: var(--color-accent); border-color: rgba(var(--color-accent-rgb), 0.3); }
    .duration-preview.is-error { color: var(--color-danger-text); border-color: rgba(var(--color-secondary-rgb), 0.4); }
  `]
})
export class SessionEdit implements OnInit {
  private sessionsService = inject(SessionsService);
  private sessionBus = inject(SessionBusService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private notification = inject(NotificationService);

  session = input.required<EditableSession>();
  closed = output<void>();

  date = signal('');
  startTime = signal('');
  endTime = signal('');
  note = signal('');
  isBusy = signal(false);

  private wasRunning = false;

  private durationMinutes = computed(() => {
    const start = this.toMinutes(this.startTime());
    const end = this.toMinutes(this.endTime());
    if (start === null || end === null) {
      return null;
    }
    return end > start ? end - start : end + MINUTES_PER_DAY - start;
  });

  endsNextDay = computed(() => {
    const start = this.toMinutes(this.startTime());
    const end = this.toMinutes(this.endTime());
    return start !== null && end !== null && end < start;
  });

  durationLabel = computed(() => formatHuman((this.durationMinutes() ?? 0) * 60));

  validationError = computed(() => {
    if (!this.endTime()) {
      return this.wasRunning ? null : 'A finished session needs an end time.';
    }
    if (this.endTime() === this.startTime()) {
      return 'End time must be different from the start time.';
    }
    return null;
  });

  canSave = computed(() => !!this.date() && !!this.startTime() && !this.validationError() && !this.isBusy());

  ngOnInit(): void {
    const session = this.session();
    this.wasRunning = !session.endTime;
    this.date.set(this.dateTimeFormat.formatDateForInput(session.startTime));
    this.startTime.set(this.dateTimeFormat.formatTimeForInput(session.startTime));
    this.endTime.set(session.endTime ? this.dateTimeFormat.formatTimeForInput(session.endTime) : '');
    this.note.set(session.notes ?? '');
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }

    const date = this.date();
    const endDate = this.endsNextDay() ? this.addOneDay(date) : date;
    const request = {
      startTime: `${date}T${this.startTime()}:00`,
      endTime: this.endTime() ? `${endDate}T${this.endTime()}:00` : undefined,
      notes: this.note().trim()
    };

    this.isBusy.set(true);
    this.sessionsService.updateSession(this.session().id, request).subscribe({
      next: () => {
        this.isBusy.set(false);
        this.sessionBus.notifySessionsChanged();
        this.notification.success('Session updated.');
        this.closed.emit();
      },
      error: () => {
        this.isBusy.set(false);
        this.notification.error('Failed to update session.');
      }
    });
  }

  remove(): void {
    if (!confirm('Delete this session? The tracked time will be removed.')) {
      return;
    }

    this.isBusy.set(true);
    this.sessionsService.deleteSession(this.session().id).subscribe({
      next: () => {
        this.isBusy.set(false);
        this.sessionBus.notifySessionsChanged();
        this.notification.success('Session deleted.');
        this.closed.emit();
      },
      error: () => {
        this.isBusy.set(false);
        this.notification.error('Failed to delete session.');
      }
    });
  }

  private toMinutes(time: string): number | null {
    const match = /^(\d{2}):(\d{2})/.exec(time ?? '');
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  private addOneDay(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  }
}
