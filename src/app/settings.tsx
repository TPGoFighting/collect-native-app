import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Moon, Sun } from 'lucide-react-native';
import { FONT_SIZES, LINE_HEIGHTS } from '@/lib/types';
import { useSettings } from '@/lib/theme';

export default function SettingsScreen() {
  const { theme, settings, setSettings, isDark } = useSettings();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>阅读设置</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>字号</Text>
        <View style={styles.row}>
          {FONT_SIZES.map((size, i) => (
            <Pressable
              key={size}
              onPress={() => setSettings({ fontSize: i })}
              style={[
                styles.sizeBtn,
                {
                  borderColor: settings.fontSize === i ? theme.accent : theme.border,
                  backgroundColor: settings.fontSize === i ? theme.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  fontSize: size,
                  color: settings.fontSize === i ? theme.onAccent : theme.text,
                  fontWeight: '700',
                }}
              >
                A
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.label, { color: theme.textSecondary }]}>行距</Text>
        <View style={styles.row}>
          {LINE_HEIGHTS.map((lh, i) => (
            <Pressable
              key={lh}
              onPress={() => setSettings({ lineHeight: i })}
              style={[
                styles.optBtn,
                {
                  borderColor: settings.lineHeight === i ? theme.accent : theme.border,
                  backgroundColor: settings.lineHeight === i ? theme.accent : 'transparent',
                },
              ]}
            >
              <Text style={{ color: settings.lineHeight === i ? theme.onAccent : theme.text, fontWeight: '700' }}>
                {i === 0 ? '紧凑' : '疏朗'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.label, { color: theme.textSecondary }]}>主题</Text>
        <View style={styles.row}>
          {(
            [
              { key: 'system', label: '跟随系统' },
              { key: 'light', label: '浅色', icon: Sun },
              { key: 'dark', label: '深色', icon: Moon },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setSettings({ theme: t.key })}
              style={[
                styles.optBtn,
                {
                  borderColor: settings.theme === t.key ? theme.accent : theme.border,
                  backgroundColor: settings.theme === t.key ? theme.accent : 'transparent',
                },
              ]}
            >
              <Text style={{ color: settings.theme === t.key ? theme.onAccent : theme.text, fontWeight: '700' }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          当前：{isDark ? '深色（纯黑）' : '浅色'} · 设置会立即应用到文章阅读页
        </Text>
        <View style={[styles.preview, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text
            style={{
              color: theme.text,
              fontFamily: 'serif',
              fontSize: FONT_SIZES[settings.fontSize],
              lineHeight: Math.round(FONT_SIZES[settings.fontSize] * LINE_HEIGHTS[settings.lineHeight]),
            }}
          >
            所有代码都是垃圾代码，除了我的。预览一下这段文字在当前字号与行距下的样子。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 52,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  row: { flexDirection: 'row', gap: 8 },
  sizeBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, marginTop: 24, lineHeight: 18 },
  preview: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
});
