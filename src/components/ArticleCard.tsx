import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import type { ArticleMeta } from '@/lib/types';
import { useTheme } from '@/lib/theme';

export function coverUrl(a: ArticleMeta): string {
  return a.cover.includes('?') ? a.cover : `${a.cover}?rev=${a.rev}`;
}

export function ArticleCard({
  article,
  isRead,
  onPress,
}: {
  article: ArticleMeta;
  isRead: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Image
        source={{ uri: coverUrl(article) }}
        style={[styles.cover, { backgroundColor: theme.border }]}
        contentFit="cover"
        transition={150}
        cachePolicy="disk"
        recyclingKey={article.id}
      />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { borderColor: theme.border }]}>
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{article.pname}</Text>
          </View>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>{article.date}</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>约 {article.mins} 分钟</Text>
          {isRead ? <Check size={14} color={theme.textSecondary} /> : null}
        </View>
        <Text style={[styles.title, { color: isRead ? theme.textSecondary : theme.text }]} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={[styles.author, { color: theme.textSecondary }]} numberOfLines={1}>
          {article.author}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cover: { width: '100%', aspectRatio: 1200 / 615 },
  body: { padding: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  author: { fontSize: 13, marginTop: 4 },
});
