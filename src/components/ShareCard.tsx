import React from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Image } from 'expo-image';
import type { Article } from '@/lib/types';
import { appLinkArticleUrl } from '@/lib/links';

export const SHARE_CARD_WIDTH = 1080;

/** Editorial black & white card, fixed at 1080px width for crisp social export. */
export const ShareCard = React.forwardRef<ViewInstance, { article: Article; coverUri?: string }>(
  function ShareCard({ article, coverUri }, ref) {
    const summary = (article.summary || '').trim().slice(0, 120);
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <View style={styles.top}>
          <Text style={styles.brand}>COLLECT</Text>
          <Text style={styles.brandSub}>TPGOFIGHTING.TOP</Text>
        </View>
        {coverUri ? <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" cachePolicy="disk" /> : null}
        <View style={styles.body}>
          <Text style={styles.kicker}>
            {article.pname} · {article.date}
          </Text>
          <Text style={styles.title} numberOfLines={7}>
            {article.title}
          </Text>
          <View style={styles.rule} />
          {summary ? <Text style={styles.summary} numberOfLines={5}>{summary}</Text> : null}
          {article.author ? <Text style={styles.author} numberOfLines={1}>{article.author}</Text> : null}
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>READ ON COLLECT</Text>
            <Text style={styles.footerUrl} numberOfLines={1}>
              {appLinkArticleUrl(article.id)}
            </Text>
            <Text style={styles.footerNote}>长按识别链接 · 在 Collect 中阅读</Text>
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, backgroundColor: '#FFFFFF', padding: 72 },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  brand: { fontSize: 46, fontWeight: '900', letterSpacing: 10, color: '#09090B' },
  brandSub: { fontSize: 20, letterSpacing: 3, color: '#71717A' },
  cover: { width: '100%', height: 500, marginTop: 56, backgroundColor: '#F4F4F5' },
  body: { paddingTop: 64 },
  kicker: { fontSize: 22, letterSpacing: 2, color: '#71717A', marginBottom: 28 },
  title: { fontSize: 66, lineHeight: 82, fontWeight: '800', letterSpacing: -1, color: '#09090B' },
  rule: { height: 1, backgroundColor: '#09090B', width: 120, marginVertical: 48 },
  summary: { fontSize: 28, lineHeight: 46, color: '#3F3F46' },
  author: { fontSize: 24, color: '#71717A', marginTop: 28 },
  footer: { marginTop: 72, paddingTop: 32, borderTopWidth: 2, borderTopColor: '#09090B' },
  footerLabel: { fontSize: 20, fontWeight: '800', letterSpacing: 4, color: '#09090B' },
  footerUrl: { fontSize: 22, color: '#52525B', marginTop: 16 },
  footerNote: { fontSize: 18, color: '#A1A1AA', marginTop: 10 },
});
