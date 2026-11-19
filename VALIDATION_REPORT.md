# Collect Native App v2.1.0 验证报告

## 项目分析

- 技术栈：Expo SDK 58 / React Native 0.88.1 / React 19.3.0 / Expo Router。
- 数据层：`expo-sqlite` 同步 API，离线优先；启动时加载打包的 `assets/seed-data/seed.json`（42 篇文章）。
- 服务端：当前是静态 JSON 站点，`https://collect.tpgofighting.top/data/articles.json` 提供列表，单篇详情在 `/data/articles/<id>.json`；仓库中没有后端 API、鉴权或 push 服务。
- 增量能力：线上列表已经返回 `ETag` 与 `Last-Modified`，文章对象含 `rev`。v2.1.0 用这些现有字段做条件请求和变更检测，没有假设不存在的服务端接口。
- 设计系统：`src/lib/theme.tsx` 中的 zinc 黑白 token；动画使用现有 `react-native-reanimated`。
- 发布：GitHub Actions 使用 Expo prebuild + Gradle assembleRelease，不使用 EAS Build。
- 原生范围：Android 包名 `top.tpgofighting.collect`；iOS 分享插件显式关闭。

## 已实现

1. 启动 / 前台增量同步，OS 限额内的后台同步，失败重试、离线缓存与状态记录。
2. 新文章通知权限与偏好设置、单次提醒、通知点击直达文章。
3. Android 系统文本分享入口，链接提取、推荐页预填、事件级去重和反馈。
4. `collect.tpgofighting.top/article/<id>` App Links 意图过滤器与自动校验配置，对应解析和容错。
5. 1080px 黑白长图分享卡片，预览、保存相册、系统分享。
6. 统一空状态 / 错误状态组件与低动态效果感知的可逆按压反馈。

## 通过的验证

本地与线上数据检查：

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npx eslint src/ __tests__/` | 通过，0 errors / 0 warnings |
| `npm test` | 15 checks, 0 failures |
| `npm test -- --live` | 18 checks, 0 failures；线上 42 篇与种子一致，rev 全部匹配 |
| `npm run test:v210` | 8 checks passed |
| `npm run test:unit` | 1 suite / 4 tests passed |
| `npx expo prebuild --platform android --non-interactive --no-install` | 成功；生成 Manifest 中包含 App Links、分享与 `singleTask` 配置 |
| 生成 Manifest 检查 | `versionCode 4` / `versionName 2.1.0`；`collect.tpgofighting.top` 的 `/article/` 与 `/` HTTPS intent filter 均为 `autoVerify="true"` |
| 线上增量请求头检查 | `/data/articles.json` 返回 `ETag`、`Last-Modified` |
| 分享去重测试 | 同一事件只导航一次，新的相同内容分享事件可再次导航 |

GitHub Actions 云构建（run 44523810077）：

| 步骤 | 结果 |
| --- | --- |
| Typecheck / Lint / 三组测试 | 全部通过 |
| Decode release keystore / Expo prebuild / 签名配置 | 全部通过 |
| Build release APK | 成功，产物 22,833,521 字节 |
| Verify APK | 包名、versionCode 4、versionName 2.1.0、30 MB 限制全部通过 |
| Verify APK signature | keystore 与 APK 指纹一致：`02:E2:4B:37:6E:1E:95:BD:1A:0F:95:F5:A5:9E:FF:A4:3B:1B:D7:6C:33:FC:6B:19:0D:DE:58:6E:3E:D4:D9:50` |
| Upload APK artifact / Create GitHub Release | 成功，Release 包含 `collect-v2.1.0.apk` |

生产站点验证：

| 项目 | 结果 |
| --- | --- |
| `node scripts/verify-assetlinks.mjs <release_sha256>` | OK：线上文件存在，指纹与正式 release APK 一致，Content-Type 为 `application/json` |
| `https://collect.tpgofighting.top/article/chromium` | HTTP 200 / `text/html`，已回退到首页客户端路由 |
| `https://collect.tpgofighting.top/article/does-not-exist` | HTTP 200 / `text/html`，不存在的文章由 App 显示错误状态 |
| `https://collect.tpgofighting.top/data/articles.json` | HTTP 200 / `application/json`，42 篇与种子一致 |

## 启动崩溃诊断与修复（云端真机验证）

- 症状：手机安装 v2.1.0 后打开即闪退。
- 诊断：新增 `.github/workflows/diagnose-android.yml`（GitHub Actions 云端 Android 模拟器 + logcat 抓取）。logcat 显示启动阶段（JS 未运行）即崩溃：
  `Unable to get provider androidx.startup.InitializationProvider: java.lang.NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []`
- 根因：`expo-background-task` 依赖 AndroidX WorkManager；其启动初始化器通过反射构造 Room 生成的 `WorkDatabase_Impl`，R8 minify 移除了该构造函数。
- 修复：`plugins/withWorkManagerKeepRules.js` 在 release 构建注入 ProGuard keep 规则；回归测试 `npm run test:release-crash` 已接入 CI。
- 云端复验（run 44558542838，API 35 模拟器）：`adb install` Success、`MainActivity` Displayed、`ReactNativeJS: Running "main"`、全程 0 次 FATAL EXCEPTION。

## 仍受限的验证

- 没有 Android 设备或模拟器，以下行为只完成了静态配置、云构建、单元测试和 Manifest 检查，尚未做真机验证：
  - 后台同步实际触发频率与省电策略表现；
  - 系统通知展示、权限变更与点击跳转；
  - 微信 / X / 浏览器冷启动、热启动分享；
  - 已校验 App Links 的跳转、返回栈与长图保存 / 系统分享。
- 当前站点没有服务端事件或 push API，后台可达性依赖系统调度，不能承诺实时提醒。
- `/data/*` 未设置 `Cache-Control: no-cache`；App 使用小时级 cache-buster 兜底，不影响功能。

## 已执行的部署操作

- 提交 `feat/v2.1.0` 并推送到 GitHub。
- 推送 tag `v2.1.0`，由 GitHub Actions 完成云构建、签名和 Release 发布。
- 在 ATP 生产服务器上备份并更新 `/etc/nginx/sites-enabled/collect`：
  - 增加 `/.well-known/assetlinks.json` 精确 location；
  - 增加 `^~ /article/` 到 `index.html` 的回退；
  - `nginx -t` 通过后 `systemctl reload nginx`。
  - 原配置备份在 `/etc/nginx/sites-available/collect.bak.20261119`。
- 部署 `/var/www/collect/.well-known/assetlinks.json`，使用 CI 正式签名 APK 的证书指纹。
- 没有生成、导入或导出签名密钥；签名全部在 GitHub Actions 中使用既有 secrets 完成。
