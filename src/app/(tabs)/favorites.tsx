import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import type { ArticleMeta } from '@/lib/types';
import { useSettings } from '@/lib/theme';
import { getReadMap, listFavorites, listHistory } from '@/lib/db';
import { HistoryList, confirmClearHistory } from '@/components/HistoryList';
import { ArticleCard } from '@/components/ArticleCard';
import { StateView } from '@/components/StateView';

type Tab = 'fav' | 'history';

export default function FavoritesScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const requestedTab = tabParam === 'history' ? 'history' : 'fav';
  const [tab, setTab] = useState<Tab>(requestedTab);
  const [items, setItems] = useState<ArticleMeta[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [historyRev, setHistoryRev] = useState(0); // bumps to refresh HistoryList

  // Deep link (e.g. profile row) may arrive after mount: follow the param.
  const [lastParam, setLastParam] = useState<Tab>(requestedTab);
  if (requestedTab !== lastParam) {
    setLastParam(requestedTab);
    setTab(requestedTab);
  }

  const reload = useCallback(() => {
    setItems(tab === 'fav' ? listFavorites() : listHistory());
    setHistoryCount(listHistory().length);
    setReadIds(getReadMap());
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onClearHistory = () => {
    confirmClearHistory(() => {
      reload();
      setHistoryRev((n) => n + 1);
    });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>收藏</Text>
        {tab === 'history' && historyCount > 0 ? (
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
      {tab === 'history' ? (
        <HistoryList contentContainerStyle={styles.listContent} reloadKey={historyRev} />
      ) : (
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
            <StateView title="还没有收藏" detail="在文章页点右上角书签即可收藏。" />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
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
