import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateKey, formatShortDate } from '../domain/dates';
import { POSTPONE_LABEL, PostponePreset, postponeTarget } from '../domain/rules';
import { Task } from '../domain/types';
import { useStore, useTheme } from '../state/store';
import { DatePickerSheet } from './DatePickerSheet';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { IconName } from './ui';

interface Ctx {
  toggle: (t: Task) => void;
  openMenu: (t: Task) => void;
  openEdit: (t: Task) => void;
  confirmDelete: (t: Task, after?: () => void) => void;
}

const TaskActionsContext = createContext<Ctx | null>(null);

export function useTaskActions(): Ctx {
  const c = useContext(TaskActionsContext);
  if (!c) throw new Error('TaskActionsProvider missing');
  return c;
}

export function confirmAsync(title: string, message: string, confirmText: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export function TaskActionsProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const { completeTask, reopenTask, postponeTask, deleteTask, recoverTask, today } = store;
  const toast = useToast();
  const { colors } = useTheme();
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const [pickFor, setPickFor] = useState<Task | null>(null);

  const toggle = useCallback(
    async (t: Task) => {
      try {
        if (t.status === 'done') {
          await reopenTask(t.id);
          toast('أُعيدت المهمة إلى قائمة المهام');
          return;
        }
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const { next } = await completeTask(t.id);
        toast(next ? `أُنجزت ✓ — الموعد القادم ${formatShortDate(next.dueDate)}` : 'أُنجزت ✓ ونُقلت إلى الأرشيف', {
          actionLabel: 'تراجع',
          onAction: () => reopenTask(t.id),
        });
      } catch (e) {
        toast(e instanceof Error ? e.message : 'حدث خطأ');
      }
    },
    [completeTask, reopenTask, toast],
  );

  const doPostpone = useCallback(
    async (t: Task, date: DateKey) => {
      const prev = t.dueDate;
      await postponeTask(t.id, date);
      toast(`نُقلت إلى ${formatShortDate(date)}`, { actionLabel: 'تراجع', onAction: () => postponeTask(t.id, prev) });
    },
    [postponeTask, toast],
  );

  const confirmDelete = useCallback(
    async (t: Task, after?: () => void) => {
      const ok = await confirmAsync('حذف المهمة', `سيتم نقل "${t.title}" إلى سلة المحذوفات ويمكنك استعادتها لاحقاً.`, 'حذف', true);
      if (!ok) return;
      await deleteTask(t.id);
      after?.();
      toast('نُقلت المهمة إلى سلة المحذوفات', { actionLabel: 'استعادة', onAction: () => recoverTask(t.id) });
    },
    [deleteTask, recoverTask, toast],
  );

  const openEdit = useCallback((t: Task) => router.push({ pathname: '/task/[id]', params: { id: t.id } }), []);

  const value = useMemo(() => ({ toggle, openMenu: setMenuTask, openEdit, confirmDelete }), [toggle, openEdit, confirmDelete]);

  const close = () => setMenuTask(null);
  const t = menuTask;

  return (
    <TaskActionsContext.Provider value={value}>
      {children}
      <Sheet visible={!!t} onClose={close} title={t?.title}>
        {t && (
          <View>
            <Item
              icon={t.status === 'done' ? 'arrow-undo-outline' : 'checkmark-circle-outline'}
              label={t.status === 'done' ? 'إعادة إلى قائمة المهام' : 'تم الإنجاز'}
              color={colors.success}
              onPress={() => {
                close();
                toggle(t);
              }}
            />
            <Item
              icon="create-outline"
              label="تعديل المهمة"
              onPress={() => {
                close();
                openEdit(t);
              }}
            />
            {t.status === 'pending' && (
              <>
                <Text style={[styles.group, { color: colors.textMuted }]}>تأجيل / نقل إلى</Text>
                <View style={styles.postponeRow}>
                  {(Object.keys(POSTPONE_LABEL) as PostponePreset[]).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => {
                        close();
                        doPostpone(t, postponeTarget(p, today, t.dueDate));
                      }}
                      style={[styles.postpone, { backgroundColor: colors.surfaceAlt }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{POSTPONE_LABEL[p]}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatShortDate(postponeTarget(p, today, t.dueDate))}</Text>
                    </Pressable>
                  ))}
                </View>
                <Item
                  icon="calendar-outline"
                  label="اختيار يوم آخر…"
                  onPress={() => {
                    close();
                    setPickFor(t);
                  }}
                />
                {t.dueDate < today && (
                  <Item
                    icon="today-outline"
                    label="نقل إلى اليوم"
                    onPress={() => {
                      close();
                      doPostpone(t, today);
                    }}
                  />
                )}
              </>
            )}
            <Item
              icon="trash-outline"
              label="حذف"
              color={colors.danger}
              onPress={() => {
                close();
                confirmDelete(t);
              }}
            />
          </View>
        )}
      </Sheet>
      <DatePickerSheet
        visible={!!pickFor}
        value={pickFor?.dueDate && pickFor.dueDate >= today ? pickFor.dueDate : today}
        title="نقل المهمة إلى يوم"
        onClose={() => setPickFor(null)}
        onPick={(d) => pickFor && doPostpone(pickFor, d)}
      />
    </TaskActionsContext.Provider>
  );
}

function Item({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}>
      <Ionicons name={icon} size={22} color={color ?? colors.text} />
      <Text style={{ color: color ?? colors.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12 },
  group: { fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 8, paddingHorizontal: 8 },
  postponeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, marginBottom: 4 },
  postpone: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', minWidth: '22%', flexGrow: 1 },
});
