import * as SQLite from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { Repository } from '../db/repository';
import { DateKey, todayKey } from '../domain/dates';
import { AppSettings, DEFAULT_SETTINGS, parseSettings, serializeSetting } from '../domain/settings';
import { Category, Task, TaskInput } from '../domain/types';
import { autoBackup } from '../services/backup';
import { configureNotifications, ensurePermission, syncNotifications } from '../services/notifications';
import { dark, light, Palette, PRIORITY_COLOR } from '../theme/colors';

interface StoreValue {
  ready: boolean;
  error: string | null;
  repo: Repository | null;
  tasks: Task[];
  categories: Category[];
  allCategories: Category[];
  categoryById: (id: string | null) => Category | undefined;
  settings: AppSettings;
  today: DateKey;
  now: Date;
  createTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, input: TaskInput) => Promise<Task>;
  completeTask: (id: string) => Promise<{ next: Task | null }>;
  reopenTask: (id: string) => Promise<void>;
  postponeTask: (id: string, date: DateKey, time?: string | null) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  recoverTask: (id: string) => Promise<void>;
  purgeTask: (id: string) => Promise<void>;
  emptyTrash: () => Promise<number>;
  saveCategory: (c: { id?: string; name: string; color: string; icon?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  reload: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(() => new Date());

  // Keep "today" and overdue highlighting fresh across midnight / app resume.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  const load = useCallback(async (r: Repository) => {
    const [t, c, s] = await Promise.all([r.allTasks(), r.categories(true), r.getSettings()]);
    setTasks(t);
    setAllCategories(c);
    const parsed = parseSettings(s);
    setSettings(parsed);
    return { tasks: t, settings: parsed };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('mytasks.db');
        const r = new Repository(db);
        await r.migrate();
        if (cancelled) return;
        const { tasks: t, settings: s } = await load(r);
        setRepo(r);
        setReady(true);
        await configureNotifications();
        if (s.notificationsEnabled) await ensurePermission();
        syncNotifications(t, s);
        const today = todayKey();
        if (s.autoBackup && s.lastAutoBackup !== today) {
          try {
            if (await autoBackup(r)) {
              await r.setSetting('lastAutoBackup', today);
            }
          } catch (e) {
            console.warn('auto backup failed', e);
          }
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /** Reload from SQLite after every write and re-plan notifications. */
  const mutate = useCallback(
    async <T,>(fn: (r: Repository) => Promise<T>): Promise<T> => {
      if (!repo) throw new Error('قاعدة البيانات غير جاهزة');
      const result = await fn(repo);
      const { tasks: t, settings: s } = await load(repo);
      syncNotifications(t, s);
      return result;
    },
    [repo, load],
  );

  const value = useMemo<StoreValue>(() => {
    const categories = allCategories.filter((c) => !c.deletedAt);
    return {
      ready,
      error,
      repo,
      tasks,
      categories,
      allCategories,
      categoryById: (id) => (id ? allCategories.find((c) => c.id === id) : undefined),
      settings,
      today: todayKey(now),
      now,
      createTask: (input) => mutate((r) => r.createTask(input)),
      updateTask: (id, input) => mutate((r) => r.updateTask(id, input)),
      completeTask: (id) => mutate(async (r) => ({ next: (await r.completeTask(id)).next })),
      reopenTask: (id) => mutate(async (r) => void (await r.reopenTask(id))),
      postponeTask: (id, date, time) => mutate(async (r) => void (await r.postponeTask(id, date, time))),
      deleteTask: (id) => mutate((r) => r.deleteTask(id)),
      recoverTask: (id) => mutate(async (r) => void (await r.recoverTask(id))),
      purgeTask: (id) => mutate((r) => r.purgeTask(id)),
      emptyTrash: () => mutate((r) => r.emptyTrash()),
      saveCategory: (c) => mutate(async (r) => void (await r.saveCategory(c))),
      deleteCategory: (id) => mutate((r) => r.deleteCategory(id)),
      updateSetting: async (key, v) => {
        await mutate((r) => r.setSetting(key, serializeSetting(v)));
        if (key === 'notificationsEnabled' && v === true) {
          await ensurePermission();
          if (repo) syncNotifications(await repo.allTasks(), { ...settings, notificationsEnabled: true });
        }
      },
      reload: async () => {
        if (repo) {
          const { tasks: t, settings: s } = await load(repo);
          syncNotifications(t, s);
        }
      },
    };
  }, [ready, error, repo, tasks, allCategories, settings, now, mutate, load]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

export interface Theme {
  colors: Palette;
  isDark: boolean;
  priority: { high: string; medium: string; low: string };
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const ctx = useContext(StoreContext);
  const pref = ctx?.settings.theme ?? 'system';
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  return useMemo(
    () => ({ colors: isDark ? dark : light, isDark, priority: isDark ? PRIORITY_COLOR.dark : PRIORITY_COLOR.light }),
    [isDark],
  );
}
