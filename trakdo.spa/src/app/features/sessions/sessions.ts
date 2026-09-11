import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionsService } from '../../core/services/sessions.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { BoardSelectionService } from '../../core/services/board-selection.service';
import { BoardService } from '../../core/services/board.service';
import { CalendarRangeStateService, CalendarViewMode } from '../../core/services/calendar-range-state.service';
import { SettingsService } from '../../core/services/settings.service';

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
  sessions: SessionNode[];
  totalDuration: number;
  sessionsCount: number;
  isExpanded: boolean;
}

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sessions.html',
  styleUrl: './sessions.css'
})
export class Sessions implements OnInit {
  boardName = signal<string>('Board');
  boardDescription = signal<string>('');
  boardColor = signal<string>('#09C1BF');
  sessionGroups = signal<TaskSessionGroup[]>([]);

  showSessionModal = false;
  selectedSession: SessionNode | null = null;
  editSession = {
    date: '',
    startTime: '',
    endTime: '',
    note: ''
  };

  private isInitialized = false;
  private routeBoardId = signal<number | null>(null);
  private expandedTaskIds = signal<Set<number>>(new Set());
  private loadSessionsRequestId = 0;

  get viewMode(): CalendarViewMode {
    return this.calendarRangeState.viewMode();
  }

  constructor(
    private sessionsService: SessionsService,
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
      this.calendarRangeState.viewMode();
      this.calendarRangeState.currentDate();
      const boardId = this.routeBoardId();

      if (!this.isInitialized || boardId === null) {
        return;
      }

      this.loadSessions();
    });
  }

  ngOnInit(): void {
    this.isInitialized = true;
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

    this.sessionBus.sessionsChanged$.subscribe(() => {
      if (this.routeBoardId() !== null) {
        this.loadSessions();
      }
    });
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

  private loadSessions(): void {
    const boardId = this.routeBoardId();
    if (boardId === null) {
      return;
    }

    const range = this.calendarRangeState.getVisibleRange();
    const requestId = ++this.loadSessionsRequestId;

    this.sessionsService.getSessions(
      this.dateTimeFormat.formatDateTimeForApi(range.start),
      this.dateTimeFormat.formatDateTimeForApi(range.end),
      boardId
    ).subscribe({
      next: sessions => {
        if (requestId !== this.loadSessionsRequestId) {
          return;
        }

        this.boardService.getColumnsWithTasks(boardId).subscribe({
          next: columns => {
            if (requestId !== this.loadSessionsRequestId) {
              return;
            }

            const taskColorByTaskId = this.createTaskColorMap(columns);
            const sessionNodes = sessions.map(session => {
              const startTime = this.dateTimeFormat.parseApiDateTime(session.startTime);
              const endTime = session.endTime ? this.dateTimeFormat.parseApiDateTime(session.endTime) : undefined;
              const duration = Number(session.duration ?? 0);

              return {
                id: Number(session.id),
                taskId: Number(session.taskId),
                taskTitle: session.taskTitle ?? `Task #${session.taskId}`,
                startTime,
                endTime,
                duration,
                notes: session.notes ?? '',
                color: this.resolveSessionColor(session, taskColorByTaskId)
              } satisfies SessionNode;
            });

            this.buildSessionGroups(sessionNodes);
          },
          error: () => {
            if (requestId !== this.loadSessionsRequestId) {
              return;
            }

            const sessionNodes = sessions.map(session => {
              const startTime = this.dateTimeFormat.parseApiDateTime(session.startTime);
              const endTime = session.endTime ? this.dateTimeFormat.parseApiDateTime(session.endTime) : undefined;
              const duration = Number(session.duration ?? 0);

              return {
                id: Number(session.id),
                taskId: Number(session.taskId),
                taskTitle: session.taskTitle ?? `Task #${session.taskId}`,
                startTime,
                endTime,
                duration,
                notes: session.notes ?? '',
                color: this.resolveSessionColor(session, new Map())
              } satisfies SessionNode;
            });

            this.buildSessionGroups(sessionNodes);
          }
        });
      },
      error: err => {
        console.error('Failed to load sessions', err);
        this.sessionGroups.set([]);
      }
    });
  }

  private buildSessionGroups(sessions: SessionNode[]): void {
    const existingExpanded = new Set(this.expandedTaskIds());
    const groupedByTask = new Map<number, SessionNode[]>();
    const taskTitles = new Map<number, string>();

    for (const session of sessions) {
      const existingSessions = groupedByTask.get(session.taskId) ?? [];
      existingSessions.push(session);
      groupedByTask.set(session.taskId, existingSessions);
      taskTitles.set(session.taskId, session.taskTitle);
    }

    const groups = Array.from(groupedByTask.entries())
      .map(([taskId, taskSessions]) => {
        const sortedSessions = [...taskSessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        const totalDuration = sortedSessions.reduce((sum, session) => sum + this.getSessionDuration(session), 0);
        return {
          taskId,
          taskTitle: taskTitles.get(taskId) ?? `Task #${taskId}`,
          sessions: sortedSessions,
          totalDuration,
          sessionsCount: sortedSessions.length,
          isExpanded: existingExpanded.has(taskId) || existingExpanded.size === 0
        } satisfies TaskSessionGroup;
      })
      .sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));

    if (existingExpanded.size === 0) {
      this.expandedTaskIds.set(new Set(groups.map(group => group.taskId)));
    }

    this.sessionGroups.set(groups);
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

  switchView(mode: CalendarViewMode): void {
    this.calendarRangeState.switchView(mode);
  }

  previousPeriod(): void {
    this.calendarRangeState.previousPeriod();
  }

  nextPeriod(): void {
    this.calendarRangeState.nextPeriod();
  }

  goToToday(): void {
    this.calendarRangeState.goToToday();
  }

  expandAllTaskGroups(): void {
    const expandedTaskIds = new Set(this.sessionGroups().map(group => group.taskId));
    this.expandedTaskIds.set(expandedTaskIds);
    this.sessionGroups.update(groups => groups.map(group => ({ ...group, isExpanded: true })));
  }

  collapseAllTaskGroups(): void {
    this.expandedTaskIds.set(new Set());
    this.sessionGroups.update(groups => groups.map(group => ({ ...group, isExpanded: false })));
  }

  hasAnyExpandedGroups(): boolean {
    return this.sessionGroups().some(group => group.isExpanded);
  }

  hasAnyCollapsedGroups(): boolean {
    return this.sessionGroups().some(group => !group.isExpanded);
  }

  toggleTaskGroup(taskId: number): void {
    const expandedTaskIds = new Set(this.expandedTaskIds());
    if (expandedTaskIds.has(taskId)) {
      expandedTaskIds.delete(taskId);
    } else {
      expandedTaskIds.add(taskId);
    }
    this.expandedTaskIds.set(expandedTaskIds);

    this.sessionGroups.update(groups =>
      groups.map(group => group.taskId === taskId ? { ...group, isExpanded: expandedTaskIds.has(taskId) } : group)
    );
  }

  openSessionModal(session: SessionNode): void {
    this.selectedSession = session;
    this.editSession = {
      date: this.dateTimeFormat.formatDateForInput(session.startTime),
      startTime: this.dateTimeFormat.formatTimeForInput(session.startTime),
      endTime: session.endTime ? this.dateTimeFormat.formatTimeForInput(session.endTime) : '',
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

    const request = {
      startTime: this.buildLocalDateTime(this.editSession.date, this.editSession.startTime),
      endTime: this.editSession.endTime ? this.buildLocalDateTime(this.editSession.date, this.editSession.endTime) : undefined,
      notes: this.editSession.note.trim()
    };

    this.sessionsService.updateSession(this.selectedSession.id, request).subscribe({
      next: () => {
        this.closeSessionModal();
        this.loadSessions();
        this.sessionBus.notifySessionsChanged();
      },
      error: err => console.error('Failed to update session', err)
    });
  }

  deleteSession(sessionId: number): void {
    if (!confirm('Delete this session?')) {
      return;
    }

    this.sessionsService.deleteSession(sessionId).subscribe({
      next: () => {
        if (this.selectedSession?.id === sessionId) {
          this.closeSessionModal();
        }
        this.loadSessions();
        this.sessionBus.notifySessionsChanged();
      },
      error: err => console.error('Failed to delete session', err)
    });
  }

  getCurrentPeriodLabel(): string {
    return this.calendarRangeState.getCurrentPeriodLabel();
  }

  formatDate(date: Date): string {
    return this.dateTimeFormat.formatDate(date);
  }

  formatTime(date: Date): string {
    return this.dateTimeFormat.formatTime(date);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) {
      return `${minutes}m`;
    }

    return `${hours}h ${minutes}m`;
  }

  isRunning(session: SessionNode): boolean {
    return !session.endTime;
  }

  getSessionDuration(session: SessionNode): number {
    if (session.duration > 0) {
      return session.duration;
    }

    if (session.endTime) {
      return Math.max(0, Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000));
    }

    return Math.max(0, Math.floor((Date.now() - session.startTime.getTime()) / 1000));
  }

  private buildLocalDateTime(date: string, time: string): string {
    return `${date}T${time}:00`;
  }

  private parseBoardId(rawBoardId: string | null): number | null {
    if (!rawBoardId) {
      return null;
    }

    const parsedBoardId = Number(rawBoardId);
    return Number.isNaN(parsedBoardId) ? null : parsedBoardId;
  }
}
