import { DateKey, todayKey } from '../domain/dates';
import { nextOccurrence } from '../domain/rules';
import {
  Category,
  DEFAULT_CATEGORIES,
  HistoryAction,
  HistoryEntry,
  Priority,
  Recurrence,
  Task,
  TaskInput,
} from '../domain/types';
import { Db, SqlParam } from './types';

export const SCHEMA_VERSION = 1;

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  due_date: string;
  due_time: string | null;
  original_date: string;
  priority: string;
  category_id: string | null;
  recurrence: string;
  reminders: string;
  status: string;
  completed_at: string | null;
  deleted_at: string | null;
  postpone_count: number;
  series_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  deleted_at: string | null;
  updated_at: string;
}

function rowToTask(r: TaskRow): Task {
  let reminders: number[] = [];
  try {
    reminders = JSON.parse(r.reminders || '[]');
  } catch {
    reminders = [];
  }
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    dueDate: r.due_date,
    dueTime: r.due_time,
    originalDate: r.original_date,
    priority: r.priority as Priority,
    categoryId: r.category_id,
    recurrence: r.recurrence as Recurrence,
    reminders,
    status: r.status === 'done' ? 'done' : 'pending',
    completedAt: r.completed_at,
    deletedAt: r.deleted_at,
    postponeCount: r.postpone_count ?? 0,
    seriesId: r.series_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function taskParams(t: Task): SqlParam[] {
  return [
    t.id,
    t.title,
    t.description,
    t.dueDate,
    t.dueTime,
    t.originalDate,
    t.priority,
    t.categoryId,
    t.recurrence,
    JSON.stringify(t.reminders),
    t.status,
    t.completedAt,
    t.deletedAt,
    t.postponeCount,
    t.seriesId,
    t.createdAt,
    t.updatedAt,
  ];
}

const TASK_COLUMNS =
  'id, title, description, due_date, due_time, original_date, priority, category_id, recurrence, reminders, status, completed_at, deleted_at, postpone_count, series_id, created_at, updated_at';

function rowToCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    sortOrder: r.sort_order,
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at,
  };
}

export interface BackupFile {
  app: 'my-tasks';
  version: number;
  exportedAt: string;
  tasks: Task[];
  categories: Category[];
  history: HistoryEntry[];
  settings: Record<string, string>;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * All persistence goes through this class. Nothing is ever hard-deleted
 * except by an explicit "delete permanently" from the trash (rule 6).
 */
export class Repository {
  constructor(private db: Db, private clock: () => Date = () => new Date()) {}

  private nowIso() {
    return this.clock().toISOString();
  }

  async migrate(): Promise<void> {
    await this.db.execAsync('PRAGMA journal_mode = WAL;');
    const row = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    const current = row?.user_version ?? 0;
    if (current >= SCHEMA_VERSION) return;
    if (current < 1) {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          due_date TEXT NOT NULL,
          due_time TEXT,
          original_date TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'medium',
          category_id TEXT,
          recurrence TEXT NOT NULL DEFAULT 'none',
          reminders TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'pending',
          completed_at TEXT,
          deleted_at TEXT,
          postpone_count INTEGER NOT NULL DEFAULT 0,
          series_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS task_history (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          action TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '',
          at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      const now = this.nowIso();
      for (const c of DEFAULT_CATEGORIES) {
        await this.db.runAsync(
          'INSERT OR IGNORE INTO categories (id, name, color, icon, sort_order, deleted_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
          [c.id, c.name, c.color, c.icon, c.sortOrder, now],
        );
      }
    }
    await this.db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  // ---------- history ----------

  private async log(taskId: string, action: HistoryAction, details = ''): Promise<void> {
    await this.db.runAsync('INSERT INTO task_history (id, task_id, action, details, at) VALUES (?, ?, ?, ?, ?)', [
      newId(),
      taskId,
      action,
      details,
      this.nowIso(),
    ]);
  }

  async history(taskId: string): Promise<HistoryEntry[]> {
    const rows = await this.db.getAllAsync<{ id: string; task_id: string; action: string; details: string; at: string }>(
      'SELECT * FROM task_history WHERE task_id = ? ORDER BY at DESC, rowid DESC',
      [taskId],
    );
    return rows.map((r) => ({ id: r.id, taskId: r.task_id, action: r.action as HistoryAction, details: r.details, at: r.at }));
  }

  // ---------- tasks ----------

  async allTasks(): Promise<Task[]> {
    const rows = await this.db.getAllAsync<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks`, []);
    return rows.map(rowToTask);
  }

  async getTask(id: string): Promise<Task | null> {
    const row = await this.db.getFirstAsync<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`, [id]);
    return row ? rowToTask(row) : null;
  }

  private async insertTask(t: Task): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO tasks (${TASK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      taskParams(t),
    );
  }

  private async saveTask(t: Task): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO tasks (${TASK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      taskParams(t),
    );
  }

  private async requireTask(id: string): Promise<Task> {
    const t = await this.getTask(id);
    if (!t) throw new Error(`Task ${id} not found`);
    return t;
  }

  async createTask(input: TaskInput): Promise<Task> {
    const title = input.title.trim();
    if (!title) throw new Error('عنوان المهمة مطلوب');
    const now = this.nowIso();
    const recurrence = input.recurrence ?? 'none';
    const id = newId();
    const task: Task = {
      id,
      title,
      description: (input.description ?? '').trim(),
      dueDate: input.dueDate,
      dueTime: input.dueTime || null,
      originalDate: input.dueDate,
      priority: input.priority ?? 'medium',
      categoryId: input.categoryId ?? null,
      recurrence,
      reminders: [...new Set(input.reminders ?? [])].sort((a, b) => a - b),
      status: 'pending',
      completedAt: null,
      deletedAt: null,
      postponeCount: 0,
      seriesId: recurrence === 'none' ? null : id,
      createdAt: now,
      updatedAt: now,
    };
    await this.insertTask(task);
    await this.log(id, 'created', task.dueDate);
    return task;
  }

  async updateTask(id: string, input: TaskInput): Promise<Task> {
    const prev = await this.requireTask(id);
    const title = input.title.trim();
    if (!title) throw new Error('عنوان المهمة مطلوب');
    const recurrence = input.recurrence ?? prev.recurrence;
    const next: Task = {
      ...prev,
      title,
      description: (input.description ?? '').trim(),
      dueDate: input.dueDate,
      dueTime: input.dueTime || null,
      priority: input.priority ?? prev.priority,
      categoryId: input.categoryId === undefined ? prev.categoryId : input.categoryId,
      recurrence,
      reminders: [...new Set(input.reminders ?? prev.reminders)].sort((a, b) => a - b),
      seriesId: recurrence === 'none' ? prev.seriesId : prev.seriesId ?? prev.id,
      updatedAt: this.nowIso(),
    };
    const changes: string[] = [];
    if (prev.title !== next.title) changes.push('العنوان');
    if (prev.description !== next.description) changes.push('الوصف');
    if (prev.dueDate !== next.dueDate) changes.push(`التاريخ: ${prev.dueDate} ← ${next.dueDate}`);
    if (prev.dueTime !== next.dueTime) changes.push('الوقت');
    if (prev.priority !== next.priority) changes.push('الأولوية');
    if (prev.categoryId !== next.categoryId) changes.push('التصنيف');
    if (prev.recurrence !== next.recurrence) changes.push('التكرار');
    if (JSON.stringify(prev.reminders) !== JSON.stringify(next.reminders)) changes.push('التذكيرات');
    if (prev.dueDate !== next.dueDate && next.dueDate > prev.dueDate) next.postponeCount = prev.postponeCount + 1;
    await this.saveTask(next);
    if (changes.length) await this.log(id, 'updated', changes.join('، '));
    return next;
  }

  /**
   * Rule 2: ticking a task records completion time and moves it to the archive.
   * For recurring tasks, the next occurrence is created automatically.
   */
  async completeTask(id: string): Promise<{ task: Task; next: Task | null }> {
    const prev = await this.requireTask(id);
    if (prev.status === 'done') return { task: prev, next: null };
    const now = this.nowIso();
    const task: Task = { ...prev, status: 'done', completedAt: now, updatedAt: now };
    let next: Task | null = null;
    await this.db.withTransactionAsync(async () => {
      await this.saveTask(task);
      await this.log(id, 'completed');
      if (prev.recurrence !== 'none') {
        const today = todayKey(this.clock());
        const seriesId = prev.seriesId ?? prev.id;
        // Avoid duplicating the next occurrence if one already exists (e.g. after un-archiving).
        const nextDate = nextOccurrence(prev.dueDate, prev.recurrence, today, prev.originalDate);
        const existing = nextDate
          ? await this.db.getFirstAsync<{ id: string }>(
              "SELECT id FROM tasks WHERE series_id = ? AND due_date = ? AND deleted_at IS NULL AND status = 'pending'",
              [seriesId, nextDate],
            )
          : null;
        if (nextDate && !existing) {
          next = {
            ...prev,
            id: newId(),
            dueDate: nextDate,
            status: 'pending',
            completedAt: null,
            deletedAt: null,
            postponeCount: 0,
            seriesId,
            createdAt: now,
            updatedAt: now,
          };
          await this.insertTask(next);
          await this.log(next.id, 'recurred', nextDate);
        }
      }
    });
    return { task, next };
  }

  /** Rule 7: restore an archived task back to the active list. */
  async reopenTask(id: string): Promise<Task> {
    const prev = await this.requireTask(id);
    const task: Task = { ...prev, status: 'pending', completedAt: null, updatedAt: this.nowIso() };
    await this.saveTask(task);
    await this.log(id, 'reopened');
    return task;
  }

  /** Rule 5: move a task to another day without losing any of its data. */
  async postponeTask(id: string, date: DateKey, time?: string | null): Promise<Task> {
    const prev = await this.requireTask(id);
    const task: Task = {
      ...prev,
      dueDate: date,
      dueTime: time === undefined ? prev.dueTime : time,
      postponeCount: prev.postponeCount + (date > prev.dueDate ? 1 : 0),
      status: 'pending',
      completedAt: null,
      updatedAt: this.nowIso(),
    };
    await this.saveTask(task);
    await this.log(id, 'postponed', `${prev.dueDate} ← ${date}`);
    return task;
  }

  /** Rule 6: deleting moves the task to the trash; it can be recovered. */
  async deleteTask(id: string): Promise<void> {
    const prev = await this.requireTask(id);
    const now = this.nowIso();
    await this.saveTask({ ...prev, deletedAt: now, updatedAt: now });
    await this.log(id, 'deleted');
  }

  async recoverTask(id: string): Promise<Task> {
    const prev = await this.requireTask(id);
    const task = { ...prev, deletedAt: null, updatedAt: this.nowIso() };
    await this.saveTask(task);
    await this.log(id, 'recovered');
    return task;
  }

  /** Permanent removal: only reachable from the trash after explicit confirmation. */
  async purgeTask(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM tasks WHERE id = ? AND deleted_at IS NOT NULL', [id]);
      await this.db.runAsync('DELETE FROM task_history WHERE task_id = ? AND NOT EXISTS (SELECT 1 FROM tasks WHERE id = ?)', [id, id]);
    });
  }

  async emptyTrash(): Promise<number> {
    const rows = await this.db.getAllAsync<{ id: string }>('SELECT id FROM tasks WHERE deleted_at IS NOT NULL', []);
    for (const r of rows) await this.purgeTask(r.id);
    return rows.length;
  }

  // ---------- categories ----------

  async categories(includeDeleted = false): Promise<Category[]> {
    const rows = await this.db.getAllAsync<CategoryRow>(
      `SELECT * FROM categories ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY sort_order, name`,
      [],
    );
    return rows.map(rowToCategory);
  }

  async saveCategory(c: { id?: string; name: string; color: string; icon?: string }): Promise<Category> {
    const name = c.name.trim();
    if (!name) throw new Error('اسم التصنيف مطلوب');
    const now = this.nowIso();
    if (c.id) {
      await this.db.runAsync('UPDATE categories SET name = ?, color = ?, icon = COALESCE(?, icon), updated_at = ? WHERE id = ?', [
        name,
        c.color,
        c.icon ?? null,
        now,
        c.id,
      ]);
      const row = await this.db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [c.id]);
      return rowToCategory(row!);
    }
    const maxRow = await this.db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories', []);
    const cat: Category = {
      id: newId(),
      name,
      color: c.color,
      icon: c.icon ?? 'pricetag-outline',
      sortOrder: (maxRow?.m ?? 0) + 1,
      deletedAt: null,
      updatedAt: now,
    };
    await this.db.runAsync(
      'INSERT INTO categories (id, name, color, icon, sort_order, deleted_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      [cat.id, cat.name, cat.color, cat.icon, cat.sortOrder, now],
    );
    return cat;
  }

  /** Categories are hidden, not removed, so tasks keep their label in the archive. */
  async deleteCategory(id: string): Promise<void> {
    const now = this.nowIso();
    await this.db.runAsync('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
  }

  // ---------- settings ----------

  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings', []);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // ---------- backup / sync ----------

  async exportAll(): Promise<BackupFile> {
    const history = await this.db.getAllAsync<{ id: string; task_id: string; action: string; details: string; at: string }>(
      'SELECT * FROM task_history ORDER BY at',
      [],
    );
    return {
      app: 'my-tasks',
      version: SCHEMA_VERSION,
      exportedAt: this.nowIso(),
      tasks: await this.allTasks(),
      categories: await this.categories(true),
      history: history.map((r) => ({ id: r.id, taskId: r.task_id, action: r.action as HistoryAction, details: r.details, at: r.at })),
      settings: await this.getSettings(),
    };
  }

  /**
   * Merges a backup into the local database. Records are matched by id and
   * the most recently updated copy wins, so importing the same file on two
   * devices brings them in sync without losing anything.
   */
  async importBackup(data: unknown, opts: { includeSettings?: boolean } = {}): Promise<ImportResult> {
    const file = data as Partial<BackupFile>;
    if (!file || file.app !== 'my-tasks' || !Array.isArray(file.tasks)) {
      throw new Error('الملف ليس نسخة احتياطية صالحة من تطبيق مهامي');
    }
    const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
    await this.db.withTransactionAsync(async () => {
      for (const c of file.categories ?? []) {
        const existing = await this.db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [c.id]);
        if (!existing || existing.updated_at < c.updatedAt) {
          await this.db.runAsync(
            'INSERT OR REPLACE INTO categories (id, name, color, icon, sort_order, deleted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [c.id, c.name, c.color, c.icon, c.sortOrder, c.deletedAt, c.updatedAt],
          );
        }
      }
      for (const raw of file.tasks! as Partial<Task>[]) {
        if (!raw?.id || !raw.title || !raw.dueDate) {
          result.skipped++;
          continue;
        }
        const t: Task = {
          description: '',
          dueTime: null,
          originalDate: raw.dueDate,
          priority: 'medium',
          categoryId: null,
          recurrence: 'none',
          reminders: [],
          status: 'pending',
          completedAt: null,
          deletedAt: null,
          postponeCount: 0,
          seriesId: null,
          createdAt: raw.updatedAt ?? this.nowIso(),
          updatedAt: this.nowIso(),
          ...raw,
        } as Task;
        const existing = await this.getTask(t.id);
        if (!existing) {
          await this.insertTask(t);
          result.added++;
        } else if (existing.updatedAt < t.updatedAt) {
          await this.saveTask(t);
          result.updated++;
        } else {
          result.skipped++;
        }
      }
      for (const h of file.history ?? []) {
        await this.db.runAsync('INSERT OR IGNORE INTO task_history (id, task_id, action, details, at) VALUES (?, ?, ?, ?, ?)', [
          h.id,
          h.taskId,
          h.action,
          h.details ?? '',
          h.at,
        ]);
      }
      if (opts.includeSettings && file.settings) {
        for (const [k, v] of Object.entries(file.settings)) await this.setSetting(k, String(v));
      }
    });
    return result;
  }
}
