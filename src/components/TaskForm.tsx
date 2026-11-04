import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, DateKey, formatLongDate, relativeDayLabel } from '../domain/dates';
import { Priority, PRIORITY_LABEL, Recurrence, RECURRENCE_LABEL, REMINDER_OPTIONS, Task, TaskInput } from '../domain/types';
import { useStore, useTheme } from '../state/store';
import { DatePickerSheet } from './DatePickerSheet';
import { TimeField } from './TimeField';
import { Button, Chip } from './ui';

export function TaskForm({
  initial,
  defaultDate,
  onSubmit,
  submitLabel,
  footer,
}: {
  initial?: Task;
  defaultDate: DateKey;
  onSubmit: (input: TaskInput) => Promise<void>;
  submitLabel: string;
  footer?: React.ReactNode;
}) {
  const { categories, today, settings } = useStore();
  const { colors, priority: pColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState<DateKey>(initial?.dueDate ?? defaultDate);
  const [dueTime, setDueTime] = useState<string | null>(initial?.dueTime ?? null);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'none');
  const [reminders, setReminders] = useState<number[]>(initial?.reminders ?? settings.defaultReminders);
  const [pickDate, setPickDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      setError('اكتب عنوان المهمة');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title, description, dueDate, dueTime, priority, categoryId, recurrence, reminders });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
      setSaving(false);
    }
  };

  const toggleReminder = (m: number) =>
    setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m].sort((a, b) => a - b)));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(null);
          }}
          placeholder="عنوان المهمة"
          placeholderTextColor={colors.textMuted}
          autoFocus={!initial}
          style={[styles.title, { color: colors.text, borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface }]}
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel="عنوان المهمة"
        />
        {error && <Text style={{ color: colors.danger, marginTop: 6 }}>{error}</Text>}
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="وصف تفصيلي (اختياري)"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.desc, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityLabel="وصف المهمة"
        />

        <Label text="تاريخ التنفيذ" />
        <View style={styles.row}>
          <Chip label="اليوم" selected={dueDate === today} onPress={() => setDueDate(today)} />
          <Chip label="غداً" selected={dueDate === addDays(today, 1)} onPress={() => setDueDate(addDays(today, 1))} />
          <Chip
            icon="calendar-outline"
            label={dueDate !== today && dueDate !== addDays(today, 1) ? `${relativeDayLabel(dueDate, today)}` : 'تاريخ آخر…'}
            selected={dueDate !== today && dueDate !== addDays(today, 1)}
            onPress={() => setPickDate(true)}
          />
        </View>
        <Text style={{ color: dueDate < today ? colors.danger : colors.textMuted, marginTop: 6, fontSize: 13 }}>
          {formatLongDate(dueDate)}
          {dueDate < today ? ' (تاريخ سابق — ستظهر كمتأخرة)' : ''}
        </Text>

        <Label text="وقت التنفيذ (اختياري)" />
        <TimeField value={dueTime} onChange={setDueTime} />

        <Label text="الأولوية" />
        <View style={styles.row}>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => (
            <Chip key={p} label={PRIORITY_LABEL[p]} color={pColors[p]} selected={priority === p} onPress={() => setPriority(p)} />
          ))}
        </View>

        <Label text="التصنيف" />
        <View style={styles.row}>
          <Chip label="بدون" selected={!categoryId} onPress={() => setCategoryId(null)} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>

        <Label text="التكرار" />
        <View style={styles.row}>
          {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
            <Chip key={r} label={RECURRENCE_LABEL[r]} icon={r === 'none' ? undefined : 'repeat'} selected={recurrence === r} onPress={() => setRecurrence(r)} />
          ))}
        </View>
        {recurrence !== 'none' && (
          <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
            عند إنجاز المهمة تُنشأ المهمة التالية تلقائياً في موعدها القادم.
          </Text>
        )}

        <Label text="التذكيرات (يمكن اختيار أكثر من تذكير)" />
        <View style={styles.row}>
          {REMINDER_OPTIONS.map((o) => (
            <Chip key={o.minutes} label={o.label} icon="notifications-outline" selected={reminders.includes(o.minutes)} onPress={() => toggleReminder(o.minutes)} />
          ))}
        </View>
        {!dueTime && reminders.length > 0 && (
          <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
            لا يوجد وقت محدد، سيُحسب التذكير على الساعة {settings.defaultTime} (من الإعدادات).
          </Text>
        )}
        {!settings.notificationsEnabled && (
          <Pressable style={[styles.warn, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="notifications-off-outline" size={16} color={colors.warning} />
            <Text style={{ color: colors.warning, flex: 1 }}>التنبيهات متوقفة من الإعدادات.</Text>
          </Pressable>
        )}

        <Button title={submitLabel} icon="checkmark" onPress={save} disabled={saving} style={{ marginTop: 24 }} />
        {footer}
      </ScrollView>
      <DatePickerSheet visible={pickDate} value={dueDate} onClose={() => setPickDate(false)} onPick={setDueDate} />
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 18, fontWeight: '600', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  desc: { fontSize: 15, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, marginTop: 10, textAlignVertical: 'top' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warn: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, marginTop: 10 },
});
