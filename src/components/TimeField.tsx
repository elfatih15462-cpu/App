import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { formatTime, isValidTime } from '../domain/dates';
import { useTheme } from '../state/store';
import { Sheet } from './Sheet';
import { Button, Chip } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(t: string | null) {
  const d = new Date();
  const [h, m] = (t ?? '09:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Optional time picker: native dialog on Android, spinner sheet on iOS, text field on web. */
export function TimeField({ value, onChange }: { value: string | null; onChange: (t: string | null) => void }) {
  const { colors, isDark } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosValue, setIosValue] = useState(toDate(value));
  const [webText, setWebText] = useState(value ?? '');

  const fromDate = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        is24Hour: false,
        onValueChange: (_e, d) => d && onChange(fromDate(d)),
      });
    } else if (Platform.OS === 'ios') {
      setIosValue(toDate(value));
      setIosOpen(true);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.row}>
        <Chip label="بدون وقت" selected={!value} onPress={() => { onChange(null); setWebText(''); }} />
        <TextInput
          value={webText}
          onChangeText={(t) => {
            setWebText(t);
            if (isValidTime(t)) onChange(t);
          }}
          placeholder="HH:MM مثال 14:30"
          placeholderTextColor={colors.textMuted}
          style={[styles.webInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityLabel="الوقت"
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Chip label="بدون وقت" selected={!value} onPress={() => onChange(null)} />
      <Chip label={value ? formatTime(value) : 'تحديد وقت'} icon="time-outline" selected={!!value} onPress={open} />
      {Platform.OS === 'ios' && (
        <Sheet visible={iosOpen} onClose={() => setIosOpen(false)} title="وقت التنفيذ">
          <DateTimePicker
            value={iosValue}
            mode="time"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            onValueChange={(_e, d) => d && setIosValue(d)}
          />
          <Button
            title="تم"
            onPress={() => {
              onChange(fromDate(iosValue));
              setIosOpen(false);
            }}
          />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  webInput: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, minWidth: 160 },
});
