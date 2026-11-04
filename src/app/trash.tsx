import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAsync } from '../components/TaskActions';
import { useToast } from '../components/Toast';
import { Button, EmptyState } from '../components/ui';
import { formatDateTimeISO } from '../domain/dates';
import { useStore, useTheme } from '../state/store';

export default function TrashScreen() {
  const { tasks, recoverTask, purgeTask, emptyTrash } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const deleted = tasks.filter((t) => t.deletedAt).sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1));

  return (
    <FlatList
      data={deleted}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        deleted.length > 0 ? (
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            المهام المحذوفة تبقى هنا حتى تستعيدها أو تحذفها نهائياً بنفسك.
          </Text>
        ) : undefined
      }
      ListEmptyComponent={<EmptyState icon="trash-outline" title="سلة المحذوفات فارغة" subtitle="المهام التي تحذفها تنتقل إلى هنا ويمكن استعادتها." />}
      renderItem={({ item: t }) => (
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
              حُذفت {formatDateTimeISO(t.deletedAt!)} • {t.status === 'done' ? 'منجزة' : 'غير منجزة'}
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              await recoverTask(t.id);
              toast('استُعيدت المهمة ✓');
            }}
            accessibilityLabel={`استعادة ${t.title}`}
            style={[styles.btn, { backgroundColor: colors.successSoft }]}
          >
            <Ionicons name="refresh" size={18} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: '700' }}>استعادة</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={async () => {
              if (await confirmAsync('حذف نهائي', `لا يمكن التراجع عن حذف "${t.title}" نهائياً.`, 'حذف نهائياً', true)) await purgeTask(t.id);
            }}
            accessibilityLabel={`حذف ${t.title} نهائياً`}
          >
            <Ionicons name="close-circle-outline" size={24} color={colors.danger} />
          </Pressable>
        </View>
      )}
      ListFooterComponent={
        deleted.length > 0 ? (
          <Button
            title="إفراغ السلة نهائياً"
            variant="danger"
            icon="trash"
            style={{ marginTop: 16 }}
            onPress={async () => {
              if (await confirmAsync('إفراغ السلة', `سيتم حذف ${deleted.length} مهمة نهائياً ولا يمكن استعادتها.`, 'إفراغ', true)) {
                const n = await emptyTrash();
                toast(`حُذفت ${n} مهمة نهائياً`);
              }
            }}
          />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
});
