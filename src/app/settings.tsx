import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { confirmAsync } from '../components/TaskActions';
import { TimeField } from '../components/TimeField';
import { useToast } from '../components/Toast';
import { Card, Chip, IconName, SectionTitle, Segmented } from '../components/ui';
import { ThemePref } from '../domain/settings';
import { REMINDER_OPTIONS } from '../domain/types';
import { autoBackup, exportAndShare, listAutoBackups, LocalBackup, pickBackup, readLocalBackup } from '../services/backup';
import { useStore, useTheme } from '../state/store';

export default function SettingsScreen() {
  const { settings, updateSetting, repo, reload, tasks } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [backups, setBackups] = useState<LocalBackup[] | null>(null);

  const doImport = async (data: unknown) => {
    if (!repo) return;
    const ok = await confirmAsync(
      'استيراد نسخة احتياطية',
      'سيتم دمج المهام من النسخة مع مهامك الحالية. لن يُحذف أي شيء، وعند التعارض تُعتمد النسخة الأحدث تعديلاً.',
      'استيراد',
    );
    if (!ok) return;
    try {
      const r = await repo.importBackup(data);
      await reload();
      toast(`تم الاستيراد: ${r.added} جديدة، ${r.updated} محدّثة`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'فشل الاستيراد');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle title="المظهر" />
      <Card>
        <Segmented<ThemePref>
          value={settings.theme}
          onChange={(v) => updateSetting('theme', v)}
          options={[
            { value: 'system', label: 'تلقائي' },
            { value: 'light', label: 'نهاري ☀️' },
            { value: 'dark', label: 'ليلي 🌙' },
          ]}
        />
      </Card>

      <SectionTitle title="المهام" />
      <Card>
        <Toggle
          icon="return-down-back-outline"
          title="ترحيل المهام غير المنجزة"
          subtitle="تظهر المهام المتبقية من الأيام السابقة تلقائياً في قائمة اليوم مع الاحتفاظ بتاريخها الأصلي."
          value={settings.carryOver}
          onChange={(v) => updateSetting('carryOver', v)}
        />
        <Row icon="pricetags-outline" title="إدارة التصنيفات" onPress={() => router.push('/categories')} />
        <Row icon="trash-outline" title="سلة المحذوفات" subtitle={`${tasks.filter((t) => t.deletedAt).length} مهمة`} onPress={() => router.push('/trash')} />
      </Card>

      <SectionTitle title="التنبيهات والإشعارات" />
      <Card>
        {Platform.OS === 'web' && (
          <Text style={{ color: colors.warning, marginBottom: 8 }}>الإشعارات متاحة في تطبيق Android وiOS فقط.</Text>
        )}
        <Toggle icon="notifications-outline" title="تفعيل التنبيهات" value={settings.notificationsEnabled} onChange={(v) => updateSetting('notificationsEnabled', v)} />
        {settings.notificationsEnabled && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>التذكيرات الافتراضية للمهام الجديدة</Text>
            <View style={styles.chips}>
              {REMINDER_OPTIONS.map((o) => (
                <Chip
                  key={o.minutes}
                  label={o.label}
                  selected={settings.defaultReminders.includes(o.minutes)}
                  onPress={() =>
                    updateSetting(
                      'defaultReminders',
                      settings.defaultReminders.includes(o.minutes)
                        ? settings.defaultReminders.filter((m) => m !== o.minutes)
                        : [...settings.defaultReminders, o.minutes].sort((a, b) => a - b),
                    )
                  }
                />
              ))}
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>وقت التذكير للمهام بدون وقت محدد</Text>
            <TimeField value={settings.defaultTime} onChange={(t) => t && updateSetting('defaultTime', t)} />
            <Toggle
              icon="sunny-outline"
              title="ملخص الصباح"
              subtitle="إشعار يومي بعدد مهام اليوم والمهام المرحّلة"
              value={settings.morningSummary}
              onChange={(v) => updateSetting('morningSummary', v)}
            />
            {settings.morningSummary && <TimeField value={settings.morningTime} onChange={(t) => t && updateSetting('morningTime', t)} />}
            <Toggle
              icon="alert-circle-outline"
              title="تنبيه المهام المتأخرة"
              subtitle="إشعار مسائي إذا بقيت مهام غير منجزة"
              value={settings.overdueAlert}
              onChange={(v) => updateSetting('overdueAlert', v)}
            />
            {settings.overdueAlert && <TimeField value={settings.overdueTime} onChange={(t) => t && updateSetting('overdueTime', t)} />}
          </>
        )}
      </Card>

      <SectionTitle title="النسخ الاحتياطي والمزامنة" />
      <Card>
        <Row
          icon="cloud-upload-outline"
          title="تصدير نسخة احتياطية"
          subtitle="احفظ الملف في Google Drive أو iCloud أو أرسله لنفسك"
          onPress={() => repo && exportAndShare(repo).catch((e) => toast(String(e?.message ?? e)))}
        />
        <Row
          icon="cloud-download-outline"
          title="استيراد / مزامنة من ملف"
          subtitle="يدمج المهام من جهاز آخر دون حذف أي شيء"
          onPress={async () => {
            try {
              const data = await pickBackup();
              if (data) await doImport(data);
            } catch (e) {
              toast(e instanceof Error ? e.message : 'فشل الاستيراد');
            }
          }}
        />
        {Platform.OS !== 'web' && (
          <>
            <Toggle
              icon="save-outline"
              title="نسخ احتياطي تلقائي يومي"
              subtitle="يحفظ نسخة على الجهاز كل يوم (آخر 7 أيام)"
              value={settings.autoBackup}
              onChange={(v) => updateSetting('autoBackup', v)}
            />
            <Row
              icon="time-outline"
              title="النسخ التلقائية المحفوظة"
              subtitle={settings.lastAutoBackup ? `آخر نسخة: ${settings.lastAutoBackup}` : undefined}
              onPress={async () => {
                if (repo) await autoBackup(repo).catch(() => {});
                setBackups(listAutoBackups());
              }}
            />
          </>
        )}
      </Card>

      <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20, fontSize: 12 }}>مهامي | My Tasks — الإصدار 1.0.0</Text>

      <Sheet visible={!!backups} onClose={() => setBackups(null)} title="النسخ التلقائية">
        {backups?.length === 0 && <Text style={{ color: colors.textMuted }}>لا توجد نسخ بعد.</Text>}
        {backups?.map((b) => (
          <Row
            key={b.name}
            icon="document-outline"
            title={b.date}
            subtitle="اضغط للاستعادة (دمج)"
            onPress={async () => {
              setBackups(null);
              await doImport(await readLocalBackup(b));
            }}
          />
        ))}
      </Sheet>
    </ScrollView>
  );
}

function Toggle({ icon, title, subtitle, value, onChange }: { icon: IconName; title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={title} />
    </View>
  );
}

function Row({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
