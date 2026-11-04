/** @jest-environment node */
import { addMonths, relativeDayLabel, startOfWeek } from '../domain/dates';
import { buildTodayView, computeStats, groupTasks, isOverdue, nextOccurrence, postponeTarget, projectOccurrences } from '../domain/rules';
import { Task } from '../domain/types';

const base = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36),
  title: 't',
  description: '',
  dueDate: '2026-11-04',
  dueTime: null,
  originalDate: over.dueDate ?? '2026-11-04',
  priority: 'medium',
  categoryId: null,
  recurrence: 'none',
  reminders: [],
  status: 'pending',
  completedAt: null,
  deletedAt: null,
  postponeCount: 0,
  seriesId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const TODAY = '2026-11-04';

describe('dates', () => {
  it('clamps monthly dates to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
  });
  it('weeks start on Saturday', () => {
    expect(startOfWeek('2026-11-04')).toBe('2026-10-31'); // Wed -> Sat
    expect(startOfWeek('2026-10-31')).toBe('2026-10-31');
  });
  it('relative labels', () => {
    expect(relativeDayLabel('2026-11-04', TODAY)).toBe('اليوم');
    expect(relativeDayLabel('2026-11-05', TODAY)).toBe('غداً');
    expect(relativeDayLabel('2026-11-02', TODAY)).toBe('منذ يومين');
  });
});

describe('today view & carry-over', () => {
  const tasks = [
    base({ id: 'today', dueDate: TODAY }),
    base({ id: 'old', dueDate: '2026-11-01' }),
    base({ id: 'future', dueDate: '2026-11-10' }),
    base({ id: 'doneToday', dueDate: TODAY, status: 'done', completedAt: '2026-11-04T08:00:00' }),
    base({ id: 'oldDoneToday', dueDate: '2026-11-02', status: 'done', completedAt: '2026-11-04T09:00:00' }),
    base({ id: 'oldDoneEarlier', dueDate: '2026-11-02', status: 'done', completedAt: '2026-11-02T09:00:00' }),
    base({ id: 'trash', dueDate: TODAY, deletedAt: '2026-11-04T00:00:00Z' }),
  ];

  it('carries unfinished tasks into today, keeping the original date', () => {
    const v = buildTodayView(tasks, TODAY, true);
    expect(v.carried.map((t) => t.id)).toEqual(['old']);
    expect(v.carried[0].dueDate).toBe('2026-11-01');
    expect(v.pending.map((t) => t.id)).toEqual(['today']);
    expect(v.done.map((t) => t.id).sort()).toEqual(['doneToday', 'oldDoneToday']);
    expect(v.total).toBe(4);
    expect(v.doneCount).toBe(2);
    expect(v.remaining).toBe(2);
    expect(v.percent).toBe(50);
  });

  it('can turn carry-over off', () => {
    const v = buildTodayView(tasks, TODAY, false);
    expect(v.carried).toHaveLength(0);
    expect(v.total).toBe(2);
  });

  it('flags overdue by date and by time', () => {
    const now = new Date(2026, 10, 4, 12, 0);
    expect(isOverdue(base({ dueDate: '2026-11-03' }), now)).toBe(true);
    expect(isOverdue(base({ dueDate: TODAY, dueTime: '10:00' }), now)).toBe(true);
    expect(isOverdue(base({ dueDate: TODAY, dueTime: '14:00' }), now)).toBe(false);
    expect(isOverdue(base({ dueDate: TODAY }), now)).toBe(false);
    expect(isOverdue(base({ dueDate: '2026-11-03', status: 'done' }), now)).toBe(false);
  });
});

describe('recurrence', () => {
  it('daily goes to the next day after today', () => {
    expect(nextOccurrence(TODAY, 'daily', TODAY)).toBe('2026-11-05');
    expect(nextOccurrence('2026-11-01', 'daily', TODAY)).toBe('2026-11-05');
  });
  it('weekly keeps the weekday', () => {
    expect(nextOccurrence('2026-10-28', 'weekly', TODAY)).toBe('2026-11-11');
  });
  it('monthly keeps the anchor day across short months', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'monthly', '2026-02-28', '2026-01-31')).toBe('2026-03-31');
  });
  it('early completion of a future recurring task moves one step', () => {
    expect(nextOccurrence('2026-11-20', 'weekly', TODAY)).toBe('2026-11-27');
  });
  it('none returns null', () => {
    expect(nextOccurrence(TODAY, 'none', TODAY)).toBeNull();
  });
  it('projects occurrences for the calendar', () => {
    const t = base({ dueDate: TODAY, recurrence: 'weekly' });
    expect(projectOccurrences(t, '2026-11-01', '2026-11-30')).toEqual(['2026-11-11', '2026-11-18', '2026-11-25']);
  });
});

describe('postpone', () => {
  it('moves overdue tasks relative to today', () => {
    expect(postponeTarget('tomorrow', TODAY, '2026-10-01')).toBe('2026-11-05');
    expect(postponeTarget('tomorrow', TODAY, '2026-11-10')).toBe('2026-11-11');
    expect(postponeTarget('nextWeek', TODAY, TODAY)).toBe('2026-11-11');
  });
});

describe('grouping & stats', () => {
  it('groups by week and month', () => {
    const tasks = [base({ dueDate: '2026-11-05' }), base({ dueDate: '2026-11-08' }), base({ dueDate: '2026-12-01' })];
    expect(groupTasks(tasks, 'week').map((g) => g.key)).toEqual(['2026-10-31', '2026-11-07', '2026-11-28']);
    expect(groupTasks(tasks, 'month').map((g) => [g.key, g.tasks.length])).toEqual([
      ['2026-11-01', 2],
      ['2026-12-01', 1],
    ]);
  });
  it('computes completion percentage for a range', () => {
    const tasks = [
      base({ dueDate: '2026-11-02', status: 'done', completedAt: new Date(2026, 10, 2, 10).toISOString() }),
      base({ dueDate: '2026-11-03' }),
      base({ dueDate: '2026-11-03', status: 'done', completedAt: new Date(2026, 10, 4, 10).toISOString() }),
      base({ dueDate: '2026-11-20' }),
    ];
    const s = computeStats(tasks, '2026-11-01', '2026-11-07', new Date(2026, 10, 4, 12));
    expect(s.planned).toBe(3);
    expect(s.completedOfPlanned).toBe(2);
    expect(s.percent).toBe(67);
    expect(s.overdue).toBe(1);
    expect(s.onTimeRate).toBe(50);
    expect(s.byDay).toHaveLength(7);
  });
});
