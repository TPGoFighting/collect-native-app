import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSettings } from '@/lib/theme';

export default function PrivacyScreen() {
  const { theme } = useSettings();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="返回">
          <ArrowLeft size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>隐私政策</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: theme.textSecondary }]}>最后更新：2025 年 6 月</Text>

        <Text style={[styles.p, { color: theme.text }]}>
          Collect 是一款离线优先的文章阅读器。我们只做一件事：把你收藏阅读的文章完整地放到你的手机上。下面如实说明这款
          App 如何处理数据。
        </Text>

        <Text style={[styles.h, { color: theme.text }]}>数据全部存放在你的手机里</Text>
        <Text style={[styles.p, { color: theme.text }]}>
          你的收藏、阅读历史、阅读进度、搜索记录和待推荐链接都保存在本机的应用存储中，不与任何账号绑定。卸载
          App 即全部删除。你可以随时在「我的 → 备份与恢复」中把数据导出为文件，自行保管。
        </Text>

        <Text style={[styles.h, { color: theme.text }]}>不采集，不上报</Text>
        <Text style={[styles.p, { color: theme.text }]}>
          App 不包含任何统计、崩溃上报或广告 SDK，不收集你的设备信息、位置、通讯录或行为数据，不向任何服务器发送你的使用记录。唯一的网络请求是向内容站点
          collect.tpgofighting.top 拉取文章内容与更新。
        </Text>

        <Text style={[styles.h, { color: theme.text }]}>无账号，无追踪</Text>
        <Text style={[styles.p, { color: theme.text }]}>
          使用本 App 不需要注册任何账号。我们不植入广告标识符或追踪组件，也不会跨应用跟踪你。
        </Text>

        <Text style={[styles.h, { color: theme.text }]}>权限使用说明</Text>
        <Text style={[styles.p, { color: theme.text }]}>
          通知权限：仅用于在发现新收录文章时向你发送提醒。不开启不影响任何阅读功能，你也可以在系统设置或
          App 的通知偏好中随时关闭。
        </Text>
        <Text style={[styles.p, { color: theme.text }]}>
          媒体库写入权限：仅在你主动点击「保存图片」把文章分享长图存入相册时使用。不会读取或上传相册中的其他内容。
        </Text>

        <Text style={[styles.h, { color: theme.text }]}>联系方式</Text>
        <Text style={[styles.p, { color: theme.text }]}>
          如果你对本政策或数据处理有任何疑问，可以通过 collect.tpgofighting.top 站点上的方式联系站长。
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
  content: { padding: 24 },
  updated: { fontSize: 12, marginBottom: 16 },
  h: { fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  p: { fontSize: 15, lineHeight: 24 },
});
