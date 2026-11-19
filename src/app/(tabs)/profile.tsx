import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronRight, Info, Link2, Settings2, Trash2, History, BookMarked } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';
import { countArticles } from '@/lib/db';
import { clearImageCache, formatBytes, getCacheSize } from '@/lib/images';

export default function ProfileScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [cacheSize, setCacheSize] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setCount(countArticles());
      getCacheSize().then(setCacheSize).catch(() => setCacheSize(null));
    }, []),
  );

  const onClearCache = () => {
    Alert.alert('清除缓存', '将清除已缓存的图片，文章正文不受影响。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          await clearImageCache();
          const size = await getCacheSize().catch(() => null);
          setCacheSize(size);
          Alert.alert('已清除', '图片缓存已清除。');
        },
      },
    ]);
  };

  const rows: { icon: React.ReactNode; label: string; sub?: string; onPress: () => void }[] = [
    { icon: <Settings2 size={20} color={theme.text} />, label: '阅读设置', sub: '字号 / 行距 / 主题', onPress: () => router.push('/settings') },
    { icon: <Bell size={20} color={theme.text} />, label: '新文章通知', sub: '后台同步 / 通知偏好', onPress: () => router.push('/notifications') },
    { icon: <Link2 size={20} color={theme.text} />, label: '推荐文章', sub: '把想收录的链接存下来', onPress: () => router.push('/recommend') },
    { icon: <History size={20} color={theme.text} />, label: '阅读历史', onPress: () => router.push('/history') },
    { icon: <BookMarked size={20} color={theme.text} />, label: '我的收藏', onPress: () => router.push('/(tabs)/favorites') },
    { icon: <Trash2 size={20} color={theme.text} />, label: '清除缓存', sub: cacheSize !== null ? `图片缓存 ${formatBytes(cacheSize)}` : undefined, onPress: onClearCache },
    { icon: <Info size={20} color={theme.text} />, label: '关于 Collect', sub: '版本 2.1.0', onPress: () => router.push('/about') },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>我的</Text>
        <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Collect</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            已收录 {count} 篇文章 · 离线可读
          </Text>
        </View>
        <View style={[styles.list, { borderColor: theme.border }]}>
          {rows.map((r, i) => (
            <Pressable
              key={r.label}
              onPress={r.onPress}
              style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
            >
              <View style={styles.rowLeft}>
                {r.icon}
                <View>
                  <Text style={[styles.rowLabel, { color: theme.text }]}>{r.label}</Text>
                  {r.sub ? <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{r.sub}</Text> : null}
                </View>
              </View>
              <ChevronRight size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
        <Text style={[styles.foot, { color: theme.textSecondary }]}>
          内容来自 collect.tpgofighting.top
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardSub: { fontSize: 13, marginTop: 4 },
  list: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  foot: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});
