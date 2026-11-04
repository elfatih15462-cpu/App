import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeISO, formatShortDate, formatTime, relativeDayLabel } from '../domain/dates';
import { isOverdue } from '../domain/rules';
import { PRIORITY_LABEL, RECURRENCE_LABEL, Task } from '../domain/types';
import { useStore, useTheme } from '../state/store';
import { useTaskActions } from './TaskActions';

interface Props {
  task: Task;
  /** Show the date (used outside of the Today screen). */
  showDate?: boolean;
  /** Show the "carried over from ..." badge for tasks from previous days. */
  showCarry?: boolean;
}

function TaskItemInner({ task, showDate, showCarry }: Props) {
  const { colors, priority } = useTheme();
  const { categoryById, today, now } = useStore();
  const { toggle, openMenu, openEdit } = useTaskActions();
  const done = task.status === 'done';
  const overdue = isOverdue(task, now);
  const cat = categoryById(task.categoryId);
  const pColor = priority[task.priority];

  return (
    <Pressable
      onPress={() => openEdit(task)}
      onLongPress={() => openMenu(task)}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: overdue ? colors.dangerSoft : colors.surface,
          borderColor: overdue ? colors.danger + '55' : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.priorityBar, { backgroundColor: pColor }]} />
      <Pressable
        onPress={() => toggle(task)}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `إلغاء إنجاز ${task.title}` : `إنجاز ${task.title}`}
        style={[
          styles.check,
          { borderColor: done ? colors.success : overdue ? colors.danger : colors.textMuted },
          done && { backgroundColor: colors.success },
        ]}
      >
        {done && <Ionicons name="checkmark" size={18} color="#fff" />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.title, { color: done ? colors.textMuted : colors.text }, done && styles.strike]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {!!task.description && (
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {task.description}
          </Text>
        )}
        <View style={styles.meta}>
          {showDate && !done && (
            <Meta icon="calendar-outline" color={overdue ? colors.danger : colors.textMuted} text={relativeDayLabel(task.dueDate, today)} />
          )}
          {!!task.dueTime && <Meta icon="time-outline" color={overdue ? colors.danger : colors.textMuted} text={formatTime(task.dueTime)} />}
          {cat && (
            <View style={[styles.cat, { backgroundColor: cat.color + '22' }]}>
              <Text style={{ color: cat.color, fontSize: 12, fontWeight: '700' }}>{cat.name}</Text>
            </View>
          )}
          {task.priority === 'high' && !done && <Meta icon="flag" color={pColor} text={PRIORITY_LABEL.high} />}
          {task.recurrence !== 'none' && <Meta icon="repeat" color={colors.textMuted} text={RECURRENCE_LABEL[task.recurrence]} />}
          {task.reminders.length > 0 && !done && <Ionicons name="notifications-outline" size={13} color={colors.textMuted} />}
          {done && task.completedAt && (
            <Meta icon="checkmark-done" color={colors.success} text={`أُنجزت ${formatDateTimeISO(task.completedAt)}`} />
          )}
        </View>
        {showCarry && overdue && task.dueDate < today && (
          <View style={[styles.carry, { backgroundColor: colors.danger + '1A' }]}>
            <Ionicons name="alert-circle" size={13} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>
              متأخرة • تاريخها الأصلي {formatShortDate(task.dueDate)} ({relativeDayLabel(task.dueDate, today)})
            </Text>
          </View>
        )}
        {task.postponeCount > 0 && !done && (
          <Text style={{ color: colors.warning, fontSize: 11, marginTop: 4 }}>
            مؤجلة {task.postponeCount} {task.postponeCount === 1 ? 'مرة' : 'مرات'} • مخططة أصلاً {formatShortDate(task.originalDate)}
          </Text>
        )}
      </View>
      <Pressable onPress={() => openMenu(task)} hitSlop={10} accessibilityLabel="خيارات المهمة" style={styles.more}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function Meta({ icon, text, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export const TaskItem = memo(TaskItemInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    overflow: 'hidden',
  },
  priorityBar: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 4 },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 23 },
  strike: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cat: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  carry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  more: { padding: 2, marginTop: 2 },
});
