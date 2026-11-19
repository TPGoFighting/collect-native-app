import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import type { ArticleMeta } from '@/lib/types';
import { useSettings } from '@/lib/theme';
import { clearHistory, getReadMap, listFavorites, listHistory } from '@/lib/db';
import { ArticleCard } from '@/components/ArticleCard';
import { StateView } from '@/components/StateView';

type Tab = 'fav' | 'history';

export default function FavoritesScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('fav');
  const [items, setItems] = useState<ArticleMeta[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setItems(tab === 'fav' ? listFavorites() : listHistory());
    setReadIds(getReadMap());
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onClearHistory = () => {
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>收藏</Text>
        {tab === 'history' && items.length > 0 ? (
          <Pressable onPress={onClearHistory} hitSlop={10} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="清除历史">
            <Trash2 size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.segment, { borderColor: theme.border }]}>
        {(
          [
            { key: 'fav', label: '我的收藏' },
            { key: 'history', label: '阅读历史' },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[
              styles.segBtn,
              { backgroundColor: tab === t.key ? theme.accent : 'transparent' },
            ]}
          >
            <Text
              style={[styles.segText, { color: tab === t.key ? theme.onAccent : theme.text }]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
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
          <StateView
            title={tab === 'fav' ? '还没有收藏' : '还没有阅读记录'}
            detail={tab === 'fav' ? '在文章页点右上角书签即可收藏。' : undefined}
          />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800' },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '700' },
  listContent: { paddingBottom: 24, paddingTop: 4 },
});
