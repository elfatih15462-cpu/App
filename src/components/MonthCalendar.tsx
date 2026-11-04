import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, AR_DAYS_SHORT, addMonths, DateKey, endOfMonth, formatMonthYear, startOfMonth, startOfWeek } from '../domain/dates';
import { useTheme } from '../state/store';

export interface DayMarks {
  pending?: number;
  done?: number;
  overdue?: number;
  projected?: number;
}

interface Props {
  month: DateKey; // any day inside the visible month
  selected?: DateKey | null;
  today: DateKey;
  minDate?: DateKey;
  marks?: Record<DateKey, DayMarks>;
  onSelect: (d: DateKey) => void;
  onMonthChange: (m: DateKey) => void;
}

const isRTL = I18nManager.isRTL || Platform.OS === 'web';

/** Month grid; weeks start on Saturday and flow right-to-left in Arabic. */
export function MonthCalendar({ month, selected, today, minDate, marks, onSelect, onMonthChange }: Props) {
  const { colors } = useTheme();
  const weeks = useMemo(() => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    let cursor = startOfWeek(first);
    const rows: DateKey[][] = [];
    while (cursor <= last) {
      const row: DateKey[] = [];
      for (let i = 0; i < 7; i++) row.push(addDays(cursor, i));
      rows.push(row);
      cursor = addDays(cursor, 7);
    }
    return rows;
  }, [month]);
  const monthPrefix = month.slice(0, 7);
  const headers = [6, 0, 1, 2, 3, 4, 5].map((d) => AR_DAYS_SHORT[d]);

  return (
    <View>
      <View style={styles.header}>
        <Pressable accessibilityLabel="الشهر السابق" hitSlop={10} onPress={() => onMonthChange(addMonths(startOfMonth(month), -1))} style={styles.nav}>
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => onMonthChange(today)}>
          <Text style={[styles.month, { color: colors.text }]}>{formatMonthYear(month)}</Text>
        </Pressable>
        <Pressable accessibilityLabel="الشهر التالي" hitSlop={10} onPress={() => onMonthChange(addMonths(startOfMonth(month), 1))} style={styles.nav}>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {headers.map((h) => (
          <Text key={h} style={[styles.weekday, { color: colors.textMuted }]}>
            {h}
          </Text>
        ))}
      </View>
      {weeks.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((d) => {
            const inMonth = d.startsWith(monthPrefix);
            const isSel = d === selected;
            const isToday = d === today;
            const disabled = !!minDate && d < minDate;
            const m = marks?.[d];
            return (
              <Pressable
                key={d}
                disabled={disabled}
                onPress={() => onSelect(d)}
                accessibilityLabel={d}
                style={[
                  styles.cell,
                  isSel && { backgroundColor: colors.primary },
                  !isSel && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isToday || isSel ? '800' : '500',
                    color: isSel ? colors.onPrimary : disabled ? colors.border : inMonth ? colors.text : colors.textMuted,
                    opacity: inMonth ? 1 : 0.45,
                  }}
                >
                  {Number(d.slice(8))}
                </Text>
                <View style={styles.dots}>
                  {!!m?.overdue && <View style={[styles.dot, { backgroundColor: isSel ? colors.onPrimary : colors.danger }]} />}
                  {!!m?.pending && <View style={[styles.dot, { backgroundColor: isSel ? colors.onPrimary : colors.primary }]} />}
                  {!!m?.projected && !m?.pending && (
                    <View style={[styles.dot, { borderWidth: 1, borderColor: isSel ? colors.onPrimary : colors.primary }]} />
                  )}
                  {!!m?.done && <View style={[styles.dot, { backgroundColor: isSel ? colors.onPrimary : colors.success }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { padding: 6 },
  month: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingVertical: 6 },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, margin: 1 },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
