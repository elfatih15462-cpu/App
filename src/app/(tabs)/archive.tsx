import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskItem } from '../../components/TaskItem';
import { Chip, EmptyState, ScreenTitle } from '../../components/ui';
import { formatLongDate, toDateKey } from '../../domain/dates';
import { Task } from '../../domain/types';
import { useStore, useTheme } from '../../state/store';

type Row = { type: 'header'; key: string; label: string; count: number } | { type: 'task'; key: string; task: Task };

/** Arabic-insensitive normalisation so "احمد" matches "أحمد" and "مهمه" matches "مهمة". */
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

export default function ArchiveScreen() {
  const { tasks, categories } = useStore();
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);

  const done = useMemo(() => tasks.filter((t) => t.status === 'done' && !t.deletedAt), [tasks]);
  const rows = useMemo(() => {
    const nq = normalize(q.trim());
    const list = done
      .filter((t) => (cat ? t.categoryId === cat : true))
      .filter((t) => !nq || normalize(`${t.title} ${t.description}`).includes(nq))
      .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
    const out: Row[] = [];
    let current = '';
    for (const t of list) {
      const day = toDateKey(new Date(t.completedAt!));
      if (day !== current) {
        current = day;
        out.push({ type: 'header', key: 'h' + day, label: formatLongDate(day), count: list.filter((x) => toDateKey(new Date(x.completedAt!)) === day).length });
      }
      out.push({ type: 'task', key: t.id, task: t });
    }
    return { out, count: list.length };
  }, [done, q, cat]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows.out}
        keyExtractor={(r) => r.key}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <ScreenTitle title="الأرشيف" subtitle={`${done.length} مهمة منجزة`} />
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="ابحث في المهام المنجزة…"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel="بحث في الأرشيف"
              />
              {!!q && <Ionicons name="close-circle" size={18} color={colors.textMuted} onPress={() => setQ('')} />}
            </View>
            <View style={styles.chips}>
              <Chip label="الكل" selected={!cat} onPress={() => setCat(null)} />
              {categories.map((c) => (
                <Chip key={c.id} label={c.name} color={c.color} selected={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
              ))}
            </View>
            {rows.count > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
                لاستعادة مهمة إلى قائمة المهام: اضغط على علامة ✓ أو اضغط مطولاً واختر «إعادة إلى قائمة المهام»
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <Text style={[styles.header, { color: colors.textMuted }]}>
              {item.label} ({item.count})
            </Text>
          ) : (
            <TaskItem task={item.task} />
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon="archive-outline"
            title={q || cat ? 'لا توجد نتائج' : 'الأرشيف فارغ'}
            subtitle={q || cat ? 'جرّب كلمات بحث أخرى أو تصنيفاً مختلفاً.' : 'عند إنجاز أي مهمة تنتقل إلى هنا تلقائياً مع تاريخ ووقت إنجازها.'}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  header: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 8 },
});
