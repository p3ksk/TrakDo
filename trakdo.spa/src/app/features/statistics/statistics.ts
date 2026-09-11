import { Component, DestroyRef, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionsService } from '../../core/services/sessions.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { BoardSelectionService } from '../../core/services/board-selection.service';
import { BoardService } from '../../core/services/board.service';
import { CalendarRangeStateService } from '../../core/services/calendar-range-state.service';
import { SettingsService } from '../../core/services/settings.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { formatHuman, pluralize } from '../../core/utils/duration';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { RangeToolbar } from '../../shared/range-toolbar/range-toolbar';

interface SessionApiResponse {
  id: number | string;
  taskId: number | string;
  taskTitle?: string;
  startTime: string | Date;
  endTime?: string | Date | null;
  duration?: number | string | null;
}

interface StatisticsSession {
  id: number;
  taskId: number;
  taskTitle: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
}

interface OverviewStatistics {
  totalDuration: number;
  sessionsCount: number;
  averageDuration: number;
  activeDays: number;
}

interface DailyTrendPoint {
  date: Date;
  label: string;
  duration: number;
  sessionsCount: number;
  heightPercent: number;
}

interface TopTaskStatistic {
  taskId: number;
  taskTitle: string;
  totalDuration: number;
  sessionsCount: number;
  barPercent: number;
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [Icon, PageHeader, RangeToolbar],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css'
})
export class Statistics implements OnInit {
  readonly pluralize = pluralize;

  boardName = signal<string>('');
  boardDescription = signal<string>('');
  boardColor = signal<string>('#09C1BF');
  sessions = signal<StatisticsSession[]>([]);
  overview = signal<OverviewStatistics>({
    totalDuration: 0,
    sessionsCount: 0,
    averageDuration: 0,
    activeDays: 0
  });
  dailyTrend = signal<DailyTrendPoint[]>([]);
  topTasks = signal<TopTaskStatistic[]>([]);
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);

  private routeBoardId = signal<number | null>(null);
  private loadStatisticsRequestId = 0;

  constructor(
    private sessionsService: SessionsService,
    private sessionBus: SessionBusService,
    private settingsService: SettingsService,
    private dateTimeFormat: DateTimeFormatService,
    private boardSelectionService: BoardSelectionService,
    private boardService: BoardService,
    protected range: CalendarRangeStateService,
    private route: ActivatedRoute,
    private router: Router,
    private destroyRef: DestroyRef
  ) {
    effect(() => {
      this.settingsService.settings();
      this.range.viewMode();
      this.range.currentDate();
      if (this.routeBoardId() === null) {
        return;
      }

      untracked(() => this.loadStatistics());
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(paramMap => {
      const boardId = this.parseBoardId(paramMap.get('boardId'));
      if (boardId === null) {
        this.navigateToSelectedBoardStatistics();
        return;
      }

      this.boardSelectionService.setSelectedBoard(boardId);
      this.loadBoardName(boardId);
      this.routeBoardId.set(boardId);
    });

    this.sessionBus.sessionsChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.routeBoardId() !== null) {
        this.loadStatistics();
      }
    });
  }

  private navigateToSelectedBoardStatistics(): void {
    const selectedBoardId = this.boardSelectionService.selectedBoardId();
    if (selectedBoardId !== null) {
      this.router.navigate(['/board', selectedBoardId, 'statistics']);
      return;
    }

    this.boardService.getBoards().subscribe({
      next: boards => {
        if (boards.length === 0) {
          this.router.navigate(['/boards']);
          return;
        }

        const fallbackBoardId = boards[0].id;
        this.boardSelectionService.setSelectedBoard(fallbackBoardId);
        this.router.navigate(['/board', fallbackBoardId, 'statistics']);
      },
      error: () => this.router.navigate(['/boards'])
    });
  }

  formatDuration(seconds: number): string {
    return formatHuman(seconds);
  }

  sharePercent(task: TopTaskStatistic): number {
    const total = this.overview().totalDuration;
    return total > 0 ? Math.round((task.totalDuration / total) * 100) : 0;
  }

  formatHours(seconds: number): string {
    return `${(seconds / 3600).toFixed(1)}h`;
  }

  formatDay(date: Date): string {
    return this.dateTimeFormat.formatMonthDay(date);
  }

  formatTrendTooltip(point: DailyTrendPoint): string {
    return `${this.formatDay(point.date)} · ${this.formatDuration(point.duration)} · ${pluralize(point.sessionsCount, 'session')}`;
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

  private loadStatistics(): void {
    const boardId = this.routeBoardId();
    if (boardId === null) {
      return;
    }

    const range = this.range.getPeriodRange();
    const requestId = ++this.loadStatisticsRequestId;
    this.isLoading.set(true);
    this.hasError.set(false);

    this.sessionsService.getSessions(
      this.dateTimeFormat.formatDateTimeForApi(range.start),
      this.dateTimeFormat.formatDateTimeForApi(range.end),
      boardId
    ).subscribe({
      next: (sessions: SessionApiResponse[]) => {
        if (requestId !== this.loadStatisticsRequestId) {
          return;
        }

        const parsedSessions = this.parseSessions(sessions);
        this.sessions.set(parsedSessions);
        this.computeStatistics(parsedSessions, range.start, range.end);
        this.isLoading.set(false);
      },
      error: err => {
        if (requestId !== this.loadStatisticsRequestId) {
          return;
        }

        console.error('Failed to load statistics', err);
        this.resetStatistics(range.start, range.end);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  private parseSessions(sessions: SessionApiResponse[]): StatisticsSession[] {
    return sessions
      .map((session): StatisticsSession | null => {
        const taskId = Number(session.taskId);
        const id = Number(session.id);

        if (Number.isNaN(taskId) || Number.isNaN(id)) {
          return null;
        }

        const parsedDuration = Number(session.duration ?? 0);
        const parsedSession: StatisticsSession = {
          id,
          taskId,
          taskTitle: session.taskTitle ?? `Task #${taskId}`,
          startTime: this.dateTimeFormat.parseApiDateTime(session.startTime),
          endTime: session.endTime ? this.dateTimeFormat.parseApiDateTime(session.endTime) : undefined,
          duration: Number.isNaN(parsedDuration) ? 0 : parsedDuration
        };

        return parsedSession;
      })
      .filter((session): session is StatisticsSession => session !== null);
  }

  private computeStatistics(sessions: StatisticsSession[], rangeStart: Date, rangeEnd: Date): void {
    const totalDuration = sessions.reduce((sum, session) => sum + this.getSessionDuration(session), 0);
    const sessionsCount = sessions.length;
    const activeDays = new Set(
      sessions
        .filter(session => this.getSessionDuration(session) > 0)
        .map(session => this.dateTimeFormat.getDateKey(session.startTime))
    ).size;

    this.overview.set({
      totalDuration,
      sessionsCount,
      averageDuration: sessionsCount > 0 ? Math.floor(totalDuration / sessionsCount) : 0,
      activeDays
    });

    this.dailyTrend.set(this.buildDailyTrend(sessions, rangeStart, rangeEnd));
    this.topTasks.set(this.buildTopTasks(sessions));
    this.hasError.set(false);
  }

  private buildDailyTrend(sessions: StatisticsSession[], rangeStart: Date, rangeEnd: Date): DailyTrendPoint[] {
    const byDate = new Map<string, { duration: number; sessionsCount: number }>();

    for (const session of sessions) {
      const key = this.dateTimeFormat.getDateKey(session.startTime);
      const current = byDate.get(key) ?? { duration: 0, sessionsCount: 0 };
      current.duration += this.getSessionDuration(session);
      current.sessionsCount += 1;
      byDate.set(key, current);
    }

    const rangeDays = this.getRangeDays(rangeStart, rangeEnd);
    const maxDuration = rangeDays.reduce((max, day) => {
      const duration = byDate.get(this.dateTimeFormat.getDateKey(day))?.duration ?? 0;
      return Math.max(max, duration);
    }, 0);

    return rangeDays.map(day => {
      const aggregate = byDate.get(this.dateTimeFormat.getDateKey(day));
      const duration = aggregate?.duration ?? 0;
      return {
        date: day,
        label: this.getTrendLabel(day),
        duration,
        sessionsCount: aggregate?.sessionsCount ?? 0,
        heightPercent: maxDuration > 0 && duration > 0 ? Math.max(8, Math.round((duration / maxDuration) * 100)) : 0
      } satisfies DailyTrendPoint;
    });
  }

  private buildTopTasks(sessions: StatisticsSession[]): TopTaskStatistic[] {
    const byTask = new Map<number, { title: string; totalDuration: number; sessionsCount: number }>();

    for (const session of sessions) {
      const current = byTask.get(session.taskId) ?? {
        title: session.taskTitle,
        totalDuration: 0,
        sessionsCount: 0
      };
      current.totalDuration += this.getSessionDuration(session);
      current.sessionsCount += 1;
      byTask.set(session.taskId, current);
    }

    const ranked = Array.from(byTask.entries())
      .map(([taskId, value]) => ({
        taskId,
        taskTitle: value.title,
        totalDuration: value.totalDuration,
        sessionsCount: value.sessionsCount
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 6);

    const maxDuration = ranked.length > 0 ? ranked[0].totalDuration : 0;
    return ranked.map(task => ({
      ...task,
      barPercent: maxDuration > 0 ? Math.max(10, Math.round((task.totalDuration / maxDuration) * 100)) : 0
    }));
  }

  private getRangeDays(rangeStart: Date, rangeEnd: Date): Date[] {
    const rangeDays: Date[] = [];
    let current = rangeStart;
    const endKey = this.dateTimeFormat.getDateKey(rangeEnd);
    let safetyCounter = 0;

    while (this.dateTimeFormat.getDateKey(current) <= endKey && safetyCounter < 400) {
      rangeDays.push(current);
      current = this.dateTimeFormat.addDays(current, 1);
      safetyCounter += 1;
    }

    return rangeDays;
  }

  private getTrendLabel(date: Date): string {
    if (this.range.viewMode() === 'week') {
      return `${this.dateTimeFormat.formatWeekdayShort(date)} ${this.dateTimeFormat.getDayOfMonth(date)}`;
    }

    return `${this.dateTimeFormat.getDayOfMonth(date)}`;
  }

  private getSessionDuration(session: StatisticsSession): number {
    if (session.duration > 0) {
      return session.duration;
    }

    if (session.endTime) {
      return Math.max(0, Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000));
    }

    return Math.max(0, Math.floor((Date.now() - session.startTime.getTime()) / 1000));
  }

  private resetStatistics(rangeStart: Date, rangeEnd: Date): void {
    this.sessions.set([]);
    this.overview.set({
      totalDuration: 0,
      sessionsCount: 0,
      averageDuration: 0,
      activeDays: 0
    });
    this.topTasks.set([]);
    this.dailyTrend.set(this.buildDailyTrend([], rangeStart, rangeEnd));
  }

  private parseBoardId(rawBoardId: string | null): number | null {
    if (!rawBoardId) {
      return null;
    }

    const parsedBoardId = Number(rawBoardId);
    return Number.isNaN(parsedBoardId) ? null : parsedBoardId;
  }
}
