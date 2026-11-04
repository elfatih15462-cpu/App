import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTaskActions } from '../../components/TaskActions';
import { TaskForm } from '../../components/TaskForm';
import { useToast } from '../../components/Toast';
import { Button, Card, EmptyState } from '../../components/ui';
import { formatDateTimeISO, formatShortDate } from '../../domain/dates';
import { HistoryAction, HistoryEntry } from '../../domain/types';
import { useStore, useTheme } from '../../state/store';

const ACTION_LABEL: Record<HistoryAction, string> = {
  created: 'أُنشئت',
  updated: 'عُدّلت',
  completed: 'أُنجزت',
  reopened: 'أُعيدت إلى القائمة',
  postponed: 'أُجّلت',
  deleted: 'حُذفت (إلى السلة)',
  recovered: 'استُعيدت من السلة',
  recurred: 'أُنشئت تلقائياً (تكرار)',
};

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, updateTask, repo, recoverTask } = useStore();
  const { toggle, confirmDelete } = useTaskActions();
  const { colors } = useTheme();
  const toast = useToast();
  const task = tasks.find((t) => t.id === id);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (repo && id) repo.history(id).then(setHistory);
  }, [repo, id, task?.updatedAt]);

  if (!task) return <EmptyState icon="alert-circle-outline" title="المهمة غير موجودة" />;

  const done = task.status === 'done';
  return (
    <>
      <Stack.Screen options={{ title: done ? 'مهمة منجزة' : task.deletedAt ? 'مهمة محذوفة' : 'تعديل المهمة' }} />
      <TaskForm
        key={task.id}
        initial={task}
        defaultDate={task.dueDate}
        submitLabel="حفظ التعديلات"
        onSubmit={async (input) => {
          await updateTask(task.id, input);
          toast('حُفظت التعديلات ✓');
          router.back();
        }}
        footer={
          <View style={{ gap: 10, marginTop: 10 }}>
            {task.deletedAt ? (
              <Button title="استعادة من سلة المحذوفات" icon="refresh" variant="secondary" onPress={() => recoverTask(task.id)} />
            ) : (
              <>
                <Button
                  title={done ? 'إعادة إلى قائمة المهام' : 'تم الإنجاز ✓'}
                  icon={done ? 'arrow-undo' : 'checkmark-done'}
                  variant="secondary"
                  onPress={() => {
                    toggle(task);
                    if (!done) router.back();
                  }}
                />
                <Button title="حذف المهمة" icon="trash-outline" variant="danger" onPress={() => confirmDelete(task, () => router.back())} />
              </>
            )}
            <Card style={{ marginTop: 10 }}>
              <Text style={[styles.h, { color: colors.text }]}>معلومات</Text>
              <Info label="التاريخ الأصلي" value={formatShortDate(task.originalDate)} />
              <Info label="مرات التأجيل" value={String(task.postponeCount)} />
              <Info label="أُنشئت" value={formatDateTimeISO(task.createdAt)} />
              {task.completedAt && <Info label="أُنجزت" value={formatDateTimeISO(task.completedAt)} />}
            </Card>
            <Card>
              <Text style={[styles.h, { color: colors.text }]}>سجل التعديلات</Text>
              {history.map((h) => (
                <View key={h.id} style={[styles.hist, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{ACTION_LABEL[h.action] ?? h.action}</Text>
                  {!!h.details && <Text style={{ color: colors.textMuted, fontSize: 13 }}>{h.details}</Text>}
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDateTimeISO(h.at)}</Text>
                </View>
              ))}
            </Card>
          </View>
        }
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.info}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  info: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  hist: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
});
