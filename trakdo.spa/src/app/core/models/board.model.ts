interface Board {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder: number;
  /** User-local timestamps as returned by the API. */
  created: string;
  updated?: string | null;
  cyclesEnabled?: boolean;
  cycleLengthDays?: number;
}

interface BoardPayload {
  name: string;
  description: string;
  color: string;
  sortOrder: number;
}
