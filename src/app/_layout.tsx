import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsProvider } from '@/lib/theme';
import { initDb } from '@/lib/db';
import { syncNow } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        initDb();
        // Background sync: never blocks the first paint. Offline works from seed.
        syncNow().catch(() => {});
      } finally {
        if (!cancelled) {
          setReady(true);
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="article/[id]" />
          <Stack.Screen name="recommend" />
          <Stack.Screen name="search" />
          <Stack.Screen name="history" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="about" />
        </Stack>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
