import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, BookOpen, ShieldCheck } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '@/lib/theme';
import { configureNotificationChannel, requestNotificationPermission } from '@/lib/notifications';
import { registerBackgroundSync } from '@/lib/backgroundSync';

export const ONBOARDING_KEY = 'collect:onboarding:v1';

const SCREENS = [
  {
    icon: BookOpen,
    title: '离线全文',
    detail: '装好即读，断网也能读。所有文章正文在同步时缓存到本机。',
  },
  {
    icon: ShieldCheck,
    title: '人工精选',
    detail: '每一篇都由站长读过才收录，不做算法推荐流。',
  },
  {
    icon: Bell,
    title: '新文章通知',
    detail: '有新收录时轻轻提醒一声，可以随时在设置里关掉。',
  },
] as const;

export default function OnboardingScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const navigating = useRef(false);

  const finish = () => {
    if (navigating.current) return;
    navigating.current = true;
    AsyncStorage.setItem(ONBOARDING_KEY, 'done').catch(() => {});
    router.replace('/(tabs)');
  };

  const onEnableNotifications = async () => {
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        await configureNotificationChannel();
        await registerBackgroundSync();
      }
    } catch {
      // permission request failed; continue silently
    }
    finish();
  };

  const screen = SCREENS[step];
  const Icon = screen.icon;
  const isLast = step === SCREENS.length - 1;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.skipRow}>
        <Pressable onPress={finish} hitSlop={10} accessibilityRole="button" accessibilityLabel="跳过引导">
          <Text style={[styles.skip, { color: theme.textSecondary }]}>跳过</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={[styles.mark, { borderColor: theme.border }]}>
          <Icon size={28} color={theme.text} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{screen.title}</Text>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>{screen.detail}</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SCREENS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === step ? theme.accent : theme.border }]}
            />
          ))}
        </View>
        <Pressable
          onPress={() => (isLast ? finish() : setStep(step + 1))}
          style={[styles.nextBtn, { backgroundColor: theme.accent }]}
          accessibilityRole="button"
        >
          <Text style={[styles.nextText, { color: theme.onAccent }]}>
            {isLast ? '开始阅读' : '下一页'}
          </Text>
        </Pressable>
        {isLast ? (
          <Pressable
            onPress={onEnableNotifications}
            style={[styles.notifyBtn, { borderColor: theme.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.notifyText, { color: theme.text }]}>开启新文章通知</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  skip: { fontSize: 14, paddingVertical: 8, paddingHorizontal: 4 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800' },
  detail: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 28, gap: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nextBtn: { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  nextText: { fontSize: 15, fontWeight: '700' },
  notifyBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  notifyText: { fontSize: 14, fontWeight: '700' },
});
