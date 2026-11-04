import type { DateKey } from './dates';

export type Priority = 'high' | 'medium' | 'low';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type TaskStatus = 'pending' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: DateKey;
  dueTime: string | null; // HH:mm
  /** First date the task was planned for. Kept when postponed or carried over. */
  originalDate: DateKey;
  priority: Priority;
  categoryId: string | null;
  recurrence: Recurrence;
  /** Minutes before the due time to remind. 0 = at due time. */
  reminders: number[];
  status: TaskStatus;
  completedAt: string | null; // ISO
  deletedAt: string | null; // ISO, soft delete (trash)
  postponeCount: number;
  seriesId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  deletedAt: string | null;
  updatedAt: string;
}

export type HistoryAction =
  | 'created'
  | 'updated'
  | 'completed'
  | 'reopened'
  | 'postponed'
  | 'deleted'
  | 'recovered'
  | 'recurred';

export interface HistoryEntry {
  id: string;
  taskId: string;
  action: HistoryAction;
  details: string;
  at: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  dueDate: DateKey;
  dueTime?: string | null;
  priority?: Priority;
  categoryId?: string | null;
  recurrence?: Recurrence;
  reminders?: number[];
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'عاجلة',
  medium: 'متوسطة',
  low: 'منخفضة',
};

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'بدون تكرار',
  daily: 'يومياً',
  weekly: 'أسبوعياً',
  monthly: 'شهرياً',
};

export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'عند الموعد' },
  { minutes: 5, label: 'قبل 5 دقائق' },
  { minutes: 15, label: 'قبل 15 دقيقة' },
  { minutes: 30, label: 'قبل 30 دقيقة' },
  { minutes: 60, label: 'قبل ساعة' },
  { minutes: 120, label: 'قبل ساعتين' },
  { minutes: 1440, label: 'قبل يوم' },
];

export function reminderLabel(minutes: number): string {
  return REMINDER_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `قبل ${minutes} دقيقة`;
}

export const DEFAULT_CATEGORIES: Omit<Category, 'updatedAt' | 'deletedAt'>[] = [
  { id: 'cat-work', name: 'عمل', color: '#2563EB', icon: 'briefcase-outline', sortOrder: 0 },
  { id: 'cat-personal', name: 'شخصي', color: '#16A34A', icon: 'person-outline', sortOrder: 1 },
  { id: 'cat-meetings', name: 'اجتماعات', color: '#9333EA', icon: 'people-outline', sortOrder: 2 },
  { id: 'cat-followup', name: 'متابعة', color: '#EA580C', icon: 'refresh-outline', sortOrder: 3 },
  { id: 'cat-other', name: 'أخرى', color: '#64748B', icon: 'pricetag-outline', sortOrder: 4 },
];
