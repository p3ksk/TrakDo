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
          <div class="field-row">
            <div class="field">
              <label class="field-label" for="session-start-date">Start date</label>
              <input id="session-start-date" type="date" class="input" [ngModel]="startDate()"
                     (ngModelChange)="onStartDateChange($event)" name="startDate" required/>
            </div>
            <div class="field">
              <label class="field-label" for="session-start-time">Start time</label>
              <input id="session-start-time" type="time" class="input" [ngModel]="startTime()"
                     (ngModelChange)="startTime.set($event)" name="startTime" required/>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field-label" for="session-end-date">End date</label>
              <input id="session-end-date" type="date" class="input" [class.is-invalid]="!!validationError()"
                     [min]="startDate()" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" name="endDate"/>
            </div>
            <div class="field">
              <label class="field-label" for="session-end-time">End time</label>
              <input id="session-end-time" type="time" class="input" [class.is-invalid]="!!validationError()"
                     [ngModel]="endTime()" (ngModelChange)="onEndTimeChange($event)" name="endTime"/>
            </div>
          </div>

          <div class="duration-preview" [class.is-warning]="spanDays() > 0" [class.is-error]="!!validationError()">
            @if (validationError(); as error) {
              <app-icon name="alert" [size]="16"/> {{ error }}
            } @else if (!endTime()) {
              <span class="live-dot"></span> Still running — set an end time to stop it.
            } @else {
              <app-icon name="clock" [size]="16"/>
              <span><strong class="mono">{{ durationLabel() }}</strong>@if (spanDays() > 0) { · {{ spanLabel() }}}</span>
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

  startDate = signal('');
  startTime = signal('');
  endDate = signal('');
  endTime = signal('');
  note = signal('');
  isBusy = signal(false);

  private wasRunning = false;

  private startInstant = computed(() => this.toInstant(this.startDate(), this.startTime()));
  private endInstant = computed(() => this.toInstant(this.endDate(), this.endTime()));

  /** Calendar days the session covers beyond its first — 0 when it starts and ends the same day. */
  spanDays = computed(() => {
    if (!this.startDate() || !this.endDate()) {
      return 0;
    }
    return Math.max(0, dayDistance(this.startDate(), this.endDate()));
  });

  spanLabel = computed(() => {
    const days = this.spanDays();
    return days === 1 ? 'ends the next day' : `ends ${days} days later`;
  });

  durationLabel = computed(() => {
    const start = this.startInstant();
    const end = this.endInstant();
    if (start === null || end === null) {
      return formatHuman(0);
    }
    return formatHuman((end.getTime() - start.getTime()) / 1000);
  });

  validationError = computed(() => {
    if (!this.endTime()) {
      return this.wasRunning ? null : 'A finished session needs an end time.';
    }
    if (!this.endDate()) {
      return 'A finished session needs an end date.';
    }

    const start = this.startInstant();
    const end = this.endInstant();
    if (start === null || end === null) {
      return null;
    }
    return end.getTime() > start.getTime() ? null : 'The end must be after the start.';
  });

  canSave = computed(() => !!this.startDate() && !!this.startTime() && !this.validationError() && !this.isBusy());

  ngOnInit(): void {
    const session = this.session();
    this.wasRunning = !session.endTime;
    this.startDate.set(this.dateTimeFormat.formatDateForInput(session.startTime));
    this.startTime.set(this.dateTimeFormat.formatTimeForInput(session.startTime));
    this.endDate.set(session.endTime ? this.dateTimeFormat.formatDateForInput(session.endTime) : '');
    this.endTime.set(session.endTime ? this.dateTimeFormat.formatTimeForInput(session.endTime) : '');
    this.note.set(session.notes ?? '');
  }

  /** Moving the start date drags the end date along, so the session keeps its length. */
  onStartDateChange(value: string): void {
    const previous = this.startDate();
    const end = this.endDate();
    if (previous && end && value) {
      this.endDate.set(shiftDate(end, dayDistance(previous, value)));
    }
    this.startDate.set(value);
  }

  onEndTimeChange(value: string): void {
    this.endTime.set(value);
    if (!value) {
      this.endDate.set('');
      return;
    }

    if (!this.endDate()) {
      // Fresh end time: assume the same day, rolling over to the next one when that reads backwards.
      this.endDate.set(value > this.startTime() ? this.startDate() : shiftDate(this.startDate(), 1));
    }
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }

    const request = {
      startTime: `${this.startDate()}T${this.startTime()}:00`,
      endTime: this.endTime() ? `${this.endDate()}T${this.endTime()}:00` : undefined,
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

  private toInstant(date: string, time: string): Date | null {
    if (!date || !/^\d{2}:\d{2}/.test(time ?? '')) {
      return null;
    }
    return this.dateTimeFormat.parseApiDateTime(`${date}T${time.slice(0, 5)}:00`);
  }
}

/** Whole days between two "yyyy-MM-dd" values, counted as calendar days rather than hours. */
function dayDistance(fromDate: string, toDate: string): number {
  return Math.round((toUtcDay(toDate) - toUtcDay(fromDate)) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  const day = toUtcDay(date);
  // The date input can be cleared, which leaves nothing to shift.
  return Number.isNaN(day) ? date : new Date(day + days * 86_400_000).toISOString().slice(0, 10);
}

function toUtcDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}
