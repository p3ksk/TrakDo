import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { SessionsService } from './sessions.service';
import { SessionBusService } from './session-bus.service';
import { DateTimeFormatService } from './date-time-format.service';
import { SettingsService } from './settings.service';
import { formatClock } from '../utils/duration';

export interface RunningSession {
  id: number;
  taskId: number;
  taskTitle: string;
  boardId: number;
  color: string;
  startTime: Date;
}

/**
 * Read-only view of every running session across boards. Powers the sidebar indicator
 * and the browser tab title; start/stop still happens on the board page.
 */
@Injectable({
  providedIn: 'root'
})
export class RunningTimerService {
  private sessionsService = inject(SessionsService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private settingsService = inject(SettingsService);
  private title = inject(Title);

  private readonly baseTitle = 'TrakDo';
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private requestId = 0;

  readonly running = signal<RunningSession[]>([]);
  readonly now = signal(Date.now());
  readonly primary = computed(() => this.running()[0] ?? null);

  constructor() {
    const busSubscription = inject(SessionBusService).sessionsChanged$.subscribe(() => this.refresh());
    inject(DestroyRef).onDestroy(() => {
      busSubscription.unsubscribe();
      this.stopTicking();
    });

    effect(() => {
      const primary = this.primary();
      if (!primary) {
        this.title.setTitle(this.baseTitle);
        return;
      }

      const elapsed = this.elapsedSeconds(primary);
      this.title.setTitle(`${formatClock(elapsed)} · ${primary.taskTitle} – ${this.baseTitle}`);
    });
  }

  elapsedSeconds(session: RunningSession): number {
    return Math.max(0, Math.floor((this.now() - session.startTime.getTime()) / 1000));
  }

  refresh(): void {
    if (!this.settingsService.isLoaded()) {
      return;
    }

    // Asking for sessions that end at or after "now" returns exactly the ones still running.
    const requestId = ++this.requestId;
    this.sessionsService.getSessions(this.dateTimeFormat.formatDateTimeForApi(new Date())).subscribe({
      next: sessions => {
        if (requestId !== this.requestId) {
          return;
        }

        const running = sessions
          .filter(session => !session.endTime)
          .map(session => ({
            id: Number(session.id),
            taskId: Number(session.taskId),
            taskTitle: session.taskTitle || 'Untitled task',
            boardId: Number(session.boardId),
            color: session.color || '#09C1BF',
            startTime: this.dateTimeFormat.parseApiDateTime(session.startTime)
          }))
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        this.running.set(running);
        this.now.set(Date.now());
        running.length > 0 ? this.startTicking() : this.stopTicking();
      },
      error: () => {
        // Non-critical indicator: keep the last known state.
      }
    });
  }

  clear(): void {
    this.requestId++;
    this.running.set([]);
    this.stopTicking();
  }

  private startTicking(): void {
    if (this.tickHandle !== null) {
      return;
    }

    this.tickHandle = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTicking(): void {
    if (this.tickHandle === null) {
      return;
    }

    clearInterval(this.tickHandle);
    this.tickHandle = null;
  }
}
