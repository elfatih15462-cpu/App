import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { DateKey } from '../domain/dates';
import { Priority } from '../domain/types';
import { useStore, useTheme } from '../state/store';
import { useToast } from './Toast';

/** One-line task entry: type a title and press enter. The fastest way to add a task. */
export function QuickAdd({ date, placeholder = 'أضف مهمة سريعة… ثم اضغط إدخال' }: { date: DateKey; placeholder?: string }) {
  const { createTask, settings } = useStore();
  const { colors, priority: pColors } = useTheme();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [urgent, setUrgent] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      router.push({ pathname: '/task/new', params: { date } });
      return;
    }
    const priority: Priority = urgent ? 'high' : 'medium';
    try {
      await createTask({ title: t, dueDate: date, priority, reminders: settings.defaultReminders });
      setTitle('');
      setUrgent(false);
      toast('أُضيفت المهمة ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّرت الإضافة');
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        onPress={() => setUrgent((u) => !u)}
        hitSlop={8}
        accessibilityLabel={urgent ? 'أولوية عاجلة (اضغط للإلغاء)' : 'تحديد كعاجلة'}
        style={styles.flag}
      >
        <Ionicons name={urgent ? 'flag' : 'flag-outline'} size={20} color={urgent ? pColors.high : colors.textMuted} />
      </Pressable>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={submit}
        submitBehavior="submit"
        returnKeyType="done"
        style={[styles.input, { color: colors.text }]}
        accessibilityLabel="عنوان مهمة جديدة"
      />
      <Pressable
        onPress={submit}
        accessibilityLabel={title.trim() ? 'إضافة المهمة' : 'فتح نموذج مهمة جديدة'}
        style={[styles.add, { backgroundColor: colors.primary }]}
      >
        <Ionicons name={title.trim() ? 'arrow-up' : 'add'} size={22} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingStart: 8,
    paddingEnd: 6,
    paddingVertical: 6,
    gap: 6,
  },
  flag: { padding: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8, minHeight: 40 },
  add: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
