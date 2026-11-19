import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { saveToLibraryAsync } from 'expo-media-library/legacy';
import { Image } from 'expo-image';
import { ArrowLeft, Check, Download, Share2 } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';
import { takeHandoffArticle } from '@/lib/articleHandoff';
import { coverUrl } from '@/components/ArticleCard';
import { SHARE_CARD_WIDTH, ShareCard } from '@/components/ShareCard';

export default function ShareCardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { theme } = useSettings();
  const [initial] = useState(() => ({ article: takeHandoffArticle(id) }));
  const article = initial.article;
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(article ? null : '未找到文章');
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const cardRef = useRef<ViewInstance>(null);

  const generate = useCallback(async () => {
    if (!article || !cardRef.current) return;
    setError(null);
    try {
      const captured = await captureRef(cardRef, {
        format: 'png',
        result: 'tmpfile',
        width: SHARE_CARD_WIDTH,
      });
      setUri(captured);
    } catch {
      setError('长图生成失败，请重试');
    }
  }, [article]);

  useEffect(() => {
    if (article) {
      // Wait one frame for offscreen layout + cover decode.
      const timer = setTimeout(generate, 400);
      return () => clearTimeout(timer);
    }
  }, [article, generate]);

  const save = async () => {
    if (!uri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('需要相册权限才能保存图片');
        return;
      }
      await saveToLibraryAsync(uri);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('保存失败，请检查相册权限');
    }
  };

  const share = async () => {
    if (!uri) return;
    try {
      await Share.share({ url: uri, message: article?.title });
    } catch {
      // share sheet dismissed
    }
  };

  if (!article) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textSecondary }}>{error ?? '未找到文章'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>分享卡片</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={cardRef} article={article} coverUri={coverUrl(article)} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {uri ? (
          <Pressable onPress={() => setPreviewOpen(true)} style={styles.previewBtn}>
            <Image source={{ uri }} style={styles.thumbnail} contentFit="contain" cachePolicy="memory" />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>点击查看大图</Text>
          </Pressable>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.textSecondary} />
            <Text style={[styles.hint, { color: theme.textSecondary }]}>{error ?? '正在生成黑白长图…'}</Text>
          </View>
        )}
        {error && uri ? <Text style={[styles.error, { color: theme.textSecondary }]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <Pressable onPress={generate} style={[styles.secondary, { borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>重新生成</Text>
        </Pressable>
        <Pressable onPress={save} disabled={!uri} style={[styles.secondary, { borderColor: theme.border }]}>
          {saved ? <Check size={18} color={theme.text} /> : <Download size={18} color={theme.text} />}
          <Text style={{ color: theme.text, fontWeight: '700' }}>{saved ? '已保存' : '保存图片'}</Text>
        </Pressable>
        <Pressable onPress={share} disabled={!uri} style={[styles.primary, { backgroundColor: theme.accent }]}>
          <Share2 size={18} color={theme.onAccent} />
          <Text style={{ color: theme.onAccent, fontWeight: '700' }}>分享</Text>
        </Pressable>
      </View>

      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewDismiss} onPress={() => setPreviewOpen(false)} />
          {uri ? <Image source={{ uri }} style={styles.previewImage} contentFit="contain" cachePolicy="memory" /> : null}
          <Pressable onPress={() => setPreviewOpen(false)} style={styles.previewClose} accessibilityLabel="关闭预览">
            <Text style={{ color: '#FFFFFF', fontSize: 28 }}>×</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 52, borderBottomWidth: 1 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  offscreen: { position: 'absolute', left: -10000, top: 0, opacity: 1 },
  content: { flexGrow: 1, alignItems: 'center', padding: 20 },
  previewBtn: { alignItems: 'center', gap: 10 },
  thumbnail: { width: 220, height: 420, borderRadius: 8, backgroundColor: '#F4F4F5' },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 80 },
  hint: { fontSize: 12 },
  error: { fontSize: 12, marginTop: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1 },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 14 },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 14 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  previewDismiss: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  previewImage: { width: '90%', height: '88%' },
  previewClose: { position: 'absolute', top: 40, right: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
