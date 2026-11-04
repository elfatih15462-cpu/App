/** @jest-environment node */
import { planNotifications } from '../domain/notificationPlan';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { Task } from '../domain/types';

const task = (over: Partial<Task>): Task => ({
  id: 'a',
  title: 'اجتماع',
  description: '',
  dueDate: '2026-11-04',
  dueTime: '15:00',
  originalDate: '2026-11-04',
  priority: 'high',
  categoryId: null,
  recurrence: 'none',
  reminders: [0, 30],
  status: 'pending',
  completedAt: null,
  deletedAt: null,
  postponeCount: 0,
  seriesId: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const now = new Date(2026, 10, 4, 12, 0);

it('schedules multiple reminders before the due time', () => {
  const plan = planNotifications([task({})], { ...DEFAULT_SETTINGS, morningSummary: false, overdueAlert: false }, now);
  expect(plan.map((p) => [p.at.getHours(), p.at.getMinutes()])).toEqual([
    [14, 30],
    [15, 0],
  ]);
});

it('skips past reminders, done and deleted tasks, and respects the master switch', () => {
  const s = { ...DEFAULT_SETTINGS, morningSummary: false, overdueAlert: false };
  expect(planNotifications([task({ dueTime: '11:00' })], s, now)).toHaveLength(0);
  expect(planNotifications([task({ status: 'done' })], s, now)).toHaveLength(0);
  expect(planNotifications([task({ deletedAt: 'x' })], s, now)).toHaveLength(0);
  expect(planNotifications([task({})], { ...s, notificationsEnabled: false }, now)).toHaveLength(0);
});

it('uses the default time for tasks without a time', () => {
  const plan = planNotifications([task({ dueDate: '2026-11-05', dueTime: null, reminders: [0] })], { ...DEFAULT_SETTINGS, morningSummary: false, overdueAlert: false }, now);
  expect(plan[0].at.getHours()).toBe(9);
});

it('adds overdue alerts and morning summaries', () => {
  const plan = planNotifications([task({ dueDate: '2026-11-03', reminders: [] })], DEFAULT_SETTINGS, now);
  const overdue = plan.filter((p) => p.kind === 'overdue');
  const morning = plan.filter((p) => p.kind === 'morning');
  expect(overdue[0].at.getDate()).toBe(4);
  expect(overdue[0].at.getHours()).toBe(20);
  expect(morning[0].at.getDate()).toBe(5); // today's 08:00 already passed
});
