export type ThemePref = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePref;
  /** Show unfinished tasks from previous days in today's list (ترحيل المهام). */
  carryOver: boolean;
  notificationsEnabled: boolean;
  /** Time used for reminders of tasks that have no time of their own. */
  defaultTime: string;
  /** Reminders preselected for new tasks (minutes before). */
  defaultReminders: number[];
  morningSummary: boolean;
  morningTime: string;
  overdueAlert: boolean;
  overdueTime: string;
  autoBackup: boolean;
  lastAutoBackup: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  carryOver: true,
  notificationsEnabled: true,
  defaultTime: '09:00',
  defaultReminders: [0],
  morningSummary: true,
  morningTime: '08:00',
  overdueAlert: true,
  overdueTime: '20:00',
  autoBackup: true,
  lastAutoBackup: '',
};

export function parseSettings(raw: Record<string, string>): AppSettings {
  const s: AppSettings = { ...DEFAULT_SETTINGS };
  const bool = (k: keyof AppSettings) => {
    if (raw[k] !== undefined) (s as unknown as Record<string, unknown>)[k] = raw[k] === '1';
  };
  const str = (k: keyof AppSettings) => {
    if (raw[k] !== undefined) (s as unknown as Record<string, unknown>)[k] = raw[k];
  };
  bool('carryOver');
  bool('notificationsEnabled');
  bool('morningSummary');
  bool('overdueAlert');
  bool('autoBackup');
  str('defaultTime');
  str('morningTime');
  str('overdueTime');
  str('lastAutoBackup');
  if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system') s.theme = raw.theme;
  if (raw.defaultReminders) {
    try {
      const v = JSON.parse(raw.defaultReminders);
      if (Array.isArray(v)) s.defaultReminders = v.filter((n) => typeof n === 'number');
    } catch {
      // keep default
    }
  }
  return s;
}

export function serializeSetting(value: AppSettings[keyof AppSettings]): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}
