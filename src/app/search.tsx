import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react-native';
import type { ArticleSearchHit } from '@/lib/db';
import { useSettings } from '@/lib/theme';
import { addSearchHistory, getReadMap, getSearchHistory, searchArticles } from '@/lib/db';
import { ArticleCard } from '@/components/ArticleCard';
import { StateView } from '@/components/StateView';

/** Body-hit context snippet with the keyword range emphasized in accent color. */
function SnippetLine({ hit }: { hit: ArticleSearchHit }) {
  const { theme } = useSettings();
  const snippet = hit.snippet;
  if (!snippet) return null;
  const before = snippet.text.slice(0, snippet.matchStart);
  const match = snippet.text.slice(snippet.matchStart, snippet.matchEnd);
  const after = snippet.text.slice(snippet.matchEnd);
  return (
    <Text style={[styles.snippet, { color: theme.textSecondary }]} numberOfLines={2}>
      {before}
      <Text style={{ color: theme.text, fontWeight: '700' }}>{match}</Text>
      {after}
    </Text>
  );
}

export default function SearchScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArticleSearchHit[]>([]);
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
      setResults(q ? searchArticles(q) : []);
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
    setResults(searchArticles(text));
  };

  const openArticle = (id: string) => router.push(`/article/${id}`);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.searchRow, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit(query)}
          placeholder="搜索标题、作者、正文…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          autoFocus
          returnKeyType="search"
          clearButtonMode="never"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="清除">
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
            搜索范围：标题、作者、摘要、关键词、正文
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(h) => h.meta.id}
          renderItem={({ item }) => (
            <View>
              <ArticleCard
                article={item.meta}
                isRead={readIds.has(item.meta.id)}
                onPress={() => openArticle(item.meta.id)}
              />
              {item.snippet ? (
                <View style={styles.snippetWrap}>
                  <SnippetLine hit={item} />
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <StateView title={query ? '没有找到相关文章' : '搜索文章'} detail={query ? '换个关键词，或从首页平台筛选中浏览。' : '输入标题、作者或关键词开始搜索。'} />
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
  snippetWrap: { marginTop: -6, paddingHorizontal: 30, marginBottom: 12 },
  snippet: { fontSize: 12, lineHeight: 17 },
  listContent: { paddingBottom: 24 },
});
