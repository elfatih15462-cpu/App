import { DarkTheme, DefaultTheme, LocaleProvider, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RTLView } from '../components/RTLView';
import { TaskActionsProvider } from '../components/TaskActions';
import { ToastProvider } from '../components/Toast';
import { addResponseListener } from '../services/notifications';
import { StoreProvider, useStore, useTheme } from '../state/store';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, error } = useStore();
  const { colors } = useTheme();
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ color: colors.danger, fontSize: 16, textAlign: 'center' }}>تعذّر فتح قاعدة البيانات:{'\n'}{error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

function Navigator() {
  const { colors, isDark } = useTheme();
  useEffect(() => addResponseListener((taskId) => (taskId ? router.push({ pathname: '/task/[id]', params: { id: taskId } }) : router.navigate('/'))), []);
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };
  return (
    <LocaleProvider direction="rtl">
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Gate>
        <ToastProvider>
          <TaskActionsProvider>
            <Stack
              screenOptions={{
                headerTitleStyle: { fontWeight: '700' },
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="task/new" options={{ title: 'مهمة جديدة', presentation: 'modal' }} />
              <Stack.Screen name="task/[id]" options={{ title: 'تفاصيل المهمة', presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ title: 'الإعدادات' }} />
              <Stack.Screen name="categories" options={{ title: 'التصنيفات' }} />
              <Stack.Screen name="trash" options={{ title: 'سلة المحذوفات' }} />
            </Stack>
          </TaskActionsProvider>
        </ToastProvider>
      </Gate>
    </ThemeProvider>
    </LocaleProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RTLView style={{ flex: 1 }}>
        <StoreProvider>
          <Navigator />
        </StoreProvider>
      </RTLView>
    </SafeAreaProvider>
  );
}
