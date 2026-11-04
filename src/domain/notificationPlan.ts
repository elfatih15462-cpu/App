import { addDays, combineDateTime, toDateKey } from './dates';
import { AppSettings } from './settings';
import { PRIORITY_LABEL, reminderLabel, Task } from './types';

export interface PlannedNotification {
  at: Date;
  title: string;
  body: string;
  taskId?: string;
  kind: 'reminder' | 'morning' | 'overdue';
}

/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_SCHEDULED = 60;

/**
 * Computes every local notification that should be pending right now.
 * The app cancels and re-plans after each change, so the schedule always
 * matches the database.
 */
export function planNotifications(tasks: Task[], settings: AppSettings, now: Date = new Date(), days = 7): PlannedNotification[] {
  if (!settings.notificationsEnabled) return [];
  const out: PlannedNotification[] = [];
  const pending = tasks.filter((t) => t.status === 'pending' && !t.deletedAt);

  for (const t of pending) {
    const due = combineDateTime(t.dueDate, t.dueTime, settings.defaultTime);
    for (const minutes of t.reminders) {
      const at = new Date(due.getTime() - minutes * 60000);
      if (at.getTime() <= now.getTime()) continue;
      out.push({
        at,
        taskId: t.id,
        kind: 'reminder',
        title: minutes === 0 ? `⏰ حان موعد: ${t.title}` : `🔔 تذكير (${reminderLabel(minutes)}): ${t.title}`,
        body: [t.description, `الأولوية: ${PRIORITY_LABEL[t.priority]}`].filter(Boolean).join('\n'),
      });
    }
  }

  const today = toDateKey(now);
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    if (settings.morningSummary) {
      const at = combineDateTime(day, settings.morningTime);
      const dueToday = pending.filter((t) => t.dueDate === day).length;
      const carried = settings.carryOver ? pending.filter((t) => t.dueDate < day).length : 0;
      if (at > now && dueToday + carried > 0) {
        out.push({
          at,
          kind: 'morning',
          title: '☀️ صباح الخير! مهامك اليوم',
          body:
            `لديك ${dueToday} ${dueToday === 1 ? 'مهمة' : 'مهام'} لليوم` +
            (carried ? ` و${carried} ${carried === 1 ? 'مهمة مرحّلة' : 'مهام مرحّلة'} من أيام سابقة` : ''),
        });
      }
    }
    if (settings.overdueAlert) {
      const at = combineDateTime(day, settings.overdueTime);
      // Tasks that would still be unfinished at that time if nothing changes.
      const late = pending.filter((t) => t.dueDate < day || (t.dueDate === day && combineDateTime(t.dueDate, t.dueTime, '00:00') < at)).length;
      if (at > now && late > 0) {
        out.push({
          at,
          kind: 'overdue',
          title: '⚠️ مهام غير منجزة',
          body: `لديك ${late} ${late === 1 ? 'مهمة لم تُنجز بعد' : 'مهام لم تُنجز بعد'}. لا تنسَ إنجازها أو تأجيلها.`,
        });
      }
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}
