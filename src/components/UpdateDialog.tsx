import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/lib/theme';
import {
  RELEASE_PAGE_URL,
  checkForUpdate,
  dismissUpdate,
  getDismissedUpdateVersion,
  shouldShowUpdateDialog,
  type UpdateInfo,
} from '@/lib/updateCheck';

/**
 * Launch update dialog: pops once per new version when the app opens.
 * "稍后再说" dismisses that version (the Home banner keeps reminding);
 * "立即更新" opens the direct APK link and hides for this session only,
 * so the dialog pops again on the next launch until the update is installed.
 * Never throws and never blocks launch: any failure means no dialog.
 */
export function UpdateDialog() {
  const theme = useTheme();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = Constants.expoConfig?.version;
      if (!current) return;
      const [info, dismissed] = await Promise.all([
        checkForUpdate({ force: true }).catch(() => null),
        getDismissedUpdateVersion(),
      ]);
      if (!cancelled && info && shouldShowUpdateDialog(info.version, current, dismissed)) {
        setUpdate(info);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;
  const current = Constants.expoConfig?.version ?? '';
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setUpdate(null)}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>发现新版本 v{update.version}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            当前版本 v{current}，已有新版本可用，点击立即更新下载安装包。
          </Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={() => {
                dismissUpdate(update.version).catch(() => {});
                setUpdate(null);
              }}
              style={[styles.button, styles.ghost, { borderColor: theme.border }]}
              accessibilityRole="button"
              accessibilityLabel="稍后再说"
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>稍后再说</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Linking.openURL(update.url ?? RELEASE_PAGE_URL).catch(() => {});
                setUpdate(null);
              }}
              style={[styles.button, { backgroundColor: theme.accent }]}
              accessibilityRole="button"
              accessibilityLabel={`立即更新到 v${update.version}`}
            >
              <Text style={[styles.buttonText, { color: theme.onAccent }]}>立即更新</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ghost: { borderWidth: 1 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
