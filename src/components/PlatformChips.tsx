import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { PLATFORMS } from '@/lib/types';
import { useTheme } from '@/lib/theme';

export function PlatformChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (p: string) => void;
}) {
  const theme = useTheme();
  const items = ['all', ...PLATFORMS];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((p) => {
        const active = selected === p;
        return (
          <Pressable
            key={p}
            onPress={() => onSelect(p)}
            hitSlop={6}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.accent : 'transparent',
                borderColor: active ? theme.accent : theme.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: active ? theme.onAccent : theme.text }]}>
              {p === 'all' ? '全部' : p}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600' },
});
