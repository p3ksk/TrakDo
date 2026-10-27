import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { BoardService } from '../../core/services/board.service';
import { TaskService } from '../../core/services/task.service';
import { CycleService } from '../../core/services/cycle.service';
import { SessionBusService } from '../../core/services/session-bus.service';
import { BoardSelectionService } from '../../core/services/board-selection.service';
import { DateTimeFormatService } from '../../core/services/date-time-format.service';
import { NotificationService } from '../../core/services/notification.service';
import { Cycle, CYCLE_LENGTH_OPTIONS } from '../../core/models/cycle.model';
import { formatHuman, pluralize } from '../../core/utils/duration';
import { Icon } from '../../shared/icon/icon';
import { Modal } from '../../shared/modal/modal';
import { PageHeader } from '../../shared/page-header/page-header';

interface HistoryGroup {
  key: string;
  title: string;
  subtitle: string;
  /** Set for cycle groups; week groups of tasks archived outside a cycle have none. */
  cycle: Cycle | null;
  tasks: Task[];
  trackedSeconds: number;
}

interface CycleSettingsForm {
  enabled: boolean;
  lengthDays: number;
}

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [FormsModule, Icon, Modal, PageHeader],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class History implements OnInit {
  private boardService = inject(BoardService);
  private taskService = inject(TaskService);
  private cycleService = inject(CycleService);
  private sessionBus = inject(SessionBusService);
  private boardSelectionService = inject(BoardSelectionService);
  private dateTimeFormat = inject(DateTimeFormatService);
  private notification = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly formatHuman = formatHuman;
  readonly pluralize = pluralize;
  readonly cycleLengthOptions = CYCLE_LENGTH_OPTIONS;

  board = signal<Board | null>(null);
  isLoading = signal(true);
  isSaving = signal(false);
  search = signal('');
  cycleSettings = signal<CycleSettingsForm | null>(null);
  editingGoal = signal<{ cycle: Cycle; goal: string } | null>(null);

  private archivedTasks = signal<Task[]>([]);
  private cycles = signal<Cycle[]>([]);
  private expandedKeys = signal<Set<string>>(new Set());

  activeCycle = computed(() => this.cycles().find(cycle => cycle.isActive) ?? null);

  groups = computed<HistoryGroup[]>(() => {
    const query = this.search().trim().toLowerCase();
    const tasks = query
      ? this.archivedTasks().filter(task => task.title.toLowerCase().includes(query))
      : this.archivedTasks();

    const cycleGroups: HistoryGroup[] = this.cycles().map(cycle => ({
      key: `cycle-${cycle.id}`,
      title: `Cycle ${cycle.number}`,
      subtitle: this.formatRange(cycle),
      cycle,
      tasks: tasks.filter(task => task.cycleId === cycle.id),
      trackedSeconds: cycle.trackedSeconds
    }));

    const weekGroups = new Map<string, HistoryGroup>();
    for (const task of tasks.filter(task => !task.cycleId)) {
      const weekStart = this.getWeekStart(task.completedAt ?? task.archivedAt!);
      const key = `week-${weekStart}`;
      const group = weekGroups.get(key) ?? {
        key,
        title: `Week of ${this.dateTimeFormat.formatDate(this.dateTimeFormat.parseApiDateTime(`${weekStart}T00:00:00`))}`,
        subtitle: '',
        cycle: null,
        tasks: [],
        trackedSeconds: 0
      };
      group.tasks.push(task);
      group.trackedSeconds += this.getTrackedSeconds(task);
      weekGroups.set(key, group);
    }

    // Cycles are already newest first; weeks follow, newest first.
    const visibleCycleGroups = query ? cycleGroups.filter(group => group.tasks.length > 0) : cycleGroups;
    const sortedWeeks = Array.from(weekGroups.values()).sort((a, b) => b.key.localeCompare(a.key));
    return [...visibleCycleGroups, ...sortedWeeks];
  });

  totals = computed(() => ({
    archived: this.archivedTasks().length,
    cycles: this.cycles().filter(cycle => !cycle.isActive).length
  }));

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(paramMap => {
      const boardId = Number(paramMap.get('boardId'));
      if (!boardId || Number.isNaN(boardId)) {
        this.router.navigate(['/boards']);
        return;
      }

      this.boardSelectionService.setSelectedBoard(boardId);
      this.board.set(null);
      this.archivedTasks.set([]);
      this.cycles.set([]);
      this.expandedKeys.set(new Set());
      this.load(boardId);
    });
  }

  load(boardId: number): void {
    this.isLoading.set(true);
    forkJoin({
      board: this.boardService.getBoard(boardId),
      tasks: this.taskService.getArchivedTasks(boardId),
      cycles: this.cycleService.getCycles(boardId)
    }).subscribe({
      next: ({ board, tasks, cycles }) => {
        this.board.set(board);
        this.archivedTasks.set(tasks);
        this.cycles.set(cycles);
        if (this.expandedKeys().size === 0) {
          const firstKey = this.groups()[0]?.key;
          this.expandedKeys.set(new Set(firstKey ? [firstKey] : []));
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.error('Failed to load history.');
        this.router.navigate(['/boards']);
      }
    });
  }

  isExpanded(group: HistoryGroup): boolean {
    return this.search().trim() !== '' || this.expandedKeys().has(group.key);
  }

  toggleGroup(group: HistoryGroup): void {
    this.expandedKeys.update(keys => {
      const next = new Set(keys);
      if (!next.delete(group.key)) {
        next.add(group.key);
      }
      return next;
    });
  }

  restoreTask(task: Task): void {
    this.taskService.restoreTask(task.id).subscribe({
      next: () => {
        this.archivedTasks.update(tasks => tasks.filter(existing => existing.id !== task.id));
        this.notification.success(`"${task.title}" is back on the board.`);
      },
      error: () => this.notification.error('Failed to restore task.')
    });
  }

  deleteTask(task: Task): void {
    const sessionsCount = task.sessions.length;
    const message = sessionsCount > 0
      ? `Delete "${task.title}" and its ${pluralize(sessionsCount, 'tracked session')}? This can't be undone.`
      : `Delete "${task.title}"? This can't be undone.`;
    if (!confirm(message)) return;

    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.archivedTasks.update(tasks => tasks.filter(existing => existing.id !== task.id));
        this.sessionBus.notifySessionsChanged();
      },
      error: () => this.notification.error('Failed to delete task.')
    });
  }

  // Cycle settings
  openCycleSettings(): void {
    const board = this.board();
    if (!board) return;
    this.cycleSettings.set({ enabled: !!board.cyclesEnabled, lengthDays: board.cycleLengthDays ?? 14 });
  }

  updateCycleSettings(patch: Partial<CycleSettingsForm>): void {
    this.cycleSettings.update(form => form ? { ...form, ...patch } : form);
  }

  saveCycleSettings(): void {
    const form = this.cycleSettings();
    const board = this.board();
    if (!form || !board || this.isSaving()) return;

    this.isSaving.set(true);
    this.cycleService.updateSettings(board.id, form).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.cycleSettings.set(null);
        this.notification.success(form.enabled ? 'Cycles are on for this board.' : 'Cycles are off for this board.');
        this.load(board.id);
      },
      error: () => {
        this.isSaving.set(false);
        this.notification.error('Failed to save cycle settings.');
      }
    });
  }

  openGoal(cycle: Cycle, event: Event): void {
    event.stopPropagation();
    this.editingGoal.set({ cycle, goal: cycle.goal ?? '' });
  }

  updateGoalText(goal: string): void {
    this.editingGoal.update(state => state ? { ...state, goal } : state);
  }

  saveGoal(): void {
    const state = this.editingGoal();
    if (!state || this.isSaving()) return;

    const goal = state.goal.trim();
    this.isSaving.set(true);
    this.cycleService.updateGoal(state.cycle.id, goal).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.cycles.update(cycles => cycles.map(cycle => cycle.id === state.cycle.id ? { ...cycle, goal: goal || null } : cycle));
        this.editingGoal.set(null);
      },
      error: () => {
        this.isSaving.set(false);
        this.notification.error('Failed to save goal.');
      }
    });
  }

  // Formatting
  getTrackedSeconds(task: Task): number {
    return task.sessions.reduce((sum, session) => {
      const duration = Number(session.duration);
      return sum + (Number.isFinite(duration) ? duration : 0);
    }, 0);
  }

  formatCompleted(task: Task): string {
    const when = task.completedAt ?? task.archivedAt;
    return when ? this.dateTimeFormat.formatDate(this.dateTimeFormat.parseApiDateTime(when)) : '';
  }

  getDaysLeft(cycle: Cycle): number {
    const end = this.dateTimeFormat.parseApiDateTime(cycle.endDate).getTime();
    return Math.max(0, Math.ceil((end - Date.now()) / DAY_MS));
  }

  private formatRange(cycle: Cycle): string {
    const start = this.dateTimeFormat.parseApiDateTime(cycle.startDate);
    // End dates are exclusive midnights; show the last day the cycle covered.
    const endExclusive = this.dateTimeFormat.parseApiDateTime(cycle.endDate);
    const end = cycle.isActive ? new Date(endExclusive.getTime() - 1) : endExclusive;
    return `${this.dateTimeFormat.formatDate(start)} – ${this.dateTimeFormat.formatDate(end)}`;
  }

  /** Monday of the week containing a user-local API timestamp, as YYYY-MM-DD (sortable). */
  private getWeekStart(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0, 10);
  }
}
