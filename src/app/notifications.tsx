import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { ArrowLeft } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';
import {
  configureNotificationChannel,
  getNotificationPermission,
  getNotificationPref,
  requestNotificationPermission,
  setNotificationPref,
  type NotificationPref,
} from '@/lib/notifications';
import { registerBackgroundSync, unregisterBackgroundSync } from '@/lib/backgroundSync';
import { lastSyncAt, lastSyncError } from '@/lib/sync';

const OPTIONS: { key: NotificationPref; label: string; detail: string }[] = [
  { key: 'all', label: '所有网络', detail: '任何可用网络下发现新文章都提醒' },
  { key: 'wifi', label: '仅 Wi-Fi', detail: '只在 Wi-Fi 下同步并提醒，节省流量' },
  { key: 'off', label: '关闭通知', detail: '仍会同步内容，但不发送系统通知' },
];

export default function NotificationSettingsScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [permission, setPermission] = useState(false);
  const [pref, setPref] = useState<NotificationPref>('all');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reload = useCallback(() => {
    getNotificationPermission().then(setPermission).catch(() => setPermission(false));
    setPref(getNotificationPref());
    setSyncedAt(lastSyncAt());
    setSyncError(lastSyncError());
  }, []);
  useFocusEffect(reload);

  useEffect(() => {
    if (permission && pref !== 'off') registerBackgroundSync().catch(() => {});
    else unregisterBackgroundSync().catch(() => {});
  }, [permission, pref]);

  const onEnable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted);
    if (granted) {
      await configureNotificationChannel();
      await registerBackgroundSync();
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>新文章通知</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>系统通知权限</Text>
          <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>
            {permission ? '已允许 · 后台会按系统策略增量同步' : '未允许 · 应用内仍会自动更新列表'}
          </Text>
          {!permission ? (
            <Pressable onPress={onEnable} style={[styles.btn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.onAccent, fontWeight: '700', fontSize: 14 }}>允许通知</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (Platform.OS === 'android') {
                  IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
                    extra: { 'android.provider.extra.APP_PACKAGE': Constants.expoConfig?.android?.package ?? 'top.tpgofighting.collect' },
                  }).catch(() => {});
                }
              }}
              style={[styles.btnOutline, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>系统设置</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>同步与提醒</Text>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setNotificationPref(opt.key)}
            style={[styles.option, { borderColor: pref === opt.key ? theme.accent : theme.border }]}
          >
            <View style={[styles.radio, { borderColor: pref === opt.key ? theme.accent : theme.border }]}>
              {pref === opt.key ? <View style={[styles.radioInner, { backgroundColor: theme.accent }]} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>{opt.label}</Text>
              <Text style={[styles.optionDetail, { color: theme.textSecondary }]}>{opt.detail}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={[styles.label, { color: theme.textSecondary }]}>同步状态</Text>
        <Text style={[styles.status, { color: theme.textSecondary }]}>
          {syncedAt ? `上次同步：${syncedAt.replace('T', ' ').slice(0, 19)}` : '尚未同步'}
          {syncError ? `\n最近问题：${syncError}` : ''}
        </Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          后台同步受系统省电策略限制，不保证即时到达；前台启动与回到前台时都会立即检查。每篇新文章只提醒一次。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 52, borderBottomWidth: 1 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  content: { padding: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardDetail: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  btnOutline: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  status: { fontSize: 13, lineHeight: 20 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 24 },
});
