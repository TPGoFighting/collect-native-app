import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';
import { HistoryList, confirmClearHistory } from '@/components/HistoryList';

export default function HistoryScreen() {
  const { theme } = useSettings();
  const router = useRouter();

  const onClear = () => {
    confirmClearHistory();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>阅读历史</Text>
        <Pressable onPress={onClear} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="清除历史">
          <Trash2 size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <HistoryList contentContainerStyle={styles.listContent} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 52,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  listContent: { paddingBottom: 24, paddingTop: 12 },
});
