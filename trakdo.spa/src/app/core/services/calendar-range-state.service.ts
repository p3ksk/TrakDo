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

  getWeekDays(): Date[] {
    const startOfWeek = this.dateTimeFormat.getStartOfWeek(this.currentDate());
    return Array.from({ length: 7 }, (_, i) => this.dateTimeFormat.addDays(startOfWeek, i));
  }

  getMonthGridDays(): Date[] {
    const startDate = this.dateTimeFormat.getStartOfWeek(this.dateTimeFormat.getStartOfMonth(this.currentDate()));
    return Array.from({ length: 42 }, (_, i) => this.dateTimeFormat.addDays(startDate, i));
  }

  getVisibleRange(): { start: Date; end: Date } {
    if (this.viewMode() === 'week') {
      const weekDays = this.getWeekDays();
      return {
        start: this.dateTimeFormat.startOfDay(weekDays[0]),
        end: this.dateTimeFormat.endOfDay(weekDays[6])
      };
    }

    const monthDays = this.getMonthGridDays();
    return {
      start: this.dateTimeFormat.startOfDay(monthDays[0]),
      end: this.dateTimeFormat.endOfDay(monthDays[monthDays.length - 1])
    };
  }

  getCurrentPeriodLabel(): string {
    if (this.viewMode() === 'week') {
      const weekDays = this.getWeekDays();
      return `${this.dateTimeFormat.formatDate(weekDays[0])} - ${this.dateTimeFormat.formatDate(weekDays[6])}`;
    }

    return this.dateTimeFormat.formatMonthYear(this.currentDate());
  }

  private setCurrentDate(date: Date): void {
    this.currentDateSignal.set(date);
    localStorage.setItem(this.currentDateStorageKey, date.toISOString());
  }

  private readStoredViewMode(): CalendarViewMode {
    const storedViewMode = localStorage.getItem(this.viewModeStorageKey);
    return storedViewMode === 'week' ? 'week' : 'month';
  }

  private readStoredCurrentDate(): Date {
    const storedCurrentDate = localStorage.getItem(this.currentDateStorageKey);
    if (!storedCurrentDate) {
      return new Date();
    }

    const parsedDate = new Date(storedCurrentDate);
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }
}
