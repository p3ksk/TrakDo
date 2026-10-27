export type DateFormatOption = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface UserSettings {
  timezone: string;
  dateFormat: DateFormatOption;
  use24HourTime: boolean;
  workDayStartHour: number;
  workDayEndHour: number;
  /** Done tasks are archived this many days after completion. 0 = off. */
  autoArchiveDays: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  use24HourTime: true,
  workDayStartHour: 9,
  workDayEndHour: 17,
  autoArchiveDays: 0
};

export const AUTO_ARCHIVE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'After 1 day' },
  { value: 3, label: 'After 3 days' },
  { value: 7, label: 'After 1 week' },
  { value: 14, label: 'After 2 weeks' },
  { value: 30, label: 'After 30 days' }
];

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];
