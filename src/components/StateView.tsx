import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '@/lib/theme';

/** Shared empty / error / offline state — one visual language across screens. */
export function StateView({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useSettings();
  return (
    <View style={styles.root} accessibilityRole="text">
      <View style={[styles.mark, { borderColor: theme.border }]} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {detail ? <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.action, { borderColor: theme.border }]}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  mark: { width: 28, height: 1, borderTopWidth: 1, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  detail: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  action: { marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
});
