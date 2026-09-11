import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {BoardService} from '../../../core/services/board.service';
import {TaskService} from '../../../core/services/task.service';
import {SessionsService} from '../../../core/services/sessions.service';
import {NotificationService} from '../../../core/services/notification.service';
import { SessionBusService } from '../../../core/services/session-bus.service';
import {DateTimeFormatService} from '../../../core/services/date-time-format.service';
import {BoardSelectionService} from '../../../core/services/board-selection.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './board-detail.html',
  styleUrl: './board-detail.css'
})
export class BoardDetail implements OnInit, OnDestroy {
  private routeSubscription?: Subscription;

  board: Board | null = null;
  columns: Column[] = [];
  boards: Board[] = [];

  showAddColumnModal = false;
  showAddTaskModal = false;
  showTaskDetailModal = false;
  showCreateBoardModal = false;

  selectedColumn: Column | null = null;
  selectedTask: Task | null = null;

  draggedTask: Task | null = null;
  draggedFromColumn: Column | null = null;

  timerIntervals: Map<number, any> = new Map();
  currentElapsedTimes: Map<number, number> = new Map();

  newColumn: Column = {
    id: 0,
    tasks: [],
    updated: undefined,
    name: '',
    color: '#09C1BF'
  };

  newTask: Task = {
    currentSession: undefined,
    columnId: 0,
    boardId: 0,
    id: 0,
    isTimerRunning: false,
    sessions: [],
    title: '',
    description: '',
    color: '#09C1BF',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assignee: '',
    dueDate: undefined,
    tags: ['']
  };

  newBoard = {
    name: '',
    description: '',
    color: '#09C1BF'
  };

  colorOptions = [
    { value: '#09C1BF', label: 'Teal' },
    { value: '#FD7F44', label: 'Orange' },
    { value: '#FCCE5F', label: 'Yellow' },
    { value: '#10b981', label: 'Green' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' }
  ];

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

  loadColumns(boardId: number): void {
    this.boardService.getColumnsWithTasks(boardId).subscribe({
      next: columns => {
        this.clearTimerTracking();
        this.columns = columns;
        this.startUnfinishedSessions();
        this.selectedTask = null;
        this.showTaskDetailModal = false;
        this.cdr.markForCheck();
      },
      error: err => console.error(err)
    });
  }

  private clearTimerTracking(): void {
    this.timerIntervals.forEach(interval => clearInterval(interval));
    this.timerIntervals.clear();
    this.currentElapsedTimes.clear();
  }

  // Column Management
  openCreateBoardModal(): void {
    this.showCreateBoardModal = true;
  }

  closeCreateBoardModal(): void {
    this.showCreateBoardModal = false;
    this.newBoard = {
      name: '',
      description: '',
      color: '#09C1BF'
    };
  }

  createBoard(): void {
    if (!this.newBoard.name.trim()) return;

    const board: Board = {
      id: 0,
      sortOrder: this.boards.length,
      tasksCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: this.newBoard.name.trim(),
      description: this.newBoard.description,
      color: this.newBoard.color
    };

    this.boardService.createBoard(board).subscribe({
      next: createdBoardId => {
        this.closeCreateBoardModal();
        this.boardSelectionService.setSelectedBoard(createdBoardId);
        this.router.navigate(['/board', createdBoardId, 'tasks']);
      },
      error: err => {
        console.error('Failed to create board', err);
        this.notification.error('Failed to create board.');
      }
    });
  }

  openAddColumnModal(): void {
    this.showAddColumnModal = true;
  }

  closeAddColumnModal(): void {
    this.showAddColumnModal = false;
    this.resetColumnForm();
  }

  addColumn(): void {
    if (!this.newColumn.name.trim()) return;

    const column: Column = {
      updated: undefined,
      id: 0,
      name: this.newColumn.name,
      color: this.newColumn.color,
      tasks: []
    };

    this.boardService.createColumn(column, this.board!.id).subscribe(createdColumn => {
      this.columns.push(column);
      this.closeAddColumnModal();
    });
  }

  deleteColumn(columnId: number): void {
    if (confirm('Are you sure? All tasks in this column will be deleted.')) {
      this.boardService.deleteColumn(columnId, this.board!.id).subscribe(deletedColumn => {
        this.loadColumns(this.board!.id)
      })
    }
  }

  resetColumnForm(): void {
    this.newColumn = {
      id: 0,
      tasks: [],
      updated: undefined,
      name: '',
      color: '#09C1BF'
    };
  }

  // Task Management
  openAddTaskModal(column: Column): void {
    this.selectedColumn = column;
    this.showAddTaskModal = true;
  }

  closeAddTaskModal(): void {
    this.showAddTaskModal = false;
    this.selectedColumn = null;
    this.resetTaskForm();
  }

  addTask(): void {
    if (!this.newTask.title.trim() || !this.selectedColumn) return;

    const task: Task = {
      currentSession: undefined,
      boardId: this.board!.id,
      columnId: this.selectedColumn.id,
      isTimerRunning: false, sessions: [],
      id: 0,
      title: this.newTask.title,
      description: this.newTask.description,
      color: this.newTask.color,
      priority: this.newTask.priority,
      assignee: this.newTask.assignee || undefined,
      dueDate: this.newTask.dueDate,
      tags: this.newTask.tags ? this.newTask.tags : []
    };

    this.taskService.createTask(task).subscribe({
      next: createdTaskId => {
        this.loadColumns(this.board!.id);
        this.closeAddTaskModal();
      }
    });
  }

  openTaskDetail(task: Task): void {
    this.selectedTask = task;
    this.showTaskDetailModal = true;
  }

  closeTaskDetail(): void {
    this.showTaskDetailModal = false;
    this.selectedTask = null;
  }

  deleteTask(column: Column, taskId: number): void {
    if (confirm('Delete this task?')) {
      this.taskService.deleteTask(taskId).subscribe(deletedTask => {
        this.loadColumns(this.board!.id)
        this.closeTaskDetail();
      })
    }
  }

  resetTaskForm(): void {
    this.newTask = {
      currentSession: undefined,
      columnId: 0,
      id: 0,
      boardId: this.board ? this.board.id : 0,
      isTimerRunning: false,
      sessions: [],
      title: '',
      description: '',
      color: '#09C1BF',
      priority: 'medium',
      assignee: '',
      dueDate: undefined,
      tags: ['']
    };
  }

  // Drag and Drop
  onDragStart(event: DragEvent, task: Task, column: Column): void {
    this.draggedTask = task;
    this.draggedFromColumn = column;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, targetColumn: Column): void {
    event.preventDefault();

    if (this.draggedTask && this.draggedFromColumn) {
      this.taskService.moveTask(this.draggedTask.id, targetColumn.id).subscribe({
        next: _ => {
          this.loadColumns(this.board!.id);
        }
      });
      // Reset
      this.draggedTask = null;
      this.draggedFromColumn = null;
    }
  }

  onDragEnd(): void {
    this.draggedTask = null;
    this.draggedFromColumn = null;
  }

  // Utility Methods
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#FD7F44';
      case 'medium': return '#FCCE5F';
      case 'low': return '#09C1BF';
      default: return '#09C1BF';
    }
  }

  formatDate(date: Date | string): string {
    return this.dateTimeFormat.formatDate(this.dateTimeFormat.parseApiDateTime(date));
  }

  getTotalTasks(): number {
    return this.columns.reduce((sum, col) => sum + col.tasks.length, 0);
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
        this.sessionBus.notifySessionsChanged();
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
    const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return `${this.padTo2Digits(hours)}:${this.padTo2Digits(minutes)}:${this.padTo2Digits(secs)}`
  }

  private padTo2Digits(num: number): string {
    return num.toString().padStart(2, '0');
  }

  formatSessionTime(session: Session): string {
    const start = this.dateTimeFormat.parseApiDateTime(session.startTime);
    const end = session.endTime ? this.dateTimeFormat.parseApiDateTime(session.endTime) : new Date();

    return `${this.dateTimeFormat.formatTime(start)} - ${this.dateTimeFormat.formatTime(end)}`;
  }

  deleteSession(task: Task, sessionId: number, event: Event): void {
    event.stopPropagation();

    if (confirm('Delete this session?')) {
      this.sessionService.deleteSession(sessionId).subscribe({
        next: () => {
          task.sessions = task.sessions.filter(s => s.id !== sessionId);
          this.sessionBus.notifySessionsChanged();
        },
        error: () => this.notification.error('Failed to delete session.')
      });
    }
  }
}
