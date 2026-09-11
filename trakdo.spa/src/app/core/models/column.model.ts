interface Column {
  id: number;
  name: string;
  tasks: Task[];
  color: string;
  updated: Date | undefined;
}
