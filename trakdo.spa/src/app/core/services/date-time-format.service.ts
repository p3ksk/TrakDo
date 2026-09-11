import { Injectable } from '@angular/core';
import { addDays, addMonths, startOfMonth, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class DateTimeFormatService {
  constructor(private settingsService: SettingsService) {}

  formatDate(date: Date): string {
    const pattern = this.settingsService.settings().dateFormat
      .replace('YYYY', 'yyyy')
      .replace('DD', 'dd');
    return formatInTimeZone(date, this.settingsService.settings().timezone, pattern);
  }

  formatTime(date: Date): string {
    const timePattern = this.settingsService.settings().use24HourTime ? 'HH:mm' : 'hh:mm a';
    return formatInTimeZone(date, this.settingsService.settings().timezone, timePattern);
  }

  formatDateForInput(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'yyyy-MM-dd');
  }

  formatTimeForInput(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'HH:mm');
  }

  formatDateTimeForApi(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, "yyyy-MM-dd'T'HH:mm:ss");
  }

  parseApiDateTime(value: Date | string): Date {
    if (value instanceof Date) {
      return value;
    }

    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
      return new Date(value);
    }

    const parsed = new Date(value);
    return fromZonedTime(parsed, this.settingsService.settings().timezone);
  }

  formatMonthYear(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'MMMM yyyy');
  }

  formatMonthName(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'MMMM');
  }

  formatMonthDay(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'MMM d');
  }

  formatWeekdayShort(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'EEE');
  }

  getDateKey(date: Date): string {
    return formatInTimeZone(date, this.settingsService.settings().timezone, 'yyyy-MM-dd');
  }

  getDayOfMonth(date: Date): number {
    return Number(formatInTimeZone(date, this.settingsService.settings().timezone, 'd'));
  }

  getMonth(date: Date): number {
    return Number(formatInTimeZone(date, this.settingsService.settings().timezone, 'M')) - 1;
  }

  getHour(date: Date): number {
    return Number(formatInTimeZone(date, this.settingsService.settings().timezone, 'H'));
  }

  getMinute(date: Date): number {
    return Number(formatInTimeZone(date, this.settingsService.settings().timezone, 'm'));
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return this.getDateKey(date1) === this.getDateKey(date2);
  }

  isToday(date: Date): boolean {
    return this.isSameDay(date, new Date());
  }

  getStartOfWeek(date: Date): Date {
    const timezone = this.settingsService.settings().timezone;
    const zonedDate = toZonedTime(date, timezone);
    const zonedStartOfWeek = startOfWeek(zonedDate, { weekStartsOn: 1 });
    return fromZonedTime(zonedStartOfWeek, timezone);
  }

  getStartOfMonth(date: Date): Date {
    const timezone = this.settingsService.settings().timezone;
    const zonedDate = toZonedTime(date, timezone);
    const zonedStartOfMonth = startOfMonth(zonedDate);
    return fromZonedTime(zonedStartOfMonth, timezone);
  }

  addDays(date: Date, days: number): Date {
    const timezone = this.settingsService.settings().timezone;
    const zonedDate = toZonedTime(date, timezone);
    const zonedResult = addDays(zonedDate, days);
    return fromZonedTime(zonedResult, timezone);
  }

  addWeeks(date: Date, weeks: number): Date {
    return this.addDays(date, weeks * 7);
  }

  addMonths(date: Date, months: number): Date {
    const timezone = this.settingsService.settings().timezone;
    const zonedDate = toZonedTime(date, timezone);
    const zonedResult = addMonths(zonedDate, months);
    return fromZonedTime(zonedResult, timezone);
  }

  startOfDay(date: Date): Date {
    const timezone = this.settingsService.settings().timezone;
    const zonedDate = toZonedTime(date, timezone);
    zonedDate.setHours(0, 0, 0, 0);
    return fromZonedTime(zonedDate, timezone);
  }

  endOfDay(date: Date): Date {
    const timezone = this.settingsService.settings().timezone;
    const zonedDate = toZonedTime(date, timezone);
    zonedDate.setHours(23, 59, 59, 999);
    return fromZonedTime(zonedDate, timezone);
  }
}
