import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Bookmark, List, Moon, Share2, Sun, Type } from 'lucide-react-native';
import type { Article, Section } from '@/lib/types';
import { FONT_SIZES, LINE_HEIGHTS } from '@/lib/types';
import { useSettings } from '@/lib/theme';
import { getArticle, getArticleMeta, isFavorite, markRead, toggleFavorite } from '@/lib/db';
import { fetchArticleFull } from '@/lib/sync';
import { ArticleCard, coverUrl } from '@/components/ArticleCard';
import { ImageViewer } from '@/components/ImageViewer';
import { SectionView, type ViewerImage } from '@/components/SectionView';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, settings, setSettings, fontSize, lineHeight, isDark } = useSettings();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingFull, setFetchingFull] = useState(false);
  const [fav, setFav] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const headingY = useRef(new Map<number, number>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      let a = getArticle(id);
      if (a && a.sections.length === 0) {
        const full = await fetchArticleFull(id);
        if (full) a = full;
      }
      if (cancelled) return;
      if (a) {
        setArticle(a);
        setFav(isFavorite(id));
        markRead(id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const images: ViewerImage[] = useMemo(() => {
    if (!article) return [];
    const list: ViewerImage[] = [{ url: coverUrl(article), caption: article.coverAlt || article.title }];
    for (const s of article.sections) {
      if (s.type === 'image') list.push({ url: s.url, caption: s.caption });
    }
    return list;
  }, [article]);

  // map section index -> image index within `images` (cover is 0)
  const imageIndexOf = useCallback(
    (sectionIdx: number): number => {
      if (!article) return -1;
      let n = 1; // cover occupies 0
      for (let i = 0; i < article.sections.length; i++) {
        if (article.sections[i].type === 'image') {
          if (i === sectionIdx) return n;
          n += 1;
        }
      }
      return -1;
    },
    [article],
  );

  const headings = useMemo(() => {
    if (!article) return [];
    return article.sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === 'heading')
      .map(({ s, i }) => ({ index: i, level: (s as { level: number }).level, text: (s as { text: string }).text }));
  }, [article]);

  const related = useMemo(() => {
    if (!article) return [];
    return article.related
      .map((rid) => getArticleMeta(rid))
      .filter((m): m is NonNullable<typeof m> => !!m);
  }, [article]);

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = Math.max(contentSize.height - layoutMeasurement.height, 1);
    setProgress(Math.min(Math.max(contentOffset.y / max, 0), 1));
  };

  const openLink = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const onToggleFav = () => {
    if (!article) return;
    const next = toggleFavorite(article.id);
    setFav(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const onShare = async () => {
    if (!article) return;
    try {
      await Share.share({ message: `${article.title}\n${article.url}` });
    } catch {
      // share sheet dismissed
    }
  };

  const scrollToHeading = (sectionIdx: number) => {
    const y = headingY.current.get(sectionIdx);
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
    setTocOpen(false);
  };

  const retryFull = async () => {
    if (!id) return;
    setFetchingFull(true);
    const full = await fetchArticleFull(id);
    if (full) setArticle(full);
    setFetchingFull(false);
  };

  if (loading || !article) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </SafeAreaView>
    );
  }

  const bodyFont = fontSize;
  const bodyLH = lineHeight;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* header */}
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerActions}>
          {headings.length > 0 ? (
            <Pressable onPress={() => setTocOpen(true)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="目录">
              <List size={22} color={theme.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="阅读设置">
            <Type size={22} color={theme.text} />
          </Pressable>
          <Pressable onPress={onToggleFav} hitSlop={10} style={styles.iconBtn} accessibilityLabel="收藏">
            <Bookmark size={22} color={theme.text} fill={fav ? theme.text : 'transparent'} />
          </Pressable>
          <Pressable onPress={onShare} hitSlop={10} style={styles.iconBtn} accessibilityLabel="分享">
            <Share2 size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>
      {/* 3px progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>{article.title}</Text>
        <View style={styles.byline}>
          <Text style={[styles.bylineText, { color: theme.textSecondary }]}>{article.author}</Text>
          <Text style={[styles.bylineText, { color: theme.textSecondary }]}>{article.pname}</Text>
          <Text style={[styles.bylineText, { color: theme.textSecondary }]}>{article.date}</Text>
          <Text style={[styles.bylineText, { color: theme.textSecondary }]}>约 {article.mins} 分钟</Text>
        </View>
        <Pressable onPress={() => setViewerIndex(0)}>
          <Image
            source={{ uri: coverUrl(article) }}
            style={styles.cover}
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
            recyclingKey={article.id}
          />
        </Pressable>
        {article.coverAlt ? (
          <Text style={[styles.coverAlt, { color: theme.textSecondary }]}>{article.coverAlt}</Text>
        ) : null}
        {article.stats ? (
          <Text style={[styles.stats, { color: theme.textSecondary }]}>{article.stats}</Text>
        ) : null}

        {article.sections.length === 0 ? (
          <View style={styles.noBody}>
            <Text style={[styles.noBodyText, { color: theme.textSecondary }]}>
              正文尚未同步到本地（可能在离线时打开）
            </Text>
            <Pressable
              onPress={retryFull}
              disabled={fetchingFull}
              style={[styles.retryBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.retryText, { color: theme.onAccent }]}>
                {fetchingFull ? '正在获取…' : '重新获取正文'}
              </Text>
            </Pressable>
          </View>
        ) : (
          article.sections.map((s: Section, i: number) => (
            <View
              key={i}
              onLayout={(e) => {
                if (s.type === 'heading') headingY.current.set(i, e.nativeEvent.layout.y);
              }}
            >
              <SectionView
                section={s}
                fontSize={bodyFont}
                lineHeight={bodyLH}
                images={images}
                imageIndex={imageIndexOf(i)}
                onImagePress={setViewerIndex}
                onLinkPress={openLink}
              />
            </View>
          ))
        )}

        {article.sourceNote ? (
          <Text style={[styles.sourceNote, { color: theme.textSecondary }]}>{article.sourceNote}</Text>
        ) : null}

        <Pressable
          onPress={() => openLink(article.url)}
          style={[styles.originalBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.originalText, { color: theme.text }]}>阅读原文 ↗</Text>
        </Pressable>

        {related.length > 0 ? (
          <View style={styles.relatedWrap}>
            <Text style={[styles.relatedTitle, { color: theme.text }]}>
              相关文章{article.relatedNote ? ` · ${article.relatedNote}` : ''}
            </Text>
            {related.map((m) => (
              <ArticleCard key={m.id} article={m} isRead={false} onPress={() => router.push(`/article/${m.id}`)} />
            ))}
          </View>
        ) : null}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* TOC drawer */}
      <Modal visible={tocOpen} transparent animationType="fade" onRequestClose={() => setTocOpen(false)}>
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerDismiss} onPress={() => setTocOpen(false)} />
          <View style={[styles.drawer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.drawerTitle, { color: theme.text }]}>目录</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {headings.map((h) => (
                <Pressable
                  key={h.index}
                  onPress={() => scrollToHeading(h.index)}
                  style={[styles.tocRow, { paddingLeft: (h.level - 2) * 16 + 4 }]}
                >
                  <Text style={[styles.tocText, { color: theme.text }]} numberOfLines={2}>
                    {h.text}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* reading settings bottom sheet */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetDismiss} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>阅读设置</Text>
            <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>字号</Text>
            <View style={styles.sizeRow}>
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
            <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>行距</Text>
            <View style={styles.sizeRow}>
              {LINE_HEIGHTS.map((lh, i) => (
                <Pressable
                  key={lh}
                  onPress={() => setSettings({ lineHeight: i })}
                  style={[
                    styles.lhBtn,
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
            <Text style={[styles.sheetLabel, { color: theme.textSecondary }]}>主题</Text>
            <View style={styles.sizeRow}>
              {(
                [
                  { key: 'system', label: '跟随系统', icon: null },
                  { key: 'light', label: '浅色', icon: Sun },
                  { key: 'dark', label: '深色', icon: Moon },
                ] as const
              ).map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setSettings({ theme: t.key })}
                  style={[
                    styles.lhBtn,
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
            <Text style={[styles.sheetHint, { color: theme.textSecondary }]}>
              当前：{isDark ? '深色（纯黑）' : '浅色'} · 字号 {fontSize}px · 行距 {lineHeight}
            </Text>
          </View>
        </View>
      </Modal>

      <ImageViewer
        visible={viewerIndex >= 0}
        images={images}
        index={Math.max(viewerIndex, 0)}
        onClose={() => setViewerIndex(-1)}
        onIndexChange={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 52,
    borderBottomWidth: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 3, width: '100%' },
  progressFill: { height: 3 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 32, marginBottom: 10 },
  byline: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  bylineText: { fontSize: 13 },
  cover: { width: '100%', aspectRatio: 1200 / 615, borderRadius: 8, backgroundColor: '#E4E4E7' },
  coverAlt: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  stats: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  noBody: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noBodyText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: '700' },
  sourceNote: { fontSize: 12, lineHeight: 18, marginTop: 16 },
  originalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  originalText: { fontSize: 15, fontWeight: '700' },
  relatedWrap: { marginTop: 28, marginHorizontal: -20 },
  relatedTitle: { fontSize: 17, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12 },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerDismiss: { flex: 1 },
  drawer: { width: '80%', height: '100%', borderLeftWidth: 1, paddingTop: 56, paddingHorizontal: 16 },
  drawerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  tocRow: { paddingVertical: 12, borderBottomWidth: 0 },
  tocText: { fontSize: 14, lineHeight: 20 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetDismiss: { flex: 1 },
  sheet: { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 16 },
  sheetLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lhBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHint: { fontSize: 12, marginTop: 16, textAlign: 'center' },
});
