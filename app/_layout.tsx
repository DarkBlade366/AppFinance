import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { ToastProvider } from '@/components/toast';
import { DatabaseProvider } from '@/lib/db-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <KeyboardProvider>
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
    </KeyboardProvider>
  );
}