interface Board {
  id: number;
  name: string;
  description: string;
  color: string;
  tasksCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
