interface Task {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string;
  color?: string;
  /** TaskPriority enum value from the API (0 = none). */
  taskPriority?: number | null;
  estimatedMinutes?: number | null;
  sortOrder?: number;
  dueDate?: Date | string | null;
  /** User-local timestamp set while the task sits in the board's done column. */
  completedAt?: string | null;
  /** User-local timestamp; archived tasks are hidden from the board. */
  archivedAt?: string | null;
  /** Cycle the task was completed in. */
  cycleId?: number | null;
  sessions: Session[];
  // Client-side timer state
  currentSession: Session | undefined;
  isTimerRunning: boolean;
}

interface TaskPayload {
  title: string;
  description: string;
  color?: string;
  taskPriority: number | null;
  estimatedMinutes?: number | null;
  sortOrder: number;
  dueDate: string | null;
}

interface NewTaskPayload extends TaskPayload {
  boardId: number;
  columnId: number;
}
