export interface DailyCount {
  /** Calendar day as yyyy-MM-dd (in the admin's timezone). */
  date: string;
  count: number;
}

export interface AdminStats {
  users: number;
  admins: number;
  boards: number;
  tasks: number;
  sessions: number;
  trackedSeconds: number;
  runningTimers: number;
  loggedInLast7Days: number;
  loggedInLast30Days: number;
  trackingLast7Days: number;
  trackingLast30Days: number;
  registrationsPerDay: DailyCount[];
}

export interface AdminUser {
  id: number;
  username: string;
  isAdmin: boolean;
  created: string;
  lastLogin?: string | null;
}

export interface AdminSettings {
  registrationEnabled: boolean;
}
