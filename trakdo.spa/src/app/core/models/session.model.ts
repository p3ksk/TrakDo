interface  Session {
  id: number;
  taskId?: number;
  taskTitle?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  notes?: string;
  color?: string;
}
