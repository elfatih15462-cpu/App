import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenTitle, SectionTitle, Segmented } from '../../components/ui';
import { addDays, AR_DAYS_SHORT, DateKey, endOfMonth, formatLongDate, formatMonthYear, formatShortDate, parseDateKey, startOfMonth, startOfWeek } from '../../domain/dates';
import { computeStats, streak } from '../../domain/rules';
import { useStore, useTheme } from '../../state/store';

type Range = 'day' | 'week' | 'month';

export default function StatsScreen() {
  const { tasks, today, now, categoryById } = useStore();
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>('week');
  const [picked, setPicked] = useState<DateKey | null>(null);

  const [from, to] = useMemo<[DateKey, DateKey]>(() => {
    if (range === 'day') return [today, today];
    if (range === 'week') {
      const s = startOfWeek(today);
      return [s, addDays(s, 6)];
    }
    return [startOfMonth(today), endOfMonth(today)];
  }, [range, today]);

  const s = useMemo(() => computeStats(tasks, from, to, now), [tasks, from, to, now]);
  const st = useMemo(() => streak(tasks, today), [tasks, today]);
  const totals = useMemo(() => {
    const live = tasks.filter((t) => !t.deletedAt);
    return {
      done: live.filter((t) => t.status === 'done').length,
      pending: live.filter((t) => t.status === 'pending').length,
      trash: tasks.length - live.length,
    };
  }, [tasks]);

  const rangeLabel =
    range === 'day' ? formatLongDate(today) : range === 'week' ? `${formatShortDate(from)} – ${formatShortDate(to)}` : formatMonthYear(today);
  const maxDay = Math.max(1, ...s.byDay.map((d) => Math.max(d.planned, d.completed)));
  const pickedDay = s.byDay.find((d) => d.date === picked);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="الإحصائيات" subtitle={rangeLabel} />
        <Segmented
          value={range}
          onChange={(r) => {
            setRange(r);
            setPicked(null);
          }}
          options={[
            { value: 'day', label: 'يومي' },
            { value: 'week', label: 'أسبوعي' },
            { value: 'month', label: 'شهري' },
          ]}
        />

        <Card style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontWeight: '600' }}>نسبة إنجاز المهام المخططة</Text>
          <Text style={{ color: colors.text, fontSize: 48, fontWeight: '800' }}>{s.percent}%</Text>
          <Text style={{ color: colors.textMuted }}>
            {s.completedOfPlanned} من {s.planned} مهمة
          </Text>
          <View style={[styles.bar, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.barFill, { width: `${s.percent}%`, backgroundColor: colors.primary }]} />
          </View>
        </Card>

        <View style={styles.grid}>
          <Tile label="مخططة" value={s.planned} />
          <Tile label="أُنجزت في الفترة" value={s.completed} />
          <Tile label="متأخرة" value={s.overdue} warn={s.overdue > 0} />
          <Tile label="إنجاز في الموعد" value={`${s.onTimeRate}%`} />
          <Tile label="أيام متتالية مكتملة" value={`${st} 🔥`} />
          <Tile label="إجمالي المؤرشف" value={totals.done} />
        </View>

        {range !== 'day' && s.byDay.length > 0 && (
          <>
            <SectionTitle title="الإنجاز اليومي" color={colors.text} />
            <Card>
              <View style={styles.legendRow}>
                <LegendKey color={colors.primary} label="منجزة" />
                <LegendKey color={colors.surfaceAlt} label="مخططة" border={colors.border} />
              </View>
              <View style={styles.chart}>
                {s.byDay.map((d) => {
                  const hPlanned = (Math.max(d.planned, d.completed) / maxDay) * 100;
                  const hDone = (d.completed / maxDay) * 100;
                  const active = picked === d.date;
                  return (
                    <Pressable
                      key={d.date}
                      onPress={() => setPicked(active ? null : d.date)}
                      style={styles.col}
                      accessibilityLabel={`${formatShortDate(d.date)}: ${d.completed} منجزة من ${d.planned} مخططة`}
                    >
                      <View style={styles.colTrack}>
                        <View style={[styles.colPlanned, { height: `${hPlanned}%`, backgroundColor: colors.surfaceAlt, borderColor: active ? colors.text : colors.border }]}>
                          <View style={[styles.colDone, { height: hPlanned ? `${(hDone / hPlanned) * 100}%` : 0, backgroundColor: colors.primary }]} />
                        </View>
                      </View>
                      {range === 'week' ? (
                        <Text style={[styles.colLabel, { color: d.date === today ? colors.primary : colors.textMuted }]}>
                          {AR_DAYS_SHORT[parseDateKey(d.date).getDay()]}
                        </Text>
                      ) : (
                        <Text style={[styles.colLabel, { color: d.date === today ? colors.primary : colors.textMuted }]}>
                          {Number(d.date.slice(8)) % 5 === 1 || d.date === today ? Number(d.date.slice(8)) : ''}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colors.text, textAlign: 'center', marginTop: 10, minHeight: 20 }}>
                {pickedDay
                  ? `${formatLongDate(pickedDay.date)}: ${pickedDay.completed} منجزة • ${pickedDay.planned} مخططة`
                  : 'اضغط على أي عمود لعرض التفاصيل'}
              </Text>
            </Card>
          </>
        )}

        <SectionTitle title="حسب التصنيف" color={colors.text} />
        <Card>
          {s.byCategory.length === 0 && <Text style={{ color: colors.textMuted, textAlign: 'center' }}>لا توجد مهام في هذه الفترة</Text>}
          {s.byCategory.map((c) => {
            const cat = categoryById(c.categoryId);
            const pct = c.planned ? Math.round((c.completed / c.planned) * 100) : 0;
            return (
              <View key={c.categoryId ?? 'none'} style={{ marginBottom: 12 }}>
                <View style={styles.catRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat?.color ?? colors.textMuted }} />
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{cat?.name ?? 'بدون تصنيف'}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted }}>
                    {c.completed}/{c.planned} • {pct}%
                  </Text>
                </View>
                <View style={[styles.bar, { backgroundColor: colors.surfaceAlt, marginTop: 6 }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: cat?.color ?? colors.textMuted }]} />
                </View>
              </View>
            );
          })}
        </Card>
        <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 14 }}>
          المهام النشطة: {totals.pending} • في سلة المحذوفات: {totals.trash}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: warn ? colors.danger : colors.border }]}>
      <Text style={{ color: warn ? colors.danger : colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function LegendKey({ color, label, border }: { color: string; label: string; border?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, borderWidth: border ? 1 : 0, borderColor: border }} />
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tile: { flexGrow: 1, flexBasis: '30%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, gap: 4 },
  legendRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 10 },
  chart: { flexDirection: 'row', height: 150, alignItems: 'flex-end', gap: 2 },
  col: { flex: 1, height: '100%', alignItems: 'center' },
  colTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  colPlanned: { width: '70%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4, justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1, borderBottomWidth: 0, minHeight: 2 },
  colDone: { width: '100%' },
  colLabel: { fontSize: 10, marginTop: 4, height: 14 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
