interface Column {
  id: number;
  boardId?: number;
  name: string;
  sortOrder: number;
  tasks: Task[];
}
