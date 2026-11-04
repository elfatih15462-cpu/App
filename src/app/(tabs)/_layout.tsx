import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildTodayView } from '../../domain/rules';
import { useStore, useTheme } from '../../state/store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconActive : icon} color={color as string} size={size} />
  ),
});

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, today, settings } = useStore();
  const remaining = buildTodayView(tasks, today, settings.carryOver).remaining;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ ...tab('اليوم', 'today-outline', 'today'), tabBarBadge: remaining > 0 ? remaining : undefined }}
      />
      <Tabs.Screen name="upcoming" options={tab('القادمة', 'list-outline', 'list')} />
      <Tabs.Screen name="calendar" options={tab('التقويم', 'calendar-outline', 'calendar')} />
      <Tabs.Screen name="archive" options={tab('الأرشيف', 'archive-outline', 'archive')} />
      <Tabs.Screen name="stats" options={tab('الإحصائيات', 'stats-chart-outline', 'stats-chart')} />
    </Tabs>
  );
}
