import { Injectable, signal } from '@angular/core';
import { DateTimeFormatService } from './date-time-format.service';

export type CalendarViewMode = 'week' | 'month';

@Injectable({
  providedIn: 'root'
})
export class CalendarRangeStateService {
  private readonly viewModeStorageKey = 'calendar_view_mode';
  private readonly currentDateStorageKey = 'calendar_current_date';

  private readonly viewModeSignal = signal<CalendarViewMode>(this.readStoredViewMode());
  private readonly currentDateSignal = signal<Date>(this.readStoredCurrentDate());

  public readonly viewMode = this.viewModeSignal.asReadonly();
  public readonly currentDate = this.currentDateSignal.asReadonly();

  constructor(private dateTimeFormat: DateTimeFormatService) {}

  switchView(mode: CalendarViewMode): void {
    this.viewModeSignal.set(mode);
    localStorage.setItem(this.viewModeStorageKey, mode);
  }

  previousPeriod(): void {
    const currentDate = this.currentDate();
    const nextDate = this.viewMode() === 'week'
      ? this.dateTimeFormat.addWeeks(currentDate, -1)
      : this.dateTimeFormat.addMonths(currentDate, -1);
    this.setCurrentDate(nextDate);
  }

  nextPeriod(): void {
    const currentDate = this.currentDate();
    const nextDate = this.viewMode() === 'week'
      ? this.dateTimeFormat.addWeeks(currentDate, 1)
      : this.dateTimeFormat.addMonths(currentDate, 1);
    this.setCurrentDate(nextDate);
  }

  goToToday(): void {
    this.setCurrentDate(new Date());
  }

  showWeekOf(date: Date): void {
    this.setCurrentDate(date);
    this.switchView('week');
  }

  getWeekDays(): Date[] {
    const startOfWeek = this.dateTimeFormat.getStartOfWeek(this.currentDate());
    return Array.from({ length: 7 }, (_, i) => this.dateTimeFormat.addDays(startOfWeek, i));
  }

  getMonthGridDays(): Date[] {
    const startDate = this.dateTimeFormat.getStartOfWeek(this.dateTimeFormat.getStartOfMonth(this.currentDate()));
    return Array.from({ length: 42 }, (_, i) => this.dateTimeFormat.addDays(startDate, i));
  }

  /** Range covered by the calendar grid (month view includes the leading/trailing days of adjacent months). */
  getVisibleRange(): { start: Date; end: Date } {
    if (this.viewMode() === 'week') {
      return this.getPeriodRange();
    }

    const monthDays = this.getMonthGridDays();
    return {
      start: this.dateTimeFormat.startOfDay(monthDays[0]),
      end: this.dateTimeFormat.endOfDay(monthDays[monthDays.length - 1])
    };
  }

  /** The selected week or calendar month exactly, used for lists and statistics. */
  getPeriodRange(): { start: Date; end: Date } {
    if (this.viewMode() === 'week') {
      const weekDays = this.getWeekDays();
      return {
        start: this.dateTimeFormat.startOfDay(weekDays[0]),
        end: this.dateTimeFormat.endOfDay(weekDays[6])
      };
    }

    const monthStart = this.dateTimeFormat.getStartOfMonth(this.currentDate());
    const nextMonthStart = this.dateTimeFormat.addMonths(monthStart, 1);
    return {
      start: monthStart,
      end: new Date(nextMonthStart.getTime() - 1)
    };
  }

  isCurrentPeriod(): boolean {
    const { start, end } = this.getPeriodRange();
    const now = Date.now();
    return now >= start.getTime() && now <= end.getTime();
  }

  getCurrentPeriodLabel(): string {
    if (this.viewMode() === 'week') {
      const weekDays = this.getWeekDays();
      const first = weekDays[0];
      const last = weekDays[6];
      const sameYear = this.dateTimeFormat.format(first, 'yyyy') === this.dateTimeFormat.format(last, 'yyyy');
      const sameMonth = sameYear && this.dateTimeFormat.getMonth(first) === this.dateTimeFormat.getMonth(last);
      if (sameMonth) {
        return `${this.dateTimeFormat.format(first, 'MMM d')} – ${this.dateTimeFormat.format(last, 'd, yyyy')}`;
      }
      if (sameYear) {
        return `${this.dateTimeFormat.format(first, 'MMM d')} – ${this.dateTimeFormat.format(last, 'MMM d, yyyy')}`;
      }
      return `${this.dateTimeFormat.format(first, 'MMM d, yyyy')} – ${this.dateTimeFormat.format(last, 'MMM d, yyyy')}`;
    }

    return this.dateTimeFormat.formatMonthYear(this.currentDate());
  }

  private setCurrentDate(date: Date): void {
    this.currentDateSignal.set(date);
    sessionStorage.setItem(this.currentDateStorageKey, date.toISOString());
  }

  private readStoredViewMode(): CalendarViewMode {
    const storedViewMode = localStorage.getItem(this.viewModeStorageKey);
    return storedViewMode === 'month' ? 'month' : 'week';
  }

  private readStoredCurrentDate(): Date {
    // Session-scoped: a new visit should open on the current period, not wherever you left off last week.
    const storedCurrentDate = sessionStorage.getItem(this.currentDateStorageKey);
    if (!storedCurrentDate) {
      return new Date();
    }

    const parsedDate = new Date(storedCurrentDate);
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }
}
