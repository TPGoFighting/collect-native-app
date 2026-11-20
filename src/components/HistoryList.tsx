import { useCallback, useState } from 'react';
import { Alert, FlatList } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ArticleMeta } from '@/lib/types';
import { clearHistory, getReadMap, listHistory } from '@/lib/db';
import { ArticleCard } from '@/components/ArticleCard';
import { StateView } from '@/components/StateView';

/**
 * Shared clear-history confirmation (identical dialog from both entry points).
 */
export function confirmClearHistory(onCleared?: () => void): void {
  Alert.alert('清除阅读历史', '确定要清除全部阅读历史吗？收藏不受影响。', [
    { text: '取消', style: 'cancel' },
    {
      text: '清除',
      style: 'destructive',
      onPress: () => {
        clearHistory();
        onCleared?.();
      },
    },
  ]);
}

/**
 * Shared read-history list used by both the favorites history segment and the
 * standalone /history route — one implementation, identical behavior and style.
 * `reloadKey` lets a host trigger a refresh (e.g. right after its header clear
 * button wipes history while this screen stays focused).
 */
export function HistoryList({
  contentContainerStyle,
  reloadKey,
}: {
  contentContainerStyle?: object;
  reloadKey?: number;
}) {
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

  // Refresh when the host bumps the key (render-time state sync, no effect).
  const [lastReloadKey, setLastReloadKey] = useState(reloadKey);
  if (reloadKey !== undefined && reloadKey !== lastReloadKey) {
    setLastReloadKey(reloadKey);
    setItems(listHistory());
    setReadIds(getReadMap());
  }

  return (
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
      ListEmptyComponent={<StateView title="还没有阅读记录" />}
      contentContainerStyle={contentContainerStyle}
    />
  );
}
