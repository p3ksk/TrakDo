interface Column {
  id: number;
  boardId?: number;
  name: string;
  sortOrder: number;
  /** Tasks in this column count as completed. At most one per board. */
  isDoneColumn?: boolean;
  tasks: Task[];
}
