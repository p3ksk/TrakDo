import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionsService } from '../../core/services/sessions.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { BoardSelectionService } from '../../core/services/board-selection.service';
import { BoardService } from '../../core/services/board.service';
import { CalendarRangeStateService } from '../../core/services/calendar-range-state.service';
import { SettingsService } from '../../core/services/settings.service';
import { NotificationService } from '../../core/services/notification.service';
import { formatHuman, pluralize } from '../../core/utils/duration';
import { InstantRange, overlapSeconds, spanDays, totalSeconds } from '../../core/utils/session-span';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { RangeToolbar } from '../../shared/range-toolbar/range-toolbar';
import { EditableSession, SessionEdit } from '../../shared/session-edit/session-edit';

interface SessionNode {
  id: number;
  taskId: number;
  taskTitle: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  notes: string;
  color: string;
}

interface TaskSessionGroup {
  taskId: number;
  taskTitle: string;
  color: string;
  sessions: SessionNode[];
  totalDuration: number;
  lastActivity: number;
  isRunning: boolean;
}

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [Icon, PageHeader, RangeToolbar, SessionEdit],
  templateUrl: './sessions.html',
  styleUrl: './sessions.css'
})
export class Sessions implements OnInit {
  private sessionsService = inject(SessionsService);
  private sessionBus = inject(SessionBusService);
  private settingsService = inject(SettingsService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private boardSelectionService = inject(BoardSelectionService);
  private boardService = inject(BoardService);
  private notification = inject(NotificationService);
  protected range = inject(CalendarRangeStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly formatHuman = formatHuman;
  readonly pluralize = pluralize;

  boardName = signal<string>('');
  boardDescription = signal<string>('');
  boardColor = signal<string>('#09C1BF');
  isLoading = signal(true);
  editingSession = signal<EditableSession | null>(null);

  private sessionNodes = signal<SessionNode[]>([]);
  private collapsedTaskIds = signal<Set<number>>(new Set());
  private now = signal(Date.now());
  private routeBoardId = signal<number | null>(null);
  /** The period the loaded sessions were fetched for; durations are reported against it. */
  private loadedRange = signal<InstantRange | null>(null);
  private loadSessionsRequestId = 0;

  sessionGroups = computed<TaskSessionGroup[]>(() => {
    this.now();
    const groups = new Map<number, TaskSessionGroup>();

    for (const session of this.sessionNodes()) {
      const group = groups.get(session.taskId) ?? {
        taskId: session.taskId,
        taskTitle: session.taskTitle,
        color: session.color,
        sessions: [],
        totalDuration: 0,
        lastActivity: 0,
        isRunning: false
      };
      group.sessions.push(session);
      group.totalDuration += this.getPeriodDuration(session);
      group.lastActivity = Math.max(group.lastActivity, session.startTime.getTime());
      group.isRunning ||= this.isRunning(session);
      groups.set(session.taskId, group);
    }

    return Array.from(groups.values())
      .map(group => ({ ...group, sessions: [...group.sessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime()) }))
      .sort((a, b) => Number(b.isRunning) - Number(a.isRunning) || b.lastActivity - a.lastActivity);
  });

  totals = computed(() => ({
    sessions: this.sessionNodes().length,
    duration: this.sessionGroups().reduce((sum, group) => sum + group.totalDuration, 0)
  }));

  constructor() {
    effect(() => {
      this.settingsService.settings();
      this.range.viewMode();
      this.range.currentDate();
      if (this.routeBoardId() === null) {
        return;
      }

      untracked(() => this.loadSessions());
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(paramMap => {
      const boardId = this.parseBoardId(paramMap.get('boardId'));
      if (boardId === null) {
        this.router.navigate(['/boards']);
        return;
      }

      this.boardSelectionService.setSelectedBoard(boardId);
      this.loadBoardName(boardId);
      this.routeBoardId.set(boardId);
    });

    this.sessionBus.sessionsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSessions());

    // Keep durations of running sessions fresh.
    const ticker = setInterval(() => {
      if (this.sessionNodes().some(session => this.isRunning(session))) {
        this.now.set(Date.now());
      }
    }, 30_000);
    this.destroyRef.onDestroy(() => clearInterval(ticker));
  }

  private loadBoardName(boardId: number): void {
    this.boardService.getBoard(boardId).subscribe({
      next: board => {
        this.boardName.set(board.name);
        this.boardDescription.set(board.description || '');
        this.boardColor.set(board.color || '#09C1BF');
      },
      error: () => this.router.navigate(['/boards'])
    });
  }

  private loadSessions(): void {
    const boardId = this.routeBoardId();
    if (boardId === null) {
      return;
    }

    const range = this.range.getPeriodRange();
    const requestId = ++this.loadSessionsRequestId;
    this.isLoading.set(true);

    this.sessionsService.getSessions(
      this.dateTimeFormat.formatDateTimeForApi(range.start),
      this.dateTimeFormat.formatDateTimeForApi(range.end),
      boardId
    ).subscribe({
      next: sessions => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }

        this.now.set(Date.now());
        this.loadedRange.set(range);
        this.sessionNodes.set(sessions.map(session => ({
          id: Number(session.id),
          taskId: Number(session.taskId),
          taskTitle: session.taskTitle || `Task #${session.taskId}`,
          startTime: this.dateTimeFormat.parseApiDateTime(session.startTime),
          endTime: session.endTime ? this.dateTimeFormat.parseApiDateTime(session.endTime) : undefined,
          duration: Number(session.duration ?? 0),
          notes: session.notes ?? '',
          color: (typeof session.color === 'string' && session.color.trim()) || '#09C1BF'
        })));
        this.isLoading.set(false);
      },
      error: err => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }
        console.error('Failed to load sessions', err);
        this.sessionNodes.set([]);
        this.isLoading.set(false);
        this.notification.error('Failed to load sessions.');
      }
    });
  }

  isExpanded(taskId: number): boolean {
    return !this.collapsedTaskIds().has(taskId);
  }

  toggleTaskGroup(taskId: number): void {
    this.collapsedTaskIds.update(collapsed => {
      const next = new Set(collapsed);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  expandAll(): void {
    this.collapsedTaskIds.set(new Set());
  }

  collapseAll(): void {
    this.collapsedTaskIds.set(new Set(this.sessionGroups().map(group => group.taskId)));
  }

  allCollapsed(): boolean {
    const groups = this.sessionGroups();
    return groups.length > 0 && groups.every(group => this.collapsedTaskIds().has(group.taskId));
  }

  openSession(session: SessionNode): void {
    this.editingSession.set({
      id: session.id,
      taskTitle: session.taskTitle,
      startTime: session.startTime,
      endTime: session.endTime,
      notes: session.notes,
      color: session.color
    });
  }

  deleteSession(session: SessionNode): void {
    if (!confirm(`Delete this ${formatHuman(this.getFullDuration(session))} session on "${session.taskTitle}"?`)) {
      return;
    }

    this.sessionsService.deleteSession(session.id).subscribe({
      next: () => this.sessionBus.notifySessionsChanged(),
      error: () => this.notification.error('Failed to delete session.')
    });
  }

  formatDay(date: Date): string {
    return `${this.dateTimeFormat.formatWeekdayShort(date)}, ${this.dateTimeFormat.formatDate(date)}`;
  }

  formatTime(date: Date): string {
    return this.dateTimeFormat.formatTime(date);
  }

  isRunning(session: SessionNode): boolean {
    return !session.endTime;
  }

  /**
   * Seconds of the session that fall inside the period on screen. A session that crosses the
   * period boundary only contributes its share, so the rows add up to the header total.
   */
  getPeriodDuration(session: SessionNode): number {
    const range = this.loadedRange();
    if (!range) {
      return this.getFullDuration(session);
    }

    return Math.floor(overlapSeconds(session, range, this.now()));
  }

  /** The session's whole length, which for a session spilling out of the period is longer. */
  getFullDuration(session: SessionNode): number {
    return Math.floor(totalSeconds(session, this.now()));
  }

  /** 0 when the session starts and ends on the same day, 1 when it ends the next day, and so on. */
  getSpanDays(session: SessionNode): number {
    return spanDays(session, this.dateTimeFormat, this.now());
  }

  durationTitle(session: SessionNode): string {
    const full = this.getFullDuration(session);
    if (full === this.getPeriodDuration(session)) {
      return '';
    }

    return `${formatHuman(full)} in total — the rest falls outside this ${this.range.viewMode()}`;
  }

  spanTitle(session: SessionNode): string {
    return session.endTime
      ? `Ends ${this.formatDay(session.endTime)} at ${this.formatTime(session.endTime)}`
      : 'Still running';
  }

  private parseBoardId(rawBoardId: string | null): number | null {
    if (!rawBoardId) {
      return null;
    }

    const parsedBoardId = Number(rawBoardId);
    return Number.isNaN(parsedBoardId) ? null : parsedBoardId;
  }
}
