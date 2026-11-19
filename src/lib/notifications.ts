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
