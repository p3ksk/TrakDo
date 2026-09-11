import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionsService } from '../../core/services/sessions.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { SettingsService } from '../../core/services/settings.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { BoardSelectionService } from '../../core/services/board-selection.service';
import { BoardService } from '../../core/services/board.service';
import { CalendarRangeStateService } from '../../core/services/calendar-range-state.service';
import { formatHuman } from '../../core/utils/duration';
import { PageHeader } from '../../shared/page-header/page-header';
import { RangeToolbar } from '../../shared/range-toolbar/range-toolbar';
import { SessionEdit, EditableSession } from '../../shared/session-edit/session-edit';

interface CalendarSession {
  id: number;
  title: string;
  taskId: number;
  startTime: Date;
  endTime?: Date;
  color: string;
  notes: string;
}

interface EventBlock {
  session: CalendarSession;
  startMinute: number;
  endMinute: number;
  lane: number;
  lanes: number;
  timeLabel: string;
}

interface WeekColumn {
  date: Date;
  key: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  totalSeconds: number;
  blocks: EventBlock[];
}

interface MonthCell {
  date: Date;
  key: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: CalendarSession[];
  totalSeconds: number;
}

const MAX_MONTH_CHIPS = 3;
const MIN_EVENT_MINUTES = 20;

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [PageHeader, RangeToolbar, SessionEdit],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css'
})
export class Calendar implements OnInit {
  private sessionService = inject(SessionsService);
  private sessionBus = inject(SessionBusService);
  private settingsService = inject(SettingsService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private boardSelectionService = inject(BoardSelectionService);
  private boardService = inject(BoardService);
  protected range = inject(CalendarRangeStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly hourHeight = 48;
  readonly maxMonthChips = MAX_MONTH_CHIPS;
  readonly weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly formatHuman = formatHuman;

  sessions = signal<CalendarSession[]>([]);
  isLoading = signal(true);
  boardName = signal<string>('');
  boardDescription = signal<string>('');
  boardColor = signal<string>('#09C1BF');
  editingSession = signal<EditableSession | null>(null);

  /** Ticks every 30s so running sessions and the "now" line stay current. */
  private now = signal(Date.now());
  private routeBoardId = signal<number | null>(null);
  private loadSessionsRequestId = 0;

  weekColumns = computed<WeekColumn[]>(() => {
    this.settingsService.settings();
    this.range.currentDate();
    const sessions = this.sessions();
    const now = this.now();

    return this.range.getWeekDays().map(date => {
      const dayStart = this.dateTimeFormat.startOfDay(date);
      const dayEnd = this.dateTimeFormat.endOfDay(date);
      let totalSeconds = 0;

      const pieces = sessions
        .map(session => {
          const effectiveEnd = session.endTime ?? new Date(now);
          if (session.startTime > dayEnd || effectiveEnd < dayStart) {
            return null;
          }
          const clippedStart = Math.max(session.startTime.getTime(), dayStart.getTime());
          const clippedEnd = Math.min(effectiveEnd.getTime(), dayEnd.getTime() + 1);
          totalSeconds += Math.max(0, (clippedEnd - clippedStart) / 1000);
          return {
            session,
            startMinute: (clippedStart - dayStart.getTime()) / 60000,
            endMinute: (clippedEnd - dayStart.getTime()) / 60000
          };
        })
        .filter((piece): piece is { session: CalendarSession; startMinute: number; endMinute: number } => piece !== null);

      return {
        date,
        key: this.dateTimeFormat.getDateKey(date),
        weekday: this.dateTimeFormat.formatWeekdayShort(date),
        dayNumber: this.dateTimeFormat.getDayOfMonth(date),
        isToday: this.dateTimeFormat.isToday(date),
        totalSeconds,
        blocks: this.layoutBlocks(pieces)
      };
    });
  });

  /** Work hours, stretched to include any session that falls outside them. */
  visibleHours = computed(() => {
    const settings = this.settingsService.settings();
    let startHour = settings.workDayStartHour;
    let endHour = settings.workDayEndHour;

    for (const column of this.weekColumns()) {
      for (const block of column.blocks) {
        startHour = Math.min(startHour, Math.floor(block.startMinute / 60));
        endHour = Math.max(endHour, Math.ceil(Math.max(block.endMinute, block.startMinute + MIN_EVENT_MINUTES) / 60));
      }
    }

    startHour = Math.max(0, startHour);
    endHour = Math.min(24, Math.max(endHour, startHour + 1));
    return Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  });

  nowLineTop = computed(() => {
    const today = this.weekColumns().find(column => column.isToday);
    const hours = this.visibleHours();
    if (!today) {
      return null;
    }

    const minute = (this.now() - this.dateTimeFormat.startOfDay(today.date).getTime()) / 60000;
    const offset = minute - hours[0] * 60;
    if (offset < 0 || offset > hours.length * 60) {
      return null;
    }
    return (offset / 60) * this.hourHeight;
  });

  monthCells = computed<MonthCell[]>(() => {
    this.settingsService.settings();
    const month = this.dateTimeFormat.getMonth(this.range.currentDate());
    const sessions = this.sessions();
    const now = this.now();

    const sessionsByDay = new Map<string, CalendarSession[]>();
    for (const session of [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
      const key = this.dateTimeFormat.getDateKey(session.startTime);
      sessionsByDay.set(key, [...(sessionsByDay.get(key) ?? []), session]);
    }

    return this.range.getMonthGridDays().map(date => {
      const key = this.dateTimeFormat.getDateKey(date);
      const daySessions = sessionsByDay.get(key) ?? [];
      return {
        date,
        key,
        dayNumber: this.dateTimeFormat.getDayOfMonth(date),
        isCurrentMonth: this.dateTimeFormat.getMonth(date) === month,
        isToday: this.dateTimeFormat.isToday(date),
        sessions: daySessions,
        totalSeconds: daySessions.reduce((sum, session) =>
          sum + Math.max(0, ((session.endTime?.getTime() ?? now) - session.startTime.getTime()) / 1000), 0)
      };
    });
  });

  constructor() {
    effect(() => {
      this.settingsService.settings();
      this.range.viewMode();
      this.range.currentDate();
      const boardId = this.routeBoardId();
      if (boardId === null) {
        return;
      }

      untracked(() => this.loadSessions());
    });

    const ticker = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(ticker));
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

  loadSessions(): void {
    const boardId = this.routeBoardId();
    if (boardId === null) {
      return;
    }

    const visibleRange = this.range.getVisibleRange();
    const requestId = ++this.loadSessionsRequestId;
    this.isLoading.set(true);

    this.sessionService.getSessions(
      this.dateTimeFormat.formatDateTimeForApi(visibleRange.start),
      this.dateTimeFormat.formatDateTimeForApi(visibleRange.end),
      boardId
    ).subscribe({
      next: (sessions: any[]) => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }

        this.now.set(Date.now());
        this.sessions.set(sessions.map(s => ({
          id: Number(s.id),
          title: s.taskTitle || 'Untitled task',
          taskId: Number(s.taskId),
          startTime: this.dateTimeFormat.parseApiDateTime(s.startTime),
          endTime: s.endTime ? this.dateTimeFormat.parseApiDateTime(s.endTime) : undefined,
          color: (typeof s.color === 'string' && s.color.trim()) || '#09C1BF',
          notes: s.notes ?? ''
        })));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }
        console.error('Failed to load sessions', err);
        this.sessions.set([]);
        this.isLoading.set(false);
      }
    });
  }

  /** Assigns side-by-side lanes to overlapping sessions within a day. */
  private layoutBlocks(pieces: { session: CalendarSession; startMinute: number; endMinute: number }[]): EventBlock[] {
    const sorted = [...pieces].sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
    const blocks: EventBlock[] = [];
    let cluster: EventBlock[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = -1;

    const flushCluster = () => {
      for (const block of cluster) {
        block.lanes = laneEnds.length;
      }
      cluster = [];
      laneEnds = [];
    };

    for (const piece of sorted) {
      const visualEnd = Math.max(piece.endMinute, piece.startMinute + MIN_EVENT_MINUTES);
      if (piece.startMinute >= clusterEnd) {
        flushCluster();
      }

      let lane = laneEnds.findIndex(end => end <= piece.startMinute);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(visualEnd);
      } else {
        laneEnds[lane] = visualEnd;
      }
      clusterEnd = Math.max(clusterEnd, visualEnd);

      const block: EventBlock = {
        session: piece.session,
        startMinute: piece.startMinute,
        endMinute: piece.endMinute,
        lane,
        lanes: 1,
        timeLabel: `${this.formatTime(piece.session.startTime)} – ${piece.session.endTime ? this.formatTime(piece.session.endTime) : 'now'}`
      };
      cluster.push(block);
      blocks.push(block);
    }
    flushCluster();

    return blocks;
  }

  blockTop(block: EventBlock): number {
    return ((block.startMinute - this.visibleHours()[0] * 60) / 60) * this.hourHeight;
  }

  blockHeight(block: EventBlock): number {
    return (Math.max(block.endMinute - block.startMinute, MIN_EVENT_MINUTES) / 60) * this.hourHeight - 2;
  }

  openSession(session: CalendarSession): void {
    this.editingSession.set({
      id: session.id,
      taskTitle: session.title,
      startTime: session.startTime,
      endTime: session.endTime,
      notes: session.notes,
      color: session.color
    });
  }

  showWeekOf(date: Date): void {
    this.range.showWeekOf(date);
  }

  private parseBoardId(rawBoardId: string | null): number | null {
    if (!rawBoardId) {
      return null;
    }

    const boardId = Number(rawBoardId);
    return Number.isNaN(boardId) ? null : boardId;
  }

  isRunning(session: CalendarSession): boolean {
    return !session.endTime;
  }

  formatTime(date: Date): string {
    return this.dateTimeFormat.formatTime(date);
  }

  formatHour(hour: number): string {
    if (this.settingsService.settings().use24HourTime) {
      return `${hour.toString().padStart(2, '0')}:00`;
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${period}`;
  }
}
