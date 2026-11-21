import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/lib/theme';
import { RELEASE_PAGE_URL, checkForUpdate, type UpdateInfo } from '@/lib/updateCheck';

/** Silent update check + "new version available" row. Renders nothing when up to date. */
export function UpdateBanner() {
  const theme = useTheme();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    // Forced: the user is looking at this screen, so check right now
    // instead of serving a possibly stale 24h-throttled "nothing new".
    checkForUpdate({ force: true })
      .then(setUpdate)
      .catch(() => {});
  }, []);

  if (!update) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(update.url ?? RELEASE_PAGE_URL).catch(() => {})}
      style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`新版本 ${update.version} 可用，点击直接下载安装包`}
    >
      <Text style={[styles.text, { color: theme.text }]}>新版本 v{update.version} 可用 →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  text: { fontSize: 14, fontWeight: '700' },
});
