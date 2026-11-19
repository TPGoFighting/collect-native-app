import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import type { ArticleMeta } from '@/lib/types';
import { useSettings } from '@/lib/theme';
import { clearHistory, getReadMap, listHistory } from '@/lib/db';
import { ArticleCard } from '@/components/ArticleCard';

export default function HistoryScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [items, setItems] = useState<ArticleMeta[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setItems(listHistory());
    setReadIds(getReadMap());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onClear = () => {
    Alert.alert('清除阅读历史', '确定要清除全部阅读历史吗？收藏不受影响。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => {
          clearHistory();
          reload();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>阅读历史</Text>
        <Pressable onPress={onClear} hitSlop={10} style={styles.iconBtn} accessibilityLabel="清除历史">
          <Trash2 size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
            isRead={readIds.has(item.id)}
            onPress={() => router.push(`/article/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>还没有阅读记录</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
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
  listContent: { paddingBottom: 24, paddingTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14 },
});
