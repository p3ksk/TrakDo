interface Task {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string;
  color?: string;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: Date;
  tags: string[];
  sessions: Session[];
  currentSession: Session | undefined;
  isTimerRunning: boolean;
}
