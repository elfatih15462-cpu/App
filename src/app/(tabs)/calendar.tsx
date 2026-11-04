import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '../../components/Fab';
import { DayMarks, MonthCalendar } from '../../components/MonthCalendar';
import { QuickAdd } from '../../components/QuickAdd';
import { TaskItem } from '../../components/TaskItem';
import { Card, EmptyState, ScreenTitle, SectionTitle } from '../../components/ui';
import { addDays, DateKey, endOfMonth, formatLongDate, startOfMonth, startOfWeek, toDateKey } from '../../domain/dates';
import { isOverdue, projectOccurrences, sortTasks } from '../../domain/rules';
import { RECURRENCE_LABEL, Task } from '../../domain/types';
import { useStore, useTheme } from '../../state/store';

export default function CalendarScreen() {
  const { tasks, today, now } = useStore();
  const { colors } = useTheme();
  const [month, setMonth] = useState(today);
  const [selected, setSelected] = useState<DateKey>(today);

  const { marks, projected } = useMemo(() => {
    const from = startOfWeek(startOfMonth(month));
    const to = addDays(endOfMonth(month), 7);
    const m: Record<DateKey, DayMarks> = {};
    const proj: Record<DateKey, Task[]> = {};
    const bump = (d: DateKey, k: keyof DayMarks) => {
      m[d] = m[d] ?? {};
      m[d][k] = (m[d][k] ?? 0) + 1;
    };
    for (const t of tasks) {
      if (t.deletedAt) continue;
      if (t.status === 'done') {
        if (t.completedAt) bump(toDateKey(new Date(t.completedAt)), 'done');
        continue;
      }
      bump(t.dueDate, isOverdue(t, now) ? 'overdue' : 'pending');
      for (const d of projectOccurrences(t, from, to)) {
        bump(d, 'projected');
        (proj[d] = proj[d] ?? []).push(t);
      }
    }
    return { marks: m, projected: proj };
  }, [tasks, month, now]);

  const dayTasks = useMemo(() => {
    const live = tasks.filter((t) => !t.deletedAt);
    return {
      pending: sortTasks(live.filter((t) => t.status === 'pending' && t.dueDate === selected)),
      done: live.filter((t) => t.status === 'done' && t.completedAt && toDateKey(new Date(t.completedAt)) === selected),
    };
  }, [tasks, selected]);
  const proj = projected[selected] ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title="التقويم" />
        <Card>
          <MonthCalendar
            month={month}
            selected={selected}
            today={today}
            marks={marks}
            onSelect={(d) => {
              setSelected(d);
              if (d.slice(0, 7) !== month.slice(0, 7)) setMonth(d);
            }}
            onMonthChange={setMonth}
          />
          <View style={styles.legend}>
            <Legend color={colors.primary} label="مجدولة" />
            <Legend color={colors.danger} label="متأخرة" />
            <Legend color={colors.success} label="منجزة" />
            <Legend color={colors.primary} label="تكرار متوقع" hollow />
          </View>
        </Card>

        <SectionTitle title={formatLongDate(selected)} color={colors.text} />
        <QuickAdd date={selected} placeholder="أضف مهمة لهذا اليوم…" />
        <View style={{ height: 10 }} />
        {dayTasks.pending.map((t) => (
          <TaskItem key={t.id} task={t} showCarry />
        ))}
        {proj.map((t) => (
          <View key={t.id} style={[styles.proj, { borderColor: colors.border }]}>
            <Ionicons name="repeat" size={18} color={colors.primary} />
            <Text style={{ color: colors.text, flex: 1 }}>{t.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>تتكرر {RECURRENCE_LABEL[t.recurrence]}</Text>
          </View>
        ))}
        {dayTasks.done.length > 0 && (
          <>
            <SectionTitle title="أُنجزت في هذا اليوم" count={dayTasks.done.length} color={colors.success} />
            {dayTasks.done.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </>
        )}
        {dayTasks.pending.length + dayTasks.done.length + proj.length === 0 && (
          <EmptyState icon="calendar-outline" title="لا مهام في هذا اليوم" subtitle="اكتب مهمة في الحقل أعلاه لجدولتها لهذا التاريخ." />
        )}
      </ScrollView>
      <Fab date={selected} />
    </SafeAreaView>
  );
}

function Legend({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={[{ width: 8, height: 8, borderRadius: 4 }, hollow ? { borderWidth: 1, borderColor: color } : { backgroundColor: color }]} />
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, maxWidth: 720, width: '100%', alignSelf: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 10 },
  proj: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginBottom: 8 },
});
