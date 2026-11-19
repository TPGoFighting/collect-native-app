import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react-native';
import type { ArticleMeta } from '@/lib/types';
import { useSettings } from '@/lib/theme';
import { addSearchHistory, getReadMap, getSearchHistory, listArticles } from '@/lib/db';
import { ArticleCard } from '@/components/ArticleCard';

export default function SearchScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArticleMeta[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      setHistory(getSearchHistory());
      setReadIds(getReadMap());
    }, []),
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    timer.current = setTimeout(() => {
      setResults(q ? listArticles({ query: q }) : []);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const submit = (q: string) => {
    const text = q.trim();
    if (!text) return;
    addSearchHistory(text);
    setHistory(getSearchHistory());
    setResults(listArticles({ query: text }));
  };

  const openArticle = (id: string) => router.push(`/article/${id}`);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.searchRow, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit(query)}
          placeholder="搜索标题、作者、关键词…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          autoFocus
          returnKeyType="search"
          clearButtonMode="never"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.iconBtn} accessibilityLabel="清除">
            <X size={18} color={theme.textSecondary} />
          </Pressable>
        ) : (
          <SearchIcon size={20} color={theme.textSecondary} />
        )}
      </View>

      {query.trim() === '' ? (
        <View style={styles.historyWrap}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>搜索历史</Text>
          {history.length === 0 ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>还没有搜索记录</Text>
          ) : (
            <View style={styles.chips}>
              {history.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => {
                    setQuery(h);
                    submit(h);
                  }}
                  style={[styles.chip, { borderColor: theme.border }]}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>{h}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 24 }]}>
            搜索范围：标题、作者、摘要、关键词
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <ArticleCard article={item} isRead={readIds.has(item.id)} onPress={() => openArticle(item.id)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>没有找到相关文章</Text>
            </View>
          }
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.count, { color: theme.textSecondary }]}>找到 {results.length} 篇</Text>
            ) : undefined
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    height: 48,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, height: 48 },
  historyWrap: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14 },
  count: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 },
  listContent: { paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14 },
});
