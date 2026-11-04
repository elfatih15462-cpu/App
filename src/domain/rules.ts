/**
 * Business rules for My Tasks. Pure functions only, so they are unit-tested
 * and shared by every screen.
 */
import {
  addDays,
  addMonths,
  combineDateTime,
  DateKey,
  diffDays,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from './dates';
import { PRIORITY_ORDER, Recurrence, Task } from './types';

/** Rule 4: a pending task whose date (or time, if set) has passed is overdue. */
export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status !== 'pending' || task.deletedAt) return false;
  const today = toDateKey(now);
  if (task.dueDate < today) return true;
  if (task.dueDate === today && task.dueTime) {
    return combineDateTime(task.dueDate, task.dueTime).getTime() < now.getTime();
  }
  return false;
}

/** Days a task has been carried over from its due date (0 if not overdue by date). */
export function carriedDays(task: Task, today: DateKey): number {
  return Math.max(0, diffDays(today, task.dueDate));
}

export function compareTasks(a: Task, b: Task): number {
  // Earlier date first, then tasks with a time (by time), then priority, then creation.
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueTime && b.dueTime && a.dueTime !== b.dueTime) return a.dueTime < b.dueTime ? -1 : 1;
  if (a.dueTime && !b.dueTime) return -1;
  if (!a.dueTime && b.dueTime) return 1;
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0) return p;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}

export interface TodayView {
  /** Pending tasks from earlier days (carried over), keeping their original date. */
  carried: Task[];
  /** Pending tasks due today. */
  pending: Task[];
  /** Tasks counted in today's plan that are already done. */
  done: Task[];
  total: number;
  doneCount: number;
  remaining: number;
  /** 0..100 */
  percent: number;
}

/**
 * Rule 1 + carry-over feature: today's list = tasks due today plus (when
 * carry-over is enabled) every unfinished task from previous days.
 */
export function buildTodayView(tasks: Task[], today: DateKey, carryOver = true): TodayView {
  const live = tasks.filter((t) => !t.deletedAt);
  const carried = carryOver
    ? sortTasks(live.filter((t) => t.status === 'pending' && t.dueDate < today))
    : [];
  const pending = sortTasks(live.filter((t) => t.status === 'pending' && t.dueDate === today));
  const done = live.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false;
    if (t.dueDate === today) return true;
    // An earlier task that was carried over and finished today counts toward today.
    return carryOver && t.dueDate < today && toDateKey(new Date(t.completedAt)) === today;
  });
  const total = carried.length + pending.length + done.length;
  const doneCount = done.length;
  return {
    carried,
    pending,
    done,
    total,
    doneCount,
    remaining: total - doneCount,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
  };
}

/** Next date for a recurring task once the current occurrence is completed. */
export function nextOccurrence(
  dueDate: DateKey,
  recurrence: Recurrence,
  today: DateKey,
  anchorDate: DateKey = dueDate,
): DateKey | null {
  if (recurrence === 'none') return null;
  const anchorDay = parseDateKey(anchorDate).getDate();
  const step = (d: DateKey): DateKey => {
    switch (recurrence) {
      case 'daily':
        return addDays(d, 1);
      case 'weekly':
        return addDays(d, 7);
      case 'monthly':
        return addMonths(anchorDate, monthsBetween(anchorDate, d) + 1, anchorDay);
      default:
        return d;
    }
  };
  let next = step(dueDate);
  // Skip occurrences that are already in the past or today (today's one was just done).
  let guard = 0;
  while (next <= today && guard++ < 5000) next = step(next);
  return next;
}

function monthsBetween(a: DateKey, b: DateKey): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

/** Projected future dates of a recurring task within [from, to] (for the calendar). */
export function projectOccurrences(task: Task, from: DateKey, to: DateKey): DateKey[] {
  if (task.recurrence === 'none' || task.status !== 'pending' || task.deletedAt) return [];
  const out: DateKey[] = [];
  let d: DateKey = task.dueDate;
  let guard = 0;
  while (d <= to && guard++ < 400) {
    const next = nextOccurrence(d, task.recurrence, d, task.originalDate);
    if (!next) break;
    d = next;
    if (d >= from && d <= to) out.push(d);
  }
  return out;
}

export type PostponePreset = 'tomorrow' | 'twoDays' | 'nextWeek' | 'nextMonth';

export const POSTPONE_LABEL: Record<PostponePreset, string> = {
  tomorrow: 'غداً',
  twoDays: 'بعد يومين',
  nextWeek: 'الأسبوع القادم',
  nextMonth: 'الشهر القادم',
};

export function postponeTarget(preset: PostponePreset, today: DateKey, current: DateKey): DateKey {
  // Postponing is always relative to today for overdue tasks, so they land in the future.
  const base = current < today ? today : current;
  switch (preset) {
    case 'tomorrow':
      return current < today ? addDays(today, 1) : addDays(base, 1);
    case 'twoDays':
      return addDays(base, 2);
    case 'nextWeek':
      return addDays(base, 7);
    case 'nextMonth':
      return addMonths(base, 1);
  }
}

export type GroupMode = 'day' | 'week' | 'month';

export interface TaskGroup {
  key: DateKey;
  tasks: Task[];
}

/** Groups pending future tasks by day, week (Saturday start) or month. */
export function groupTasks(tasks: Task[], mode: GroupMode): TaskGroup[] {
  const map = new Map<DateKey, Task[]>();
  for (const t of sortTasks(tasks)) {
    const key =
      mode === 'day' ? t.dueDate : mode === 'week' ? startOfWeek(t.dueDate) : startOfMonth(t.dueDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, list]) => ({ key, tasks: list }));
}

export interface RangeStats {
  planned: number;
  completed: number;
  /** Planned tasks in range that are done. */
  completedOfPlanned: number;
  overdue: number;
  percent: number;
  byCategory: { categoryId: string | null; planned: number; completed: number }[];
  byDay: { date: DateKey; planned: number; completed: number }[];
  onTimeRate: number;
}

/** Statistics for the inclusive date range [from, to]. */
export function computeStats(tasks: Task[], from: DateKey, to: DateKey, now: Date = new Date()): RangeStats {
  const live = tasks.filter((t) => !t.deletedAt);
  const inRange = (d: DateKey) => d >= from && d <= to;
  const planned = live.filter((t) => inRange(t.dueDate));
  const completedInRange = live.filter(
    (t) => t.status === 'done' && t.completedAt && inRange(toDateKey(new Date(t.completedAt))),
  );
  const completedOfPlanned = planned.filter((t) => t.status === 'done').length;
  const overdue = planned.filter((t) => isOverdue(t, now)).length;
  const onTime = completedInRange.filter((t) => toDateKey(new Date(t.completedAt!)) <= t.dueDate).length;

  const cats = new Map<string | null, { planned: number; completed: number }>();
  for (const t of planned) {
    const c = cats.get(t.categoryId) ?? { planned: 0, completed: 0 };
    c.planned++;
    if (t.status === 'done') c.completed++;
    cats.set(t.categoryId, c);
  }

  const byDay: RangeStats['byDay'] = [];
  const span = diffDays(to, from);
  if (span <= 31) {
    for (let i = 0; i <= span; i++) {
      const date = addDays(from, i);
      byDay.push({
        date,
        planned: planned.filter((t) => t.dueDate === date).length,
        completed: completedInRange.filter((t) => toDateKey(new Date(t.completedAt!)) === date).length,
      });
    }
  }

  return {
    planned: planned.length,
    completed: completedInRange.length,
    completedOfPlanned,
    overdue,
    percent: planned.length === 0 ? 0 : Math.round((completedOfPlanned / planned.length) * 100),
    byCategory: [...cats.entries()]
      .map(([categoryId, v]) => ({ categoryId, ...v }))
      .sort((a, b) => b.planned - a.planned),
    byDay,
    onTimeRate: completedInRange.length === 0 ? 0 : Math.round((onTime / completedInRange.length) * 100),
  };
}

/** Consecutive days with planned tasks where all were done (days without tasks are skipped). */
export function streak(tasks: Task[], today: DateKey): number {
  let count = 0;
  let day = today;
  const live = tasks.filter((t) => !t.deletedAt);
  // Today only counts if it's already complete; otherwise start from yesterday.
  for (let i = 0; i < 366; i++) {
    const planned = live.filter((t) => t.dueDate === day);
    if (planned.length > 0) {
      const done = planned.every((t) => t.status === 'done');
      if (done) count++;
      else if (i !== 0) break;
    }
    day = addDays(day, -1);
  }
  return count;
}
