import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, WifiOff, X } from 'lucide-react-native';
import type { ArticleMeta } from '@/lib/types';
import { useSettings } from '@/lib/theme';
import { getReadMap, listArticles } from '@/lib/db';
import { lastSyncAt, lastSyncError, syncNow } from '@/lib/sync';
import { ArticleCard } from '@/components/ArticleCard';
import { PlatformChips } from '@/components/PlatformChips';
import { StateView } from '@/components/StateView';

interface Row {
  key: string;
  type: 'month' | 'article';
  label?: string;
  article?: ArticleMeta;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

export default function HomeScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [platform, setPlatform] = useState('all');
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [offline, setOffline] = useState(false);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const knownCount = useRef(0);

  const reload = useCallback(() => {
    const all = listArticles({ platform: platform === 'all' ? undefined : platform });
    setArticles(all);
    setReadIds(getReadMap());
    setLastSync(lastSyncAt());
    setSyncIssue(lastSyncError());
    if (knownCount.current === 0) knownCount.current = listArticles().length;
  }, [platform]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const before = listArticles().length;
    const res = await syncNow();
    setRefreshing(false);
    if (res.error) {
      setOffline(true);
      setSyncIssue(res.error);
    } else {
      setOffline(false);
      setSyncIssue(res.failedIds?.length ? `正文获取失败 ${res.failedIds.length} 篇` : null);
      const gained = res.added + res.updated;
      if (gained > 0 && before > 0) setNewCount(gained);
    }
    reload();
    knownCount.current = listArticles().length;
  }, [reload]);

  const sections = useMemo(() => {
    const groups = new Map<string, ArticleMeta[]>();
    for (const a of articles) {
      const ym = a.date.slice(0, 7);
      if (!groups.has(ym)) groups.set(ym, []);
      groups.get(ym)!.push(a);
    }
    return [...groups.entries()].map(([ym, data]) => ({
      title: `${monthLabel(ym)} · ${data.length} 篇`,
      data: data.map((a) => ({ key: a.id, type: 'article' as const, article: a })),
    }));
  }, [articles]);

  const openArticle = (id: string) => router.push(`/article/${id}`);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Collect</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {articles.length > 0 ? `已收录 ${listArticles().length} 篇` : '正在加载…'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/search')}
          hitSlop={8}
          style={[styles.searchBtn, { borderColor: theme.border }]}
          accessibilityLabel="搜索"
        >
          <Search size={20} color={theme.text} />
        </Pressable>
      </View>

      {newCount > 0 ? (
        <Pressable
          onPress={() => setNewCount(0)}
          style={[styles.banner, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.bannerText, { color: theme.onAccent }]}>发现 {newCount} 篇新文章</Text>
          <X size={16} color={theme.onAccent} />
        </Pressable>
      ) : null}
      {offline ? (
        <View style={[styles.offline, { borderColor: theme.border }]}>
          <WifiOff size={14} color={theme.textSecondary} />
          <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
            离线内容{lastSync ? ` · 上次更新于 ${lastSync.slice(0, 10)}` : ''}
          </Text>
        </View>
      ) : null}
      {syncIssue && !offline ? (
        <View style={[styles.offline, { borderColor: theme.border }]}>
          <Text style={[styles.offlineText, { color: theme.textSecondary }]}>{syncIssue} · 下拉重试</Text>
        </View>
      ) : null}

      <PlatformChips selected={platform} onSelect={setPlatform} />

      <SectionList
        sections={sections}
        keyExtractor={(row: Row) => row.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.month, { color: theme.textSecondary, backgroundColor: theme.bg }]}>{title}</Text>
        )}
        renderItem={({ item }: { item: Row }) =>
          item.article ? (
            <ArticleCard article={item.article} isRead={readIds.has(item.article.id)} onPress={() => openArticle(item.article!.id)} />
          ) : null
        }
        ListEmptyComponent={
          <StateView
            title="暂无文章"
            detail={offline ? '网络不可用，恢复连接后下拉刷新即可同步。' : '下拉刷新，从 collect.tpgofighting.top 获取最新收录。'}
            actionLabel={offline ? undefined : '立即刷新'}
            onAction={offline ? undefined : onRefresh}
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
  title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerText: { fontSize: 14, fontWeight: '700' },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  offlineText: { fontSize: 12 },
  month: { fontSize: 13, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 10 },
  listContent: { paddingBottom: 24 },
});
