/** Mirrors TrakDo.API.Enums.TaskPriority (serialized as a number). */
export enum TaskPriority {
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4
}

export interface PriorityOption {
  value: TaskPriority;
  label: string;
  cssClass: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: TaskPriority.None, label: 'None', cssClass: '' },
  { value: TaskPriority.Low, label: 'Low', cssClass: 'p-low' },
  { value: TaskPriority.Medium, label: 'Medium', cssClass: 'p-medium' },
  { value: TaskPriority.High, label: 'High', cssClass: 'p-high' },
  { value: TaskPriority.Critical, label: 'Critical', cssClass: 'p-critical' }
];

export function getPriorityOption(priority: TaskPriority | null | undefined): PriorityOption | null {
  if (!priority) {
    return null;
  }

  return PRIORITY_OPTIONS.find(option => option.value === priority) ?? null;
}
