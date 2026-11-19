# Collect Native App v2.1.0 项目分析

## 架构

- 入口：Expo Router，`src/app/_layout.tsx` 为根布局；`(tabs)` 承载首页、收藏和个人页，文章详情、推荐、搜索、历史等为独立路由。
- 状态：主题设置使用 React Context（`SettingsProvider`）；内容状态以 SQLite 为本地事实源。
- 数据：首次启动依赖打包种子数据，运行期从静态 JSON 站点同步到 `expo-sqlite`；图片使用 `expo-image` 缓存与预取。
- 网络：原生 `fetch`；v2.1.0 增加条件请求、超时、有限重试和 NetInfo 网络类型判断。
- 原生能力：`expo-notifications`、`expo-background-task`、`expo-task-manager`、`expo-share-intent`、`react-native-view-shot`、`expo-media-library`、`expo-intent-launcher`。
- 动画：沿用 `react-native-reanimated`，并用 `useReducedMotion()` 响应系统减少动态效果。

## 关键模块

- `src/lib/db.ts`：初始化表、文章 upsert、收藏 / 历史 / 推荐列表、同步游标和通知去重表。
- `src/lib/sync.ts`：增量同步、顺失败、正文补拉与离线缓存刷新。
- `src/lib/notifications.ts`：通知权限、偏好、Android 渠道和通知负载。
- `src/lib/backgroundSync.ts`：TaskManager 任务与后台注册。
- `src/lib/links.ts`：网站 hash 路由与 App Link 路径解析、分享文本 URL 提取。
- `src/lib/incoming.ts`：跨冷启动 / 热启动来源的统一导航事件与去重。
- `src/components/ShareCard.tsx`：1080px 黑白长图卡片。
- `src/components/StateView.tsx`：统一空状态 / 错误状态。

## 服务端现状

- `articles.json` 与单篇 JSON 是静态文件，由 `scripts/extract-data.mjs` 从线上页面生成，再由 `scripts/deploy-data.sh` rsync 到 ATP。
- 线上列表当前返回 42 篇，与仓库种子完全一致；`ETag`、`Last-Modified` 与文章 `rev` 已存在。
- 没有可直接调用的增量 API、用户体系、鉴权或 push 服务。因此 v2.1.0 没有伪造这些接口，而是使用 HTTP 条件请求 + `rev` 实现增量语义。
- App Links 校验文件目前 404；`/article/<id>` 目前 404。两项都需要生产站点配置，属于明确的发布阻塞项。

## 发现与处理的问题

- `expo-background-fetch` 在 Expo SDK 58 中类型和行为不匹配，改用官方 `expo-background-task`。
- `expo-share-intent` 默认配置 iOS 插件需要 bundle identifier；本项目只做 Android，显式设置 `disableIOS: true` 后 prebuild 正常。
- 分享文本里的全角右括号会被当作 URL 字符，已扩展尾随标点清理规则。
- 通知一次性去重不能在发送前消耗，否则用户尚未授权时会永久错过提醒；改为只在实际发出通知后登记。
- 相同分享 URL 的重复事件不能按 URL 永久去重；改为按事件 ID 去重，并让每次新的分享获得独立事件 ID。
- 分享卡片路由的 handoff 状态曾被两个 lazy initializer 重复消费，改为单个初始化对象。
- 同步成功后需清除旧错误状态；失败正文单独记录 `failedIds`。

## 设计取舍

- 不引入新后端或 push SDK：站点当前是静态托管，缺少服务端能力时不能凭空实现真正推送。
- 不修改生产 nginx：只给出明确变更清单和验证脚本，避免影响线上站点。
- 不硬编码签名指纹：通过 release APK 生成 `assetlinks.json`，校验脚本可比对真实证书。
- 保持黑白主题与现有组件体系；新增 UI 只使用既有 token 与减少动态效果规则。
- 保持离线优先：上游移除文章时不删除本地数据，正文失败时仍保存列表元数据供阅读器重试。
