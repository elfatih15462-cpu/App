/** @jest-environment node */
import { Repository } from '../db/repository';
import { buildTodayView } from '../domain/rules';
import { createMemoryDb } from '../testing/sqliteAdapter';

let now = new Date(2026, 10, 4, 10, 0);
const clock = () => now;

async function setup() {
  const repo = new Repository(createMemoryDb(), clock);
  await repo.migrate();
  return repo;
}

beforeEach(() => {
  now = new Date(2026, 10, 4, 10, 0);
});

describe('Repository', () => {
  it('seeds default categories and is idempotent', async () => {
    const repo = await setup();
    await repo.migrate();
    const cats = await repo.categories();
    expect(cats.map((c) => c.name)).toEqual(['عمل', 'شخصي', 'اجتماعات', 'متابعة', 'أخرى']);
  });

  it('rejects empty titles', async () => {
    const repo = await setup();
    await expect(repo.createTask({ title: '   ', dueDate: '2026-11-04' })).rejects.toThrow();
  });

  it('completing a task archives it with a timestamp; reopening restores it', async () => {
    const repo = await setup();
    const t = await repo.createTask({ title: 'اتصال بالعميل', dueDate: '2026-11-04', priority: 'high' });
    const { task } = await repo.completeTask(t.id);
    expect(task.status).toBe('done');
    expect(task.completedAt).toBe(now.toISOString());
    const reopened = await repo.reopenTask(t.id);
    expect(reopened.status).toBe('pending');
    expect(reopened.completedAt).toBeNull();
    const h = await repo.history(t.id);
    expect(h.map((x) => x.action)).toEqual(['reopened', 'completed', 'created']);
  });

  it('unfinished tasks are never removed and roll over to the next day', async () => {
    const repo = await setup();
    const t = await repo.createTask({ title: 'تقرير', dueDate: '2026-11-04' });
    now = new Date(2026, 10, 6, 9, 0);
    const all = await repo.allTasks();
    expect(all).toHaveLength(1);
    const v = buildTodayView(all, '2026-11-06');
    expect(v.carried.map((x) => x.id)).toEqual([t.id]);
    expect(v.carried[0].originalDate).toBe('2026-11-04');
  });

  it('postponing keeps all data and the original date', async () => {
    const repo = await setup();
    const t = await repo.createTask({
      title: 'مراجعة',
      description: 'تفاصيل',
      dueDate: '2026-11-04',
      dueTime: '14:30',
      categoryId: 'cat-work',
      reminders: [15, 0],
    });
    const p = await repo.postponeTask(t.id, '2026-11-08');
    expect(p).toMatchObject({
      title: 'مراجعة',
      description: 'تفاصيل',
      dueDate: '2026-11-08',
      dueTime: '14:30',
      originalDate: '2026-11-04',
      categoryId: 'cat-work',
      reminders: [0, 15],
      postponeCount: 1,
    });
  });

  it('completing a recurring task schedules the next occurrence once', async () => {
    const repo = await setup();
    const t = await repo.createTask({ title: 'رياضة', dueDate: '2026-11-04', recurrence: 'daily' });
    const { next } = await repo.completeTask(t.id);
    expect(next?.dueDate).toBe('2026-11-05');
    expect(next?.seriesId).toBe(t.id);
    // reopening and completing again must not duplicate tomorrow's task
    await repo.reopenTask(t.id);
    const again = await repo.completeTask(t.id);
    expect(again.next).toBeNull();
    const pending = (await repo.allTasks()).filter((x) => x.status === 'pending');
    expect(pending).toHaveLength(1);
  });

  it('delete goes to trash, can be recovered, and purge is permanent', async () => {
    const repo = await setup();
    const t = await repo.createTask({ title: 'x', dueDate: '2026-11-04' });
    await repo.deleteTask(t.id);
    expect((await repo.getTask(t.id))?.deletedAt).toBeTruthy();
    await repo.recoverTask(t.id);
    expect((await repo.getTask(t.id))?.deletedAt).toBeNull();
    // purge refuses tasks not in the trash
    await repo.purgeTask(t.id);
    expect(await repo.getTask(t.id)).not.toBeNull();
    await repo.deleteTask(t.id);
    await repo.purgeTask(t.id);
    expect(await repo.getTask(t.id)).toBeNull();
    expect(await repo.history(t.id)).toEqual([]);
  });

  it('backup round-trips and merges by most recent update', async () => {
    const a = await setup();
    const t1 = await a.createTask({ title: 'من الجهاز أ', dueDate: '2026-11-04' });
    const backup = await a.exportAll();

    const b = await setup();
    await b.createTask({ title: 'من الجهاز ب', dueDate: '2026-11-05' });
    const r1 = await b.importBackup(JSON.parse(JSON.stringify(backup)));
    expect(r1.added).toBe(1);
    expect((await b.allTasks()).map((t) => t.title).sort()).toEqual(['من الجهاز أ', 'من الجهاز ب']);

    // newer edit on device B wins over the older copy
    now = new Date(2026, 10, 4, 11, 0);
    await b.updateTask(t1.id, { title: 'معدلة', dueDate: '2026-11-04' });
    const r2 = await b.importBackup(backup);
    expect(r2.updated).toBe(0);
    expect((await b.getTask(t1.id))?.title).toBe('معدلة');

    await expect(b.importBackup({ foo: 1 })).rejects.toThrow();
  });

  it('category CRUD hides deleted categories', async () => {
    const repo = await setup();
    const c = await repo.saveCategory({ name: 'دراسة', color: '#000000' });
    expect((await repo.categories()).some((x) => x.id === c.id)).toBe(true);
    await repo.saveCategory({ id: c.id, name: 'تعلم', color: '#111111' });
    expect((await repo.categories()).find((x) => x.id === c.id)?.name).toBe('تعلم');
    await repo.deleteCategory(c.id);
    expect((await repo.categories()).some((x) => x.id === c.id)).toBe(false);
    expect((await repo.categories(true)).some((x) => x.id === c.id)).toBe(true);
  });
});
