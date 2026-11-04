import React, { useState } from 'react';
import { View } from 'react-native';
import { addDays, DateKey, formatLongDate } from '../domain/dates';
import { useStore } from '../state/store';
import { MonthCalendar } from './MonthCalendar';
import { Sheet } from './Sheet';
import { Button, Chip } from './ui';

export function DatePickerSheet({
  visible,
  value,
  title = 'اختر التاريخ',
  onClose,
  onPick,
}: {
  visible: boolean;
  value: DateKey;
  title?: string;
  onClose: () => void;
  onPick: (d: DateKey) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {visible && <PickerBody key={value} value={value} onClose={onClose} onPick={onPick} />}
    </Sheet>
  );
}

function PickerBody({ value, onClose, onPick }: { value: DateKey; onClose: () => void; onPick: (d: DateKey) => void }) {
  const { today } = useStore();
  const [month, setMonth] = useState(value);
  const [sel, setSel] = useState(value);
  const quick: [string, DateKey][] = [
    ['اليوم', today],
    ['غداً', addDays(today, 1)],
    ['بعد يومين', addDays(today, 2)],
    ['بعد أسبوع', addDays(today, 7)],
  ];
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {quick.map(([label, d]) => (
          <Chip
            key={label}
            label={label}
            selected={sel === d}
            onPress={() => {
              setSel(d);
              setMonth(d);
            }}
          />
        ))}
      </View>
      <MonthCalendar month={month} selected={sel} today={today} onSelect={setSel} onMonthChange={setMonth} />
      <Button
        title={`تأكيد: ${formatLongDate(sel)}`}
        onPress={() => {
          onPick(sel);
          onClose();
        }}
        style={{ marginTop: 16 }}
      />
    </>
  );
}
