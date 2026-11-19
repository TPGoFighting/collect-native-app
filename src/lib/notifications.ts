import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { Platform } from 'react-native';
import { getMeta, setMeta } from './db';
import { appLinkArticleUrl } from './links';

export const SYNC_TASK = 'collect-incremental-sync';
export const SYNC_CHANNEL = 'collect-articles';

export type NotificationPref = 'all' | 'wifi' | 'off';

export function getNotificationPref(): NotificationPref {
  const value = getMeta('notification_pref');
  return value === 'wifi' || value === 'off' ? value : 'all';
}

export function setNotificationPref(value: NotificationPref): void {
  setMeta('notification_pref', value);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SYNC_CHANNEL, {
    name: '新文章',
    description: 'Collect 发现新收录文章时提醒',
    importance: AndroidImportance.DEFAULT,
    vibrationPattern: [0],
    sound: null,
  });
}

export async function getNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------- in-article permission nudge (shown once, after the 3rd finished article) ----------
export const NUDGE_AFTER_ARTICLES = 3;
export const NUDGE_COUNT_KEY = 'nudge_articles_read';
export const NUDGE_SHOWN_KEY = 'nudge_shown';

/** Returns true when the nudge should be shown for this article finish. */
export function shouldShowNudge(readCount: number, shown: boolean, granted: boolean): boolean {
  return !shown && !granted && readCount >= NUDGE_AFTER_ARTICLES;
}

/**
 * Call when the user finishes reading an article. Counts finished articles
 * (deduped per article) in the meta table and reports whether the in-article
 * nudge should appear now — exactly once, never for already-granted users.
 */
export function recordArticleFinishedForNudge(id: string, granted: boolean): boolean {
  if (getMeta(`nudge_counted:${id}`) === '1') {
    // Re-read: keep prior state so the banner can persist across the session.
    return getMeta(NUDGE_SHOWN_KEY) !== '1' && !granted && Number(getMeta(NUDGE_COUNT_KEY) ?? '0') >= NUDGE_AFTER_ARTICLES;
  }
  setMeta(`nudge_counted:${id}`, '1');
  const prev = Number(getMeta(NUDGE_COUNT_KEY) ?? '0');
  setMeta(NUDGE_COUNT_KEY, String(prev + 1));
  const count = prev + 1;
  if (shouldShowNudge(count, getMeta(NUDGE_SHOWN_KEY) === '1', granted)) {
    return true;
  }
  return false;
}

/** Mark the nudge as consumed so it never appears again. */
export function markNudgeShown(): void {
  setMeta(NUDGE_SHOWN_KEY, '1');
}

/** Notify once per article when the preference and OS permission allow it. */
export async function notifyNewArticle(id: string, title: string): Promise<boolean> {
  if (getNotificationPref() === 'off') return false;
  if (!(await getNotificationPermission())) return false;
  await configureNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Collect 新文章',
      body: title,
      data: { type: 'article', id, url: appLinkArticleUrl(id) },
      sound: false,
      ...(Platform.OS === 'android' ? { channelId: SYNC_CHANNEL } : {}),
    },
    trigger: null,
  });
  return true;
}

export interface NotificationNavigation {
  id?: string;
  url?: string;
}

export function notificationNavigation(notification: Notifications.Notification): NotificationNavigation {
  const data = notification.request.content.data as Record<string, unknown> | undefined;
  return {
    id: typeof data?.id === 'string' ? data.id : undefined,
    url: typeof data?.url === 'string' ? data.url : undefined,
  };
}
