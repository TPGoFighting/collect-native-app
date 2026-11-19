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

以下命令均在 `feat/v2.1.0` 分支、当前工作区执行：

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

## 失败 / 未通过的验证

| 项目 | 结果 | 处理 |
| --- | --- | --- |
| `node scripts/verify-assetlinks.mjs` | FAIL：`https://collect.tpgofighting.top/.well-known/assetlinks.json` HTTP 404 | 需要发布真实 release 签名指纹生成的校验文件 |
| `https://collect.tpgofighting.top/article/chromium` | HTTP 404 | 需要 nginx 回退到 `index.html` 或站点增加等价路由 |

以上为服务端现状，不是代码测试失败；未擅自修改生产配置。

## 环境受限项

- 本机缺少 JDK / Android SDK，无法构建 release APK，也无法用 `apksigner` 生成或验证签名指纹。
- 没有 release keystore 与 CI secrets，未进行签名、部署或密钥相关高风险操作。
- 没有 Android 设备或模拟器，以下行为只完成了静态配置、单元测试和 Manifest 检查，尚未做真机验证：
  - 后台同步实际触发频率与省电策略表现；
  - 系统通知展示、权限变更与点击跳转；
  - 微信 / X / 浏览器冷启动、热启动分享；
  - 已校验 App Links、返回栈与长图保存 / 系统分享。
- 当前站点没有服务端事件或 push API，后台可达性依赖系统调度，不能承诺实时提醒。

## 未执行的操作

- 没有提交或推送代码。
- 没有修改生产 nginx 配置。
- 没有部署 `assetlinks.json`。
- 没有生成、导入或导出签名密钥。
