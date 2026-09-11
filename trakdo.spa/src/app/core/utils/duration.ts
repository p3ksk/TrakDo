/** 3725 -> "01:02:05" (stopwatch style). */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, minutes, secs].map(part => part.toString().padStart(2, '0')).join(':');
}

/** 3725 -> "1h 2m", 125 -> "2m", 40 -> "40s". */
export function formatHuman(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (total < 60) {
    return `${total}s`;
  }

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
