import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsProvider } from '@/lib/theme';
import { initDb } from '@/lib/db';
import { syncNow } from '@/lib/sync';
import { registerBackgroundSync } from '@/lib/backgroundSync';
import { configureNotificationChannel, notificationNavigation } from '@/lib/notifications';
import { classifyIncomingUrl } from '@/lib/links';
import { dispatchIncoming, setIncomingListener, type IncomingNavigation } from '@/lib/incoming';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const navigating = useRef(false);
  const processedShare = useRef<string | null>(null);

  const navigate = useCallback(
    (nav: IncomingNavigation) => {
      if (navigating.current) return;
      navigating.current = true;
      // Let the navigator settle before pushing onto the freshly mounted stack.
      setTimeout(() => {
        if (nav.kind === 'article') router.push(`/article/${encodeURIComponent(nav.value)}`);
        else router.push({ pathname: '/recommend', params: { url: nav.value } });
        setTimeout(() => {
          navigating.current = false;
        }, 500);
      }, 250);
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        initDb();
        await configureNotificationChannel();
        registerBackgroundSync().catch(() => {});
        // Foreground sync: never blocks the first paint. Offline works from seed.
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

  // App Links / custom scheme — cold start and hot start.
  useEffect(() => {
    setIncomingListener(navigate);
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const link = classifyIncomingUrl(url);
      if (link) dispatchIncoming({ ...link, source: 'link', eventId: `link:${url}` });
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const { id, url } = notificationNavigation(response.notification);
      const link = id
        ? { kind: 'article' as const, value: id }
        : url
          ? classifyIncomingUrl(url)
          : null;
      if (link) dispatchIncoming({ ...link, source: 'notification', eventId: `notification:${response.notification.date}` });
    });

    return () => {
      setIncomingListener(null);
      sub.remove();
      responseSub.remove();
    };
  }, [navigate]);

  // System share menu (WeChat / X / browser) — cold, warm and hot start.
  useEffect(() => {
    if (!hasShareIntent) return;
    const raw = (shareIntent.webUrl || shareIntent.text)?.trim();
    if (!raw) return;
    // A fresh share with identical text must not be suppressed by the
    // event-level dedupe used for Linking / notification callbacks.
    const eventId = `share:${raw}:${Date.now()}:${Math.random()}`;
    if (processedShare.current !== raw) {
      processedShare.current = raw;
      const link = classifyIncomingUrl(raw);
      if (link) dispatchIncoming({ ...link, source: 'share', eventId });
    }
    resetShareIntent(true);
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  // Resume foreground: incremental sync + OS notification permission may have changed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncNow().catch(() => {});
        configureNotificationChannel().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="article/[id]" />
      <Stack.Screen name="article/share-card" />
      <Stack.Screen name="recommend" />
      <Stack.Screen name="search" />
      <Stack.Screen name="history" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="about" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider options={{ resetOnBackground: true }}>
        <SettingsProvider>
          <RootLayoutContent />
        </SettingsProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
