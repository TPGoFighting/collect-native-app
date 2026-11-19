import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChartBar } from '@/lib/types';
import { useTheme } from '@/lib/theme';

// Native horizontal bar chart (design doc 4.3/5.2). Bars are data, never images.
// Pure Views (no SVG): label | track with bar | value. Negative values diverge
// around a center zero line.
export function ChartView({
  title,
  subtitle,
  unit,
  bars,
}: {
  title: string;
  subtitle: string;
  unit: string;
  bars: ChartBar[];
}) {
  const theme = useTheme();
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  const diverging = bars.some((b) => b.value < 0);

  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      {bars.map((b, i) => {
        const pct = (Math.abs(b.value) / maxAbs) * 100;
        const w = diverging ? pct / 2 : pct;
        return (
          <View key={i} style={styles.row}>
            <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
              {b.label}
            </Text>
            <View style={styles.track}>
              {diverging ? <View style={[styles.zero, { backgroundColor: theme.faint }]} /> : null}
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(w, 2)}%`,
                    backgroundColor: b.value >= 0 ? theme.accent : theme.faint,
                    ...(diverging
                      ? b.value >= 0
                        ? { left: '50%' }
                        : { right: '50%' }
                      : { left: 0 }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
              {b.display}
            </Text>
          </View>
        );
      })}
      {unit ? <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 14, marginVertical: 10 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', width: 76, flexShrink: 0 },
  track: { flex: 1, height: 22, position: 'relative', justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, height: 22, borderRadius: 4 },
  zero: { position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1 },
  value: { fontSize: 13, fontWeight: '700', marginLeft: 8, flexShrink: 0 },
  unit: { fontSize: 12, marginTop: 4 },
});
