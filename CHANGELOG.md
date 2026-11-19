# Changelog

## v2.1.0

### 新功能

- 增量同步：启动与回到前台时通过 ETag / Last-Modified 检查线上文章列表，按 `rev` 只拉取变化的正文并刷新本地 SQLite 与离线缓存。
- 后台同步：通过 `expo-background-task` 注册系统限额内的周期性同步；网络失败、正文失败和 Wi-Fi 限制都有明确状态与重试。
- 新文章通知：新增系统通知权限与偏好设置（所有网络 / 仅 Wi-Fi / 关闭），每篇真正新文章最多提醒一次；点击通知直接进入对应文章。
- 系统分享：注册 Android 文本分享目标，微信 / X / 浏览器分享链接会自动提取 URL、打开推荐页并预填内容；重复事件不会重复导航或提交。
- App Links：识别 `collect.tpgofighting.top/article/<id>`，支持冷启动、热启动、重复点击与返回；不支持或失效的链接安全降级。
- 黑白长图分享卡片：阅读页新增基于 1080px 宽长图的编辑风格分享卡片，支持预览、保存相册与系统分享。
- 统一状态视图：首次使用、空列表、加载、离线、同步失败、网络错误、文章不存在等状态使用同一套主题组件。
- 轻量动效：新增遵循 Reanimated 与系统「减少动态效果」设置的按压反馈。

### 优化

- 保留离线优先策略；线上列表不可达时继续使用本地缓存，不再清空本地文章。
- 同步失败信息写入本地状态，首页和通知设置页可直接查看。
- 分享链接解析集中在 `src/lib/links.ts`，同时支持当前网站 hash 路由与新的 App Link 路径。
- CI 增加单元与 v2.1.0 专项测试，版本号与产物名称统一到 2.1.0。
- 更新 README 的版本与升级说明，修正 v2.x 起使用正式 release 签名的描述。

### 兼容性

- Android 包名：`top.tpgofighting.collect`。
- versionCode 4 / versionName 2.1.0；已安装 v2.x 的用户可直接覆盖升级。
- 旧版 v1.x 使用 debug 签名，不能直接覆盖升级到 v2.1.0。
- 本项目仅启用 Android；`expo-share-intent` 的 iOS 配置已显式关闭。

### 发布状态

- GitHub Actions 已产出并签名 `collect-v2.1.0.apk`，Release 已发布。
- `https://collect.tpgofighting.top/.well-known/assetlinks.json` 已部署正式 release 证书指纹，线上校验通过。
- `https://collect.tpgofighting.top/article/<id>` 已配置浏览器回退，未安装 App 时返回首页客户端路由。
- 后台同步频率由 Android 系统省电策略决定，非实时推送；当前站点是静态 JSON，没有服务端事件推送能力。
