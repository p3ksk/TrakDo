import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {BoardService} from '../../../core/services/board.service';
import {TaskService} from '../../../core/services/task.service';
import {SessionsService} from '../../../core/services/sessions.service';
import {NotificationService} from '../../../core/services/notification.service';
import { SessionBusService } from '../../../core/services/session-bus.service';
import {DateTimeFormatService} from '../../../core/services/date-time-format.service';
import {BoardSelectionService} from '../../../core/services/board-selection.service';
import {Observable, Subscription} from 'rxjs';
import {getPriorityOption, PRIORITY_OPTIONS, PriorityOption, TaskPriority} from '../../../core/models/priority.model';
import {formatClock, formatHuman, pluralize} from '../../../core/utils/duration';
import {spanDays} from '../../../core/utils/session-span';
import {COLOR_OPTIONS} from '../../../core/models/color.model';
import {Icon} from '../../../shared/icon/icon';
import {Modal} from '../../../shared/modal/modal';
import {PageHeader} from '../../../shared/page-header/page-header';

interface ColumnFormState {
  column: Column | null; // null = create
  name: string;
}

interface TaskFormState {
  task: Task | null; // null = create
  columnId: number;
  title: string;
  description: string;
  taskPriority: TaskPriority;
  dueDate: string;
  color: string;
}

@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [FormsModule, Icon, Modal, PageHeader],
  templateUrl: './board-detail.html',
  styleUrl: './board-detail.css'
})
export class BoardDetail implements OnInit, OnDestroy {
  private routeSubscription?: Subscription;

  board: Board | null = null;
  columns: Column[] = [];
  isLoading = true;
  isSaving = false;

  columnForm: ColumnFormState | null = null;
  taskForm: TaskFormState | null = null;
  selectedTask: Task | null = null;

  draggedTask: Task | null = null;
  draggedFromColumn: Column | null = null;
  dragOverColumnId: number | null = null;

  timerIntervals: Map<number, any> = new Map();
  currentElapsedTimes: Map<number, number> = new Map();

  readonly colorOptions = COLOR_OPTIONS;
  readonly priorityOptions = PRIORITY_OPTIONS.filter(option => option.value !== TaskPriority.Critical);
  readonly formatClock = formatClock;
  readonly formatHuman = formatHuman;
  readonly pluralize = pluralize;

  constructor(private boardService: BoardService, private taskService: TaskService,
    private sessionService: SessionsService, private sessionBus: SessionBusService, private notification: NotificationService,
    private route: ActivatedRoute, private router: Router, private cdr: ChangeDetectorRef, private dateTimeFormat: DateTimeFormatService,
    private boardSelectionService: BoardSelectionService) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(paramMap => {
      const routeParameter = paramMap.get('boardId');
      if (!routeParameter) {
        this.router.navigate(['/boards']);
        return;
      }

      const boardId = Number(routeParameter);
      if (Number.isNaN(boardId)) {
        this.router.navigate(['/boards']);
        return;
      }

      this.isLoading = true;
      this.board = null;
      this.columns = [];
      this.boardSelectionService.setSelectedBoard(boardId);
      this.loadBoard(boardId);
      this.loadColumns(boardId);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.clearTimerTracking();
  }

  loadBoard(boardId: number): void {
    this.boardService.getBoard(boardId).subscribe({
      next: board => {
        this.board = board;
        this.cdr.markForCheck();
      },
      error: _ => {
        this.router.navigate(['/boards']);
      }
    });
  }

  /** Reloads columns (and restarts running timers). Pass a task id to keep its detail dialog open. */
  loadColumns(boardId: number, keepTaskOpenId?: number): void {
    this.boardService.getColumnsWithTasks(boardId).subscribe({
      next: columns => {
        this.clearTimerTracking();
        this.columns = columns;
        this.startUnfinishedSessions();
        this.selectedTask = keepTaskOpenId !== undefined
          ? this.columns.flatMap(column => column.tasks).find(task => task.id === keepTaskOpenId) ?? null
          : null;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        console.error(err);
        this.isLoading = false;
        this.notification.error('Failed to load tasks.');
        this.cdr.markForCheck();
      }
    });
  }

  private clearTimerTracking(): void {
    this.timerIntervals.forEach(interval => clearInterval(interval));
    this.timerIntervals.clear();
    this.currentElapsedTimes.clear();
  }

  // Column Management
  openCreateColumn(): void {
    this.columnForm = { column: null, name: '' };
  }

  openRenameColumn(column: Column): void {
    this.columnForm = { column, name: column.name };
  }

  closeColumnForm(): void {
    this.columnForm = null;
  }

  saveColumn(): void {
    const form = this.columnForm;
    const name = form?.name.trim();
    if (!form || !name || !this.board || this.isSaving) return;

    this.isSaving = true;
    const request: Observable<unknown> = form.column
      ? this.boardService.updateColumn(this.board.id, form.column.id, { name, sortOrder: form.column.sortOrder ?? 0 })
      : this.boardService.createColumn({ name, sortOrder: this.getNextColumnSortOrder() }, this.board.id);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        if (form.column) {
          form.column.name = name;
        } else {
          this.loadColumns(this.board!.id);
        }
        this.closeColumnForm();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSaving = false;
        this.notification.error(form.column ? 'Failed to rename column.' : 'Failed to add column.');
        this.cdr.markForCheck();
      }
    });
  }

  deleteColumn(column: Column): void {
    const taskCount = column.tasks.length;
    const message = taskCount > 0
      ? `Delete column "${column.name}" and its ${pluralize(taskCount, 'task')}? Tracked sessions for those tasks will be deleted too.`
      : `Delete column "${column.name}"?`;
    if (!confirm(message)) return;

    this.boardService.deleteColumn(column.id, this.board!.id).subscribe({
      next: () => this.loadColumns(this.board!.id),
      error: () => {
        this.notification.error('Failed to delete column.');
        this.cdr.markForCheck();
      }
    });
  }

  private getNextColumnSortOrder(): number {
    return this.columns.reduce((max, column) => Math.max(max, column.sortOrder ?? 0), 0) + 1;
  }

  // Task Management
  openCreateTask(column: Column): void {
    this.taskForm = {
      task: null,
      columnId: column.id,
      title: '',
      description: '',
      taskPriority: TaskPriority.None,
      dueDate: '',
      color: this.colorOptions[0].value
    };
  }

  openEditTask(task: Task): void {
    this.taskForm = {
      task,
      columnId: task.columnId,
      title: task.title,
      description: task.description ?? '',
      taskPriority: (task.taskPriority ?? TaskPriority.None) as TaskPriority,
      dueDate: task.dueDate ? this.dateTimeFormat.formatDateForInput(this.dateTimeFormat.parseApiDateTime(task.dueDate)) : '',
      color: task.color || this.colorOptions[0].value
    };
  }

  closeTaskForm(): void {
    this.taskForm = null;
  }

  saveTask(): void {
    const form = this.taskForm;
    const title = form?.title.trim();
    if (!form || !title || !this.board || this.isSaving) return;

    const payload: TaskPayload = {
      title,
      description: form.description.trim(),
      color: form.color,
      taskPriority: form.taskPriority === TaskPriority.None ? null : form.taskPriority,
      estimatedMinutes: form.task?.estimatedMinutes ?? null,
      sortOrder: form.task?.sortOrder ?? 0,
      dueDate: form.dueDate || null
    };

    this.isSaving = true;
    if (form.task) {
      const task = form.task;
      this.taskService.updateTask(task.id, payload).subscribe({
        next: () => {
          task.title = payload.title;
          task.description = payload.description;
          task.color = payload.color;
          task.taskPriority = payload.taskPriority;
          task.dueDate = payload.dueDate ? `${payload.dueDate}T00:00:00` : null;
          this.isSaving = false;
          this.closeTaskForm();
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSaving = false;
          this.notification.error('Failed to save task.');
          this.cdr.markForCheck();
        }
      });
      return;
    }

    this.taskService.createTask({ ...payload, boardId: this.board.id, columnId: form.columnId }).subscribe({
      next: () => {
        this.isSaving = false;
        this.closeTaskForm();
        this.loadColumns(this.board!.id);
      },
      error: () => {
        this.isSaving = false;
        this.notification.error('Failed to create task.');
        this.cdr.markForCheck();
      }
    });
  }

  openTaskDetail(task: Task): void {
    this.selectedTask = task;
  }

  closeTaskDetail(): void {
    this.selectedTask = null;
  }

  deleteTask(task: Task): void {
    const sessionsCount = task.sessions.length;
    const message = sessionsCount > 0
      ? `Delete "${task.title}" and its ${pluralize(sessionsCount, 'tracked session')}?`
      : `Delete "${task.title}"?`;
    if (!confirm(message)) return;

    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.closeTaskDetail();
        this.loadColumns(this.board!.id);
        this.sessionBus.notifySessionsChanged();
      },
      error: () => {
        this.notification.error('Failed to delete task.');
        this.cdr.markForCheck();
      }
    });
  }

  moveTaskToColumn(task: Task, columnId: number | string): void {
    const targetColumnId = Number(columnId);
    if (task.columnId === targetColumnId) return;

    this.taskService.moveTask(task.id, targetColumnId).subscribe({
      next: () => this.loadColumns(this.board!.id, this.selectedTask?.id),
      error: () => {
        this.notification.error('Failed to move task.');
        this.loadColumns(this.board!.id, this.selectedTask?.id);
      }
    });
  }

  // Drag and Drop
  onDragStart(event: DragEvent, task: Task, column: Column): void {
    this.draggedTask = task;
    this.draggedFromColumn = column;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(task.id));
    }
  }

  onDragOver(event: DragEvent, column: Column): void {
    if (!this.draggedTask) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverColumnId = column.id;
  }

  onDragLeave(event: DragEvent, column: Column): void {
    const columnElement = event.currentTarget as HTMLElement;
    if (this.dragOverColumnId === column.id && !columnElement.contains(event.relatedTarget as Node | null)) {
      this.dragOverColumnId = null;
    }
  }

  onDrop(event: DragEvent, targetColumn: Column): void {
    event.preventDefault();
    this.dragOverColumnId = null;

    const task = this.draggedTask;
    const sourceColumn = this.draggedFromColumn;
    this.draggedTask = null;
    this.draggedFromColumn = null;
    if (!task || !sourceColumn || sourceColumn.id === targetColumn.id) return;

    // Move locally right away so the card doesn't jump back while the request is in flight.
    sourceColumn.tasks = sourceColumn.tasks.filter(existingTask => existingTask.id !== task.id);
    targetColumn.tasks = [...targetColumn.tasks, task];
    task.columnId = targetColumn.id;

    this.taskService.moveTask(task.id, targetColumn.id).subscribe({
      next: _ => {
        this.loadColumns(this.board!.id);
      },
      error: () => {
        this.notification.error('Failed to move task.');
        this.loadColumns(this.board!.id);
      }
    });
  }

  onDragEnd(): void {
    this.draggedTask = null;
    this.draggedFromColumn = null;
    this.dragOverColumnId = null;
  }

  // Utility Methods
  getPriority(task: Task): PriorityOption | null {
    return getPriorityOption(task.taskPriority);
  }

  getColumnName(columnId: number): string {
    return this.columns.find(column => column.id === columnId)?.name ?? '';
  }

  formatDate(date: Date | string): string {
    return this.dateTimeFormat.formatDate(this.dateTimeFormat.parseApiDateTime(date));
  }

  getTotalTasks(): number {
    return this.columns.reduce((sum, col) => sum + col.tasks.length, 0);
  }

  getBoardTrackedTime(): number {
    return this.columns.reduce((sum, column) => sum + column.tasks.reduce((taskSum, task) => taskSum + this.getTotalTimeSpent(task), 0), 0);
  }

  getSortedSessions(task: Task): Session[] {
    return [...task.sessions].sort((a, b) =>
      this.dateTimeFormat.parseApiDateTime(b.startTime).getTime() - this.dateTimeFormat.parseApiDateTime(a.startTime).getTime());
  }

  isLiveSession(task: Task, session: Session): boolean {
    return task.isTimerRunning && task.currentSession?.id === session.id;
  }

  // Timer Methods
  startTimer(task: Task, event: Event): void {
    event.stopPropagation();

    if (task.isTimerRunning) return;

    this.sessionService.startSession(task.id).subscribe({
      next: session => {
        task.currentSession = session;
        task.isTimerRunning = true;
        this.currentElapsedTimes.set(task.id, 0);
        const interval = setInterval(() => {
          if (task.currentSession?.startTime) {
            const startTime = this.dateTimeFormat.parseApiDateTime(task.currentSession.startTime);
            const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
            this.currentElapsedTimes.set(task.id, elapsed);
            this.cdr.markForCheck();
          }
        }, 1000);

        this.timerIntervals.set(task.id, interval);
        this.cdr.markForCheck();
        this.sessionBus.notifySessionsChanged();
      },
      error: () => {
        this.notification.error('Could not start the timer. Please try again.');
        this.cdr.markForCheck();
      }
    })
  }

  stopTimer(task: Task, event: Event): void {
    event.stopPropagation();

    if (!task.isTimerRunning || !task.currentSession?.startTime) return;

    this.sessionService.stopSession(task.currentSession!.id).subscribe({
      next: session => {
        const existingSessionIndex = task.sessions.findIndex(existingSession => existingSession.id === session.id);
        if (existingSessionIndex >= 0) {
          task.sessions[existingSessionIndex] = session;
        } else {
          task.sessions.push(session);
        }
        task.isTimerRunning = false;
        task.currentSession = undefined;
        this.cdr.markForCheck();
        this.sessionBus.notifySessionsChanged();
      },
      error: () => {
        this.notification.error('Could not stop the timer. Reloading the board.');
        this.loadColumns(this.board!.id, this.selectedTask?.id);
      }
    })

    // Clear interval
    const interval = this.timerIntervals.get(task.id);
    if (interval) {
      clearInterval(interval);
      this.timerIntervals.delete(task.id);
    }
    this.currentElapsedTimes.delete(task.id);
  }

  startUnfinishedSessions() {
    this.columns.flatMap(column => column.tasks).forEach(task => {
      if (task.sessions.some(session => session.endTime === undefined)) {
        const unfinishedSession = task.sessions.find(session => session.endTime === undefined);
        if (!unfinishedSession) return;
        task.isTimerRunning = true;
        task.currentSession = unfinishedSession;
        this.currentElapsedTimes.set(task.id, 0);
        const interval = setInterval(() => {
          if (unfinishedSession?.startTime) {
            const startTime = this.dateTimeFormat.parseApiDateTime(unfinishedSession.startTime);
            const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
            this.currentElapsedTimes.set(task.id, elapsed);
            this.cdr.markForCheck();
          }
        }, 1000);

        this.timerIntervals.set(task.id, interval);
      }
    });
  }

  getCurrentElapsedTime(task: Task): number {
    if (!task.isTimerRunning) return 0;
    return this.currentElapsedTimes.get(task.id) || 0;
  }

  getTotalTimeSpent(task: Task): number {
    const sessionsTotal = task.sessions.reduce((sum, session) => {
      const duration = Number(session.duration);
      return sum + (Number.isFinite(duration) ? duration : 0);
    }, 0);
    const currentSession = this.getCurrentElapsedTime(task);
    return sessionsTotal + currentSession;
  }

  formatDuration(seconds: number): string {
    return formatClock(seconds);
  }

  formatSessionDate(session: Session): string {
    return this.dateTimeFormat.format(this.dateTimeFormat.parseApiDateTime(session.startTime), 'EEE') + ', '
      + this.dateTimeFormat.formatDate(this.dateTimeFormat.parseApiDateTime(session.startTime));
  }

  formatSessionTime(session: Session): string {
    const start = this.dateTimeFormat.parseApiDateTime(session.startTime);
    const end = session.endTime ? this.dateTimeFormat.parseApiDateTime(session.endTime) : null;
    const range = `${this.dateTimeFormat.formatTime(start)} – ${end ? this.dateTimeFormat.formatTime(end) : 'now'}`;
    if (!end) {
      return range;
    }

    // Without this a session left running overnight reads like a short one that went backwards.
    const days = spanDays({ startTime: start, endTime: end }, this.dateTimeFormat, Date.now());
    return days > 0 ? `${range} (+${days}d)` : range;
  }

  deleteSession(task: Task, sessionId: number, event: Event): void {
    event.stopPropagation();

    if (confirm('Delete this session?')) {
      this.sessionService.deleteSession(sessionId).subscribe({
        next: () => {
          task.sessions = task.sessions.filter(s => s.id !== sessionId);
          this.cdr.markForCheck();
          this.sessionBus.notifySessionsChanged();
        },
        error: () => {
          this.notification.error('Failed to delete session.');
          this.cdr.markForCheck();
        }
      });
    }
  }
}
