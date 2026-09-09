import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ToastProvider } from '@/components/toast';
import { DatabaseProvider } from '@/lib/db-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <ToastProvider>
        <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0B0F17' } }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </ToastProvider>
    </DatabaseProvider>
  );
}