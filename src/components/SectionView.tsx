import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Section } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { RichText } from '@/lib/richtext';
import { ChartView } from './ChartView';

export interface ViewerImage {
  url: string;
  caption: string;
}

export function SectionView({
  section,
  fontSize,
  lineHeight,
  images,
  imageIndex,
  onImagePress,
  onLinkPress,
}: {
  section: Section;
  fontSize: number;
  lineHeight: number;
  images: ViewerImage[];
  imageIndex: number; // index of this section's image within `images`, -1 if not an image
  onImagePress: (index: number) => void;
  onLinkPress: (url: string) => void;
}) {
  const theme = useTheme();
  const lh = Math.round(fontSize * lineHeight);

  switch (section.type) {
    case 'heading': {
      const size = section.level === 2 ? 19 : section.level === 3 ? 17 : 16;
      return (
        <Text
          style={[
            styles.heading,
            { color: theme.text, fontSize: size, lineHeight: Math.round(size * 1.4), marginTop: section.level === 2 ? 24 : 18 },
          ]}
        >
          {section.text}
        </Text>
      );
    }
    case 'paragraph':
      return (
        <RichText
          text={section.text}
          onLinkPress={onLinkPress}
          style={{
            color: theme.text,
            fontFamily: 'serif',
            fontSize,
            lineHeight: lh,
            marginBottom: 12,
          }}
        />
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderColor: theme.accent, backgroundColor: theme.surface }]}>
          <RichText
            text={section.text}
            onLinkPress={onLinkPress}
            style={{ color: theme.text, fontFamily: 'serif', fontSize, lineHeight: lh }}
          />
        </View>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {section.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={[styles.bullet, { color: theme.text, fontSize, lineHeight: lh }]}>
                {section.ordered ? `${i + 1}.` : '•'}
              </Text>
              <RichText
                text={item}
                onLinkPress={onLinkPress}
                style={{ flex: 1, color: theme.text, fontFamily: 'serif', fontSize, lineHeight: lh }}
              />
            </View>
          ))}
        </View>
      );
    case 'image':
      return (
        <Pressable onPress={() => imageIndex >= 0 && onImagePress(imageIndex)} style={styles.figure}>
          <Image
            source={{ uri: section.url }}
            style={[styles.figureImage, { backgroundColor: theme.border }]}
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
            recyclingKey={section.url}
          />
          {section.caption ? (
            <Text style={[styles.caption, { color: theme.textSecondary }]}>{section.caption}</Text>
          ) : null}
        </Pressable>
      );
    case 'chart':
      return (
        <ChartView
          title={section.title}
          subtitle={section.subtitle}
          unit={section.unit}
          bars={section.bars}
        />
      );
    case 'callout':
      return (
        <View style={[styles.callout, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <RichText
            text={section.text}
            onLinkPress={onLinkPress}
            style={{ color: theme.text, fontFamily: 'serif', fontSize: fontSize - 1, lineHeight: Math.round((fontSize - 1) * lineHeight) }}
          />
        </View>
      );
    case 'link':
      return (
        <Pressable onPress={() => onLinkPress(section.url)} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: theme.text }]} numberOfLines={2}>
            {section.text} ↗
          </Text>
        </Pressable>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  heading: { fontWeight: '700', marginBottom: 8 },
  quote: { borderLeftWidth: 3, paddingVertical: 12, paddingHorizontal: 14, marginVertical: 10 },
  list: { marginBottom: 12 },
  listRow: { flexDirection: 'row', marginBottom: 6 },
  bullet: { width: 20, flexShrink: 0 },
  figure: { marginVertical: 10 },
  figureImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8 },
  caption: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  callout: { borderWidth: 1, borderRadius: 12, padding: 14, marginVertical: 10 },
  linkRow: { paddingVertical: 10 },
  linkText: { fontSize: 15, textDecorationLine: 'underline' },
});
