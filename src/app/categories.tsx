import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { confirmAsync } from '../components/TaskActions';
import { useToast } from '../components/Toast';
import { Button, Card } from '../components/ui';
import { Category } from '../domain/types';
import { useStore, useTheme } from '../state/store';
import { CATEGORY_COLORS } from '../theme/colors';

export default function CategoriesScreen() {
  const { categories, saveCategory, deleteCategory, tasks } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const save = async () => {
    if (!editing) return;
    try {
      await saveCategory({ id: editing.id, name: editing.name ?? '', color: editing.color ?? CATEGORY_COLORS[0], icon: editing.icon });
      setEditing(null);
      toast('حُفظ التصنيف ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'حدث خطأ');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        {categories.map((c) => {
          const count = tasks.filter((t) => t.categoryId === c.id && !t.deletedAt && t.status === 'pending').length;
          return (
            <Pressable key={c.id} onPress={() => setEditing(c)} style={[styles.row, { borderColor: colors.border }]}>
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <Text style={{ color: colors.text, fontSize: 16, flex: 1, fontWeight: '600' }}>{c.name}</Text>
              <Text style={{ color: colors.textMuted }}>{count} نشطة</Text>
              <Pressable
                hitSlop={10}
                accessibilityLabel={`حذف ${c.name}`}
                onPress={async () => {
                  const ok = await confirmAsync('حذف التصنيف', `سيُخفى تصنيف "${c.name}". المهام المرتبطة به تبقى كما هي.`, 'حذف', true);
                  if (ok) await deleteCategory(c.id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </Pressable>
          );
        })}
      </Card>
      <Button title="إضافة تصنيف" icon="add" onPress={() => setEditing({ name: '', color: CATEGORY_COLORS[5] })} style={{ marginTop: 16 }} />

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'تعديل التصنيف' : 'تصنيف جديد'}>
        <TextInput
          value={editing?.name ?? ''}
          onChangeText={(name) => setEditing((e) => ({ ...e, name }))}
          placeholder="اسم التصنيف"
          placeholderTextColor={colors.textMuted}
          autoFocus
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
        />
        <View style={styles.colors}>
          {CATEGORY_COLORS.map((col) => (
            <Pressable
              key={col}
              onPress={() => setEditing((e) => ({ ...e, color: col }))}
              accessibilityLabel={col}
              style={[styles.color, { backgroundColor: col, borderColor: editing?.color === col ? colors.text : 'transparent' }]}
            />
          ))}
        </View>
        <Button title="حفظ" onPress={save} style={{ marginTop: 16 }} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  color: { width: 38, height: 38, borderRadius: 19, borderWidth: 3 },
});
