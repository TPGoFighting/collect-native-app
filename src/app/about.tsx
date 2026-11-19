import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';

export default function AboutScreen() {
  const { theme, isDark } = useSettings();
  const router = useRouter();
  const logo = isDark
    ? require('@/assets/logo-white-1024.png')
    : require('@/assets/logo-black-1024.png');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>关于</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={logo} style={styles.logo} contentFit="contain" />
        <Text style={[styles.name, { color: theme.text }]}>Collect</Text>
        <Text style={[styles.version, { color: theme.textSecondary }]}>版本 2.1.0 · 原生安卓版</Text>
        <Text style={[styles.desc, { color: theme.text }]}>
          把微信、X、小红书、知乎的好文章收进一个口袋，随时离线阅读。文章来自
          collect.tpgofighting.top 的公开收录，App 启动时增量同步，断网也能读。
        </Text>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync('https://collect.tpgofighting.top').catch(() => {})}
          style={[styles.linkBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.linkText, { color: theme.text }]}>访问网站版 ↗</Text>
        </Pressable>
        <Text style={[styles.foot, { color: theme.textSecondary }]}>
          黑白设计 · 无账号 · 无追踪 · 不含任何 Google 服务
        </Text>
      </ScrollView>
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
  content: { padding: 24, alignItems: 'center' },
  logo: { width: 120, height: 120, marginTop: 16 },
  name: { fontSize: 24, fontWeight: '800', marginTop: 12 },
  version: { fontSize: 13, marginTop: 4 },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 20, textAlign: 'left' },
  linkBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 13, marginTop: 24 },
  linkText: { fontSize: 15, fontWeight: '700' },
  foot: { fontSize: 12, marginTop: 32, textAlign: 'center', lineHeight: 18 },
});
