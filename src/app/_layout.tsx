import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthGate } from '@/features/auth/AuthGate';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    // Outermost on purpose: a crash inside any provider — including the theme
    // and the query client — still lands on the fallback rather than a white
    // screen. A boundary nested inside the thing that failed catches nothing.
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ThemedRoot />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/**
 * Separate component so it sits *inside* ThemeProvider and can call useTheme —
 * the status bar has to follow the resolved theme, not the system one.
 */
function ThemedRoot() {
  const theme = useTheme();

  /**
   * Paint the document root, not just the screens.
   *
   * AmbientBackground is a per-screen sibling layer, so without this the html/
   * body stays at the browser default. In dark mode that means a light flash
   * before hydration and a light overscroll gutter — and it made every contrast
   * measurement outside a card composite against #F2F2F2 instead of #0B0B12.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const bg = theme.color.background;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = theme.isDark ? 'dark' : 'light';
  }, [theme.color.background, theme.isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.background },
          }}
        />
      </AuthGate>
    </View>
  );
}
