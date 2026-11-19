import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, Trash2 } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';
import { addRecommend, getRecommendList, removeRecommend, type RecommendItem } from '@/lib/db';
import { extractSharedUrl } from '@/lib/links';

export default function RecommendScreen() {
  const { theme } = useSettings();
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<RecommendItem[]>([]);
  const [copied, setCopied] = useState(false);
  const incomingUrl = useMemo(() => (typeof params.url === 'string' ? params.url : ''), [params.url]);
  const prefilled = useRef<string | null>(null);

  const reload = useCallback(() => setItems(getRecommendList()), []);
  useFocusEffect(reload);

  useEffect(() => {
    if (!incomingUrl || prefilled.current === incomingUrl) return;
    prefilled.current = incomingUrl;
    setUrl(incomingUrl);
    const alreadySaved = getRecommendList().some((x) => x.url === incomingUrl);
    Alert.alert(
      alreadySaved ? '链接已在待转换列表' : '已从分享中填入链接',
      alreadySaved ? '可以直接复制或删除已有条目。' : '确认后点击“添加到待转换列表”。',
    );
  }, [incomingUrl]);

  const onAdd = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u) || !extractSharedUrl(u)) {
      Alert.alert('链接格式不对', '请填入以 http:// 或 https:// 开头的有效文章链接。');
      return;
    }
    if (getRecommendList().some((x) => x.url === u)) {
      Alert.alert('重复链接', '这条链接已经在待转换列表里了。');
      return;
    }
    addRecommend(u, note);
    setUrl('');
    setNote('');
    reload();
  };

  const copyAll = async () => {
    if (items.length === 0) return;
    const text = items.map((x) => `${x.url}${x.note ? `（${x.note}）` : ''}`).join('\n');
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyOne = async (x: RecommendItem) => {
    await Clipboard.setStringAsync(`${x.url}${x.note ? `（${x.note}）` : ''}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>推荐文章</Text>
        <View style={styles.iconBtn} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => String(x.ts)}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              看到值得收录的文章，先把链接存下来；复制后发给站长即可收录上线。本站是静态站，App 内无法自动收录。
            </Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="文章链接（微信 / X / 小红书 / 知乎…）"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="备注（可选）：为什么值得收录"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <Pressable onPress={onAdd} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
              <Text style={[styles.addText, { color: theme.onAccent }]}>添加到待转换列表</Text>
            </Pressable>
            {items.length > 0 ? (
              <Pressable onPress={copyAll} style={[styles.copyBtn, { borderColor: theme.border }]}>
                <Copy size={16} color={theme.text} />
                <Text style={[styles.copyText, { color: theme.text }]}>
                  {copied ? '已复制' : `复制全部链接（${items.length} 条），发送给站长即可收录`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.item, { borderColor: theme.border }]}>
            <View style={styles.itemText}>
              <Text style={[styles.itemUrl, { color: theme.text }]} numberOfLines={2}>
                {item.url}
              </Text>
              {item.note ? (
                <Text style={[styles.itemNote, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.note}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => copyOne(item)} hitSlop={8} style={styles.itemBtn} accessibilityLabel="复制">
              <Copy size={18} color={theme.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => {
                removeRecommend(item.ts);
                reload();
              }}
              hitSlop={8}
              style={styles.itemBtn}
              accessibilityLabel="删除"
            >
              <Trash2 size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>待转换列表是空的</Text>
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
  form: { padding: 16 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  addBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  addText: { fontSize: 15, fontWeight: '700' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 10,
  },
  copyText: { fontSize: 14, fontWeight: '700' },
  listContent: { paddingBottom: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  itemText: { flex: 1 },
  itemUrl: { fontSize: 14, lineHeight: 19 },
  itemNote: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  itemBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14 },
});
