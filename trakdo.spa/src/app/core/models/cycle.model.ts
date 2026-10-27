export interface Cycle {
  id: number;
  boardId: number;
  number: number;
  goal?: string | null;
  /** User-local timestamps as returned by the API. */
  startDate: string;
  endDate: string;
  closedAt?: string | null;
  isActive: boolean;
  completedCount: number;
  carriedOverCount: number;
  /** Seconds tracked on the board between the cycle's start and end. */
  trackedSeconds: number;
}

export const CYCLE_LENGTH_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
  { value: 21, label: '3 weeks' },
  { value: 28, label: '4 weeks' }
];
