import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '../../components/Fab';
import { TaskItem } from '../../components/TaskItem';
import { EmptyState, ScreenTitle, SectionTitle, Segmented } from '../../components/ui';
import { addDays, DateKey, formatLongDate, formatMonthYear, formatShortDate, relativeDayLabel } from '../../domain/dates';
import { GroupMode, groupTasks, sortTasks } from '../../domain/rules';
import { useStore, useTheme } from '../../state/store';

export default function UpcomingScreen() {
  const { tasks, today } = useStore();
  const { colors } = useTheme();
  const [mode, setMode] = useState<GroupMode>('day');

  const { future, overdue } = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending' && !t.deletedAt);
    return {
      future: pending.filter((t) => t.dueDate > today),
      overdue: sortTasks(pending.filter((t) => t.dueDate < today)),
    };
  }, [tasks, today]);
  const groups = useMemo(() => groupTasks(future, mode), [future, mode]);

  const label = (key: DateKey) => {
    if (mode === 'day') return `${relativeDayLabel(key, today)} — ${formatLongDate(key)}`;
    if (mode === 'week') return `أسبوع ${formatShortDate(key)} – ${formatShortDate(addDays(key, 6))}`;
    return formatMonthYear(key);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="المهام القادمة" subtitle={`${future.length} مهمة مجدولة`} />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'day', label: 'حسب اليوم' },
            { value: 'week', label: 'حسب الأسبوع' },
            { value: 'month', label: 'حسب الشهر' },
          ]}
        />
        {overdue.length > 0 && (
          <>
            <SectionTitle title="متأخرة (لم تُنجز في موعدها)" count={overdue.length} color={colors.danger} />
            {overdue.map((t) => (
              <TaskItem key={t.id} task={t} showDate showCarry />
            ))}
          </>
        )}
        {groups.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title="لا توجد مهام قادمة" subtitle="أضف مهمة واختر لها تاريخاً مستقبلياً لتظهر هنا." />
        ) : (
          groups.map((g) => (
            <View key={g.key}>
              <SectionTitle title={label(g.key)} count={g.tasks.length} color={colors.text} />
              {g.tasks.map((t) => (
                <TaskItem key={t.id} task={t} showDate={mode !== 'day'} />
              ))}
            </View>
          ))
        )}
        <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 12 }}>
          اضغط مطولاً على أي مهمة لتأجيلها أو نقلها إلى يوم آخر
        </Text>
      </ScrollView>
      <Fab date={addDays(today, 1)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
