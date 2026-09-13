/**
 * Helpers for sessions that cross midnight. A session is a single instant range, but every
 * calendar surface (day columns, month cells, trend bars, period totals) needs it broken up
 * per calendar day in the user's timezone, or clipped to the period being looked at.
 */

/** The slice of `DateTimeFormatService` these helpers need; the service satisfies it structurally. */
export interface DayBoundaries {
  startOfDay(date: Date): Date;
  addDays(date: Date, days: number): Date;
  getDateKey(date: Date): string;
}

export interface SessionSpan {
  startTime: Date;
  endTime?: Date;
}

/** An inclusive instant range, the way the range state service hands them out. */
export interface InstantRange {
  start: Date;
  end: Date;
}

export interface DaySlice<T extends SessionSpan> {
  session: T;
  /** Date key of the calendar day this slice belongs to. */
  key: string;
  start: Date;
  end: Date;
  seconds: number;
  continuesFromPreviousDay: boolean;
  continuesOnNextDay: boolean;
}

/** Guards against pathological data (a timer left running for years) locking up a view. */
const MAX_SLICE_DAYS = 400;

/** End of a running session, or of one whose end time is somehow before its start. */
function effectiveEnd(session: SessionSpan, now: number): number {
  return Math.max(session.startTime.getTime(), session.endTime?.getTime() ?? now);
}

/** `limit.end` is inclusive (an end-of-day or end-of-period instant), so shift it to a half-open bound. */
function exclusiveBounds(limit?: InstantRange): { from: number; to: number } {
  return limit
    ? { from: limit.start.getTime(), to: limit.end.getTime() + 1 }
    : { from: -Infinity, to: Infinity };
}

/** Seconds of `session` that fall inside `range`. Zero when it does not overlap at all. */
export function overlapSeconds(session: SessionSpan, range: InstantRange, now: number): number {
  const { from, to } = exclusiveBounds(range);
  const clippedStart = Math.max(session.startTime.getTime(), from);
  const clippedEnd = Math.min(effectiveEnd(session, now), to);
  return Math.max(0, (clippedEnd - clippedStart) / 1000);
}

/** Full length of the session in seconds, regardless of any period being displayed. */
export function totalSeconds(session: SessionSpan, now: number): number {
  return Math.max(0, (effectiveEnd(session, now) - session.startTime.getTime()) / 1000);
}

/**
 * Calendar days between the session's start and its end — 0 when it starts and ends on the
 * same day, 1 when it ends the next day, and so on.
 */
export function spanDays(session: SessionSpan, dates: DayBoundaries, now: number): number {
  return dayDistance(dates.getDateKey(session.startTime), dates.getDateKey(new Date(effectiveEnd(session, now))));
}

/** Whole days between two date keys ("yyyy-MM-dd"), immune to DST because it never adds hours. */
function dayDistance(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toKey.split('-').map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/**
 * Splits a session into one slice per calendar day it touches, optionally clipped to `limit`
 * (whose `end` is inclusive). A session that does not overlap the limit yields no slices;
 * one that sits inside a single day yields exactly one.
 */
export function sliceSessionByDay<T extends SessionSpan>(
  session: T,
  dates: DayBoundaries,
  now: number,
  limit?: InstantRange
): DaySlice<T>[] {
  const sessionStart = session.startTime.getTime();
  const sessionEnd = effectiveEnd(session, now);
  const { from: limitStart, to: limitEnd } = exclusiveBounds(limit);

  if (sessionStart >= limitEnd || sessionEnd < limitStart) {
    return [];
  }

  const from = Math.max(sessionStart, limitStart);
  const to = Math.max(from, Math.min(sessionEnd, limitEnd));

  const slices: DaySlice<T>[] = [];
  let cursor = dates.startOfDay(new Date(from));

  for (let guard = 0; guard < MAX_SLICE_DAYS; guard++) {
    const dayStart = cursor.getTime();
    const nextDayStart = dates.startOfDay(dates.addDays(cursor, 1)).getTime();
    const sliceStart = Math.max(from, dayStart);
    const sliceEnd = Math.min(to, nextDayStart);

    slices.push({
      session,
      key: dates.getDateKey(cursor),
      start: new Date(sliceStart),
      end: new Date(sliceEnd),
      seconds: Math.max(0, (sliceEnd - sliceStart) / 1000),
      continuesFromPreviousDay: sessionStart < dayStart,
      continuesOnNextDay: sessionEnd > nextDayStart
    });

    if (nextDayStart >= to) {
      break;
    }
    cursor = new Date(nextDayStart);
  }

  return slices;
}
