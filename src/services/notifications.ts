import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { planNotifications } from '../domain/notificationPlan';
import { AppSettings } from '../domain/settings';
import { Task } from '../domain/types';

const CHANNEL_ID = 'tasks';
const supported = Platform.OS === 'ios' || Platform.OS === 'android';
let configured = false;

export async function configureNotifications(): Promise<void> {
  if (!supported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'تذكيرات المهام',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

let running: Promise<void> | null = null;
let queued: { tasks: Task[]; settings: AppSettings } | null = null;

/** Re-plans every local notification from the current database state. */
export function syncNotifications(tasks: Task[], settings: AppSettings): Promise<void> {
  if (!supported) return Promise.resolve();
  queued = { tasks, settings };
  if (running) return running;
  running = (async () => {
    while (queued) {
      const job = queued;
      queued = null;
      try {
        await doSync(job.tasks, job.settings);
      } catch (e) {
        console.warn('notification sync failed', e);
      }
    }
    running = null;
  })();
  return running;
}

async function doSync(tasks: Task[], settings: AppSettings) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.notificationsEnabled) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const plan = planNotifications(tasks, settings);
  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: n.title,
        body: n.body,
        data: n.taskId ? { taskId: n.taskId } : { screen: 'today' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: n.at,
        channelId: CHANNEL_ID,
      },
    });
  }
}

export function addResponseListener(onTask: (taskId: string | null) => void): () => void {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const data = res.notification.request.content.data as { taskId?: string } | undefined;
    onTask(data?.taskId ?? null);
  });
  return () => sub.remove();
}
