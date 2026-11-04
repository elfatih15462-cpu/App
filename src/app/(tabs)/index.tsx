import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '../../components/Fab';
import { QuickAdd } from '../../components/QuickAdd';
import { TaskItem } from '../../components/TaskItem';
import { Card, EmptyState, IconButton, SectionTitle } from '../../components/ui';
import { formatLongDate } from '../../domain/dates';
import { buildTodayView } from '../../domain/rules';
import { useStore, useTheme } from '../../state/store';

function greeting(h: number) {
  if (h < 12) return 'صباح الخير ☀️';
  if (h < 18) return 'مساء الخير 🌤️';
  return 'مساء الخير 🌙';
}

export default function TodayScreen() {
  const { tasks, today, settings, now } = useStore();
  const { colors } = useTheme();
  const [showDone, setShowDone] = useState(false);
  const v = useMemo(() => buildTodayView(tasks, today, settings.carryOver), [tasks, today, settings.carryOver]);
  const progressColor = v.percent === 100 ? colors.success : colors.primary;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>{greeting(now.getHours())}</Text>
            <Text style={[styles.date, { color: colors.text }]}>{formatLongDate(today)}</Text>
          </View>
          <IconButton icon="trash-outline" label="سلة المحذوفات" onPress={() => router.push('/trash')} />
          <IconButton icon="settings-outline" label="الإعدادات" onPress={() => router.push('/settings')} />
        </View>

        <Card style={styles.summary}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>نسبة الإنجاز اليوم</Text>
              <Text style={[styles.percent, { color: progressColor }]}>{v.percent}%</Text>
            </View>
            {v.percent === 100 && v.total > 0 && <Text style={{ fontSize: 34 }}>🎉</Text>}
          </View>
          <View style={[styles.bar, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.barFill, { width: `${v.percent}%`, backgroundColor: progressColor }]} />
          </View>
          <View style={styles.counters}>
            <Counter label="المطلوبة" value={v.total} color={colors.primary} />
            <Counter label="المنجزة" value={v.doneCount} color={colors.success} />
            <Counter label="المتبقية" value={v.remaining} color={v.carried.length ? colors.danger : colors.warning} />
          </View>
        </Card>

        <QuickAdd date={today} />

        {v.carried.length > 0 && (
          <>
            <SectionTitle title="⚠️ مرحّلة من أيام سابقة" count={v.carried.length} color={colors.danger} />
            {v.carried.map((t) => (
              <TaskItem key={t.id} task={t} showCarry />
            ))}
          </>
        )}

        <SectionTitle title="مهام اليوم" count={v.pending.length} />
        {v.pending.length === 0 ? (
          v.total > 0 && v.remaining === 0 ? (
            <EmptyState icon="trophy-outline" title="أحسنت! أنجزت كل مهام اليوم" subtitle="يمكنك مراجعة ما أنجزته في الأرشيف أو التخطيط للأيام القادمة." />
          ) : (
            <EmptyState
              icon="sunny-outline"
              title={v.carried.length ? 'لا مهام جديدة لليوم' : 'لا توجد مهام لليوم'}
              subtitle="اكتب عنوان المهمة في الحقل أعلاه واضغط إدخال، أو اضغط زر + لإضافة التفاصيل."
            />
          )
        ) : (
          v.pending.map((t) => <TaskItem key={t.id} task={t} />)
        )}

        {v.done.length > 0 && (
          <>
            <Pressable onPress={() => setShowDone((s) => !s)}>
              <SectionTitle
                title="✓ أُنجزت اليوم (في الأرشيف)"
                count={v.done.length}
                color={colors.success}
                right={<Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={18} color={colors.success} />}
              />
            </Pressable>
            {showDone && v.done.map((t) => <TaskItem key={t.id} task={t} />)}
          </>
        )}
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          اضغط على المربع لإنجاز المهمة • اضغط مطولاً للتأجيل أو النقل أو الحذف
        </Text>
      </ScrollView>
      <Fab date={today} />
    </SafeAreaView>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.counter, { backgroundColor: color + '14' }]}>
      <Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 110, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  date: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  summary: { marginBottom: 14 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  percent: { fontSize: 36, fontWeight: '800' },
  bar: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', borderRadius: 5 },
  counters: { flexDirection: 'row', gap: 8, marginTop: 14 },
  counter: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, gap: 2 },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
