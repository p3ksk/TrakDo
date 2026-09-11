import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionsService } from '../../core/services/sessions.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { SettingsService } from '../../core/services/settings.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { BoardSelectionService } from '../../core/services/board-selection.service';
import {BoardService} from '../../core/services/board.service';
import { CalendarRangeStateService, CalendarViewMode } from '../../core/services/calendar-range-state.service';

interface Session {
  id: number;
  title: string;
  taskId: number;
  startTime: Date;
  endTime?: Date;
  color: string;
  notes: string;
}

interface DayHour {
  hour: number;
  sessions: Session[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css'
})
export class Calendar implements OnInit {
  // Week view
  weekDays: Date[] = [];
  hours: number[] = Array.from({ length: 24 }, (_, i) => i);
  workingHours = computed(() => {
    const settings = this.settingsService.settings();
    const hoursCount = settings.workDayEndHour - settings.workDayStartHour;
    return Array.from({ length: hoursCount }, (_, i) => settings.workDayStartHour + i);
  });

  // Month view
  monthDays: CalendarDay[] = [];

  // Sessions data
  sessions = signal<Session[]>([]);
  boardName = signal<string>('Board');
  boardDescription = signal<string>('');
  boardColor = signal<string>('#09C1BF');

  // Modal
  showSessionModal = false;
  selectedSession: Session | null = null;

  editSession = {
    date: '',
    startTime: '',
    endTime: '',
    note: ''
  };

  private isInitialized = false;
  private routeBoardId = signal<number | null>(null);
  private loadSessionsRequestId = 0;

  get viewMode(): CalendarViewMode {
    return this.calendarRangeState.viewMode();
  }

  constructor(
    private sessionService: SessionsService,
    private sessionBus: SessionBusService,
    private settingsService: SettingsService,
    private dateTimeFormat: DateTimeFormatService,
    private boardSelectionService: BoardSelectionService,
    private boardService: BoardService,
    private calendarRangeState: CalendarRangeStateService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    effect(() => {
      this.settingsService.settings();
      if (!this.isInitialized) {
        return;
      }

      this.generateWeekView();
      this.generateMonthView();
      this.loadSessions();
    });

    effect(() => {
      const selectedBoardId = this.boardSelectionService.selectedBoardId();
      if (!this.isInitialized) {
        return;
      }

      if (this.routeBoardId() !== null) {
        return;
      }

      if (selectedBoardId === null) {
        return;
      }

      this.loadSessions();
    });
  }

  ngOnInit(): void {
    this.isInitialized = true;
    this.generateWeekView();
    this.generateMonthView();
    this.route.paramMap.subscribe(paramMap => {
      const boardId = this.parseBoardId(paramMap.get('boardId'));
      if (boardId === null) {
        this.router.navigate(['/boards']);
        return;
      }
      this.routeBoardId.set(boardId);
      this.boardSelectionService.setSelectedBoard(boardId);
      this.loadBoardName(boardId);
      this.loadSessions();
    });
    this.sessionBus.sessionsChanged$.subscribe(() => this.loadSessions());
  }

  private loadBoardName(boardId: number): void {
    this.boardService.getBoard(boardId).subscribe({
      next: board => {
        this.boardName.set(board.name);
        this.boardDescription.set(board.description || '');
        this.boardColor.set(board.color || '#09C1BF');
      },
      error: () => {
        this.boardName.set('Board');
        this.boardDescription.set('');
        this.boardColor.set('#09C1BF');
      }
    });
  }

  loadSessions(): void {
    const visibleRange = this.calendarRangeState.getVisibleRange();
    const startDate = visibleRange.start;
    const endDate = visibleRange.end;

    const selectedBoardId = this.routeBoardId() ?? this.boardSelectionService.selectedBoardId() ?? undefined;
    const requestId = ++this.loadSessionsRequestId;

    this.sessionService.getSessions(
      this.dateTimeFormat.formatDateTimeForApi(startDate),
      this.dateTimeFormat.formatDateTimeForApi(endDate),
      selectedBoardId
    ).subscribe({
      next: (sessions: any[]) => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }
        const hasBoardIdInResponse = sessions.some(s => s.boardId !== undefined && s.boardId !== null);
        if (selectedBoardId === undefined) {
          this.applySessions(sessions);
          return;
        }

        this.boardService.getColumnsWithTasks(selectedBoardId).subscribe({
          next: columns => {
            if (requestId !== this.loadSessionsRequestId) {
              return;
            }
            const taskColorByTaskId = this.createTaskColorMap(columns);
            const boardTaskIds = new Set(taskColorByTaskId.keys());
            const scopedSessions = hasBoardIdInResponse
              ? sessions.filter(session => Number(session.boardId) === selectedBoardId)
              : sessions.filter(session => boardTaskIds.has(Number(session.taskId)));
            this.applySessions(scopedSessions, taskColorByTaskId);
          },
          error: () => {
            if (requestId !== this.loadSessionsRequestId) {
              return;
            }
            const scopedSessions = hasBoardIdInResponse
              ? sessions.filter(session => Number(session.boardId) === selectedBoardId)
              : sessions;
            this.applySessions(scopedSessions);
          }
        });
      },
      error: (err: any) => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }
        console.error('Failed to load sessions', err);
        this.sessions.set([]);
      }
    });
  }

  private applySessions(sessions: any[], taskColorByTaskId: Map<number, string> = new Map()): void {
    this.sessions.set(sessions.map(s => ({
      id: Number(s.id),
      title: s.taskTitle ?? s.title ?? 'Session',
      taskId: Number(s.taskId),
      startTime: this.dateTimeFormat.parseApiDateTime(s.startTime),
      endTime: s.endTime ? this.dateTimeFormat.parseApiDateTime(s.endTime) : undefined,
      color: this.resolveSessionColor(s, taskColorByTaskId),
      notes: s.notes ?? ''
    })));
  }

  private createTaskColorMap(columns: Column[]): Map<number, string> {
    const taskColorByTaskId = new Map<number, string>();
    for (const column of columns) {
      for (const task of column.tasks) {
        if (task.color && task.color.trim().length > 0) {
          taskColorByTaskId.set(task.id, task.color);
        }
      }
    }
    return taskColorByTaskId;
  }

  private resolveSessionColor(session: any, taskColorByTaskId: Map<number, string>): string {
    const directColor = typeof session.color === 'string' ? session.color.trim() : '';
    if (directColor.length > 0) {
      return directColor;
    }

    const taskId = Number(session.taskId);
    if (!Number.isNaN(taskId)) {
      const taskColor = taskColorByTaskId.get(taskId);
      if (taskColor && taskColor.trim().length > 0) {
        return taskColor;
      }
    }

    return '#09C1BF';
  }

  private parseBoardId(rawBoardId: string | null): number | null {
    if (!rawBoardId) {
      return null;
    }

    const boardId = Number(rawBoardId);
    return Number.isNaN(boardId) ? null : boardId;
  }

  // Week View Methods
  generateWeekView(): void {
    this.weekDays = this.calendarRangeState.getWeekDays();
  }

  getSessionsForDayAndHour(day: Date, hour: number): Session[] {
    return this.sessions().filter(session => {
      const sessionDate = new Date(session.startTime);
      const sessionHour = this.dateTimeFormat.getHour(sessionDate);

      return (
        this.isSameDay(sessionDate, day) &&
        (sessionHour === hour || (sessionHour < hour && this.getSessionEndHour(session) > hour))
      );
    });
  }

  getSessionStyle(session: Session, hour: number): any {
    const startHour = this.dateTimeFormat.getHour(session.startTime);
    const startMinutes = this.dateTimeFormat.getMinute(session.startTime);
    const endTime = this.getSessionEffectiveEnd(session);
    const endHour = this.dateTimeFormat.getHour(endTime);
    const endMinutes = this.dateTimeFormat.getMinute(endTime);

    const duration = (endHour - startHour) + (endMinutes - startMinutes) / 60;
    const topOffset = (startMinutes / 60) * 100;

    // Only show if this is the starting hour
    if (startHour !== hour) {
      return { display: 'none' };
    }

    return {
      'top': `${topOffset}%`,
      'height': `${duration * 100}%`,
      'background': session.color,
      'position': 'absolute',
      'width': '100%',
      'left': '0'
    };
  }

  getSessionEndHour(session: Session): number {
    const endTime = this.getSessionEffectiveEnd(session);
    return this.dateTimeFormat.getHour(endTime) + (this.dateTimeFormat.getMinute(endTime) > 0 ? 1 : 0);
  }

  // Month View Methods
  generateMonthView(): void {
    const month = this.dateTimeFormat.getMonth(this.calendarRangeState.currentDate());
    const monthDays = this.calendarRangeState.getMonthGridDays();

    this.monthDays = [];

    for (const date of monthDays) {
      const calendarDay: CalendarDay = {
        date,
        isCurrentMonth: this.dateTimeFormat.getMonth(date) === month,
        isToday: this.isToday(date)
      };

      this.monthDays.push(calendarDay);
    }
  }

  getSessionsForDay(day: Date): Session[] {
    return this.sessions().filter(session =>
      this.isSameDay(new Date(session.startTime), day)
    );
  }

  // Navigation Methods
  previousPeriod(): void {
    this.calendarRangeState.previousPeriod();
    if (this.viewMode === 'week') {
      this.generateWeekView();
    } else {
      this.generateMonthView();
    }
    this.loadSessions();
  }

  nextPeriod(): void {
    this.calendarRangeState.nextPeriod();
    if (this.viewMode === 'week') {
      this.generateWeekView();
    } else {
      this.generateMonthView();
    }
    this.loadSessions();
  }

  goToToday(): void {
    this.calendarRangeState.goToToday();
    if (this.viewMode === 'week') {
      this.generateWeekView();
    } else {
      this.generateMonthView();
    }
    this.loadSessions();
  }

  switchView(mode: 'week' | 'month'): void {
    this.calendarRangeState.switchView(mode);
    if (mode === 'week') {
      this.generateWeekView();
    } else {
      this.generateMonthView();
    }
    this.loadSessions();
  }

  // Session Modal Methods
  openSessionModal(session: Session): void {
    this.selectedSession = session;
    this.editSession = {
      date: this.formatDateForInput(session.startTime),
      startTime: this.formatTimeForInput(session.startTime),
      endTime: session.endTime ? this.formatTimeForInput(session.endTime) : '',
      note: session.notes ?? ''
    };
    this.showSessionModal = true;
  }

  closeSessionModal(): void {
    this.showSessionModal = false;
    this.selectedSession = null;
    this.editSession = {
      date: '',
      startTime: '',
      endTime: '',
      note: ''
    };
  }

  saveSession(): void {
    if (!this.selectedSession || !this.editSession.date || !this.editSession.startTime) {
      return;
    }

    const updateRequest = {
      startTime: this.buildLocalDateTime(this.editSession.date, this.editSession.startTime),
      endTime: this.editSession.endTime ? this.buildLocalDateTime(this.editSession.date, this.editSession.endTime) : undefined,
      notes: this.editSession.note.trim()
    };

    this.sessionService.updateSession(this.selectedSession.id, updateRequest).subscribe({
      next: () => {
        this.loadSessions();
        this.sessionBus.notifySessionsChanged();
        this.closeSessionModal();
      },
      error: err => console.error('Failed to update session', err)
    });
  }

  deleteSession(sessionId: number): void {
    if (confirm('Delete this session?')) {
      this.sessionService.deleteSession(sessionId).subscribe({
        next: () => {
          this.loadSessions();
          this.sessionBus.notifySessionsChanged();
          this.closeSessionModal();
        },
        error: err => console.error('Failed to delete session', err)
      });
    }
  }

  private buildLocalDateTime(date: string, time: string): string {
    return `${date}T${time}:00`;
  }

  private getSessionEffectiveEnd(session: Session): Date {
    return session.endTime ?? session.startTime;
  }

  // Utility Methods
  isSameDay(date1: Date, date2: Date): boolean {
    return this.dateTimeFormat.isSameDay(date1, date2);
  }

  isToday(date: Date): boolean {
    return this.dateTimeFormat.isToday(date);
  }

  formatDate(date: Date): string {
    return this.dateTimeFormat.formatDate(date);
  }

  formatWeekdayShort(date: Date): string {
    return this.dateTimeFormat.formatWeekdayShort(date);
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

  formatDateForInput(date: Date): string {
    return this.dateTimeFormat.formatDateForInput(date);
  }

  formatTimeForInput(date: Date): string {
    return this.dateTimeFormat.formatTimeForInput(date);
  }

  getCurrentPeriodLabel(): string {
    return this.calendarRangeState.getCurrentPeriodLabel();
  }

  getDayNumber(date: Date): number {
    return this.dateTimeFormat.getDayOfMonth(date);
  }

  getMonthSessionDuration(sessions: Session[]): number {
    return sessions.reduce((total, session) => {
      const endTime = this.getSessionEffectiveEnd(session);
      const duration = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60);
      return total + duration;
    }, 0);
  }
}
