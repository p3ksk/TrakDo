interface Session {
  id: number;
  taskId?: number;
  taskTitle?: string;
  boardId?: number;
  startTime: Date | string;
  endTime?: Date | string;
  duration: number; // in seconds; missing while the session is running
  notes?: string;
  color?: string;
}
