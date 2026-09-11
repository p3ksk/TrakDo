export type DateFormatOption = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface UserSettings {
  timezone: string;
  dateFormat: DateFormatOption;
  use24HourTime: boolean;
  workDayStartHour: number;
  workDayEndHour: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  use24HourTime: true,
  workDayStartHour: 9,
  workDayEndHour: 17
};

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];
