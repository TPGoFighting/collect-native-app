# Collect 原生安卓版

Collect（collect.tpgofighting.top）的原生 Android 阅读器：离线可读的口袋阅读器，不是套壳 WebView。

- **离线全文**：首启即带 42 篇文章全文种子包，无网也能读；启动与下拉刷新时增量同步新文章。
- **原生阅读**：目录抽屉、3px 阅读进度条、原生条形图、图片查看器（双指缩放）、字号五档 / 行距两档 / 纯黑夜间。
- **三 Tab**：首页（时间线 + 平台筛选）/ 收藏（收藏 + 阅读历史）/ 我的（阅读设置、推荐文章、清除缓存、关于）。
- **黑白设计**：zinc 黑白、无彩色 accent、无 emoji、SVG 线性图标；不含任何 Google 服务，不登录。

## 数据来源

网站每次部署多产三份文件（`scripts/deploy-data.sh` 一键抽取 + 部署）：

- `/data/articles.json` — 文章清单（`{schema_version, updated_at, count, articles[]}`）
- `/data/articles/<id>.json` — 单篇全文（8 种章节：heading / paragraph / quote / list / image / chart / callout / link）
- `/assets/covers/<id>.webp` — 封面；正文图片在 `/assets/images/`

App 启动拉清单、按 `rev` 增量下载正文，封面懒加载进图片缓存（上限 200MB）。

## 开发

```bash
npm ci
npm run typecheck   # tsc --noEmit
npx eslint src/     # lint
npm test            # node scripts/test-offline.mjs（种子 schema + 同步合并模拟）
npm run android     # 需要本地 Android SDK；MTP 上无安卓环境，构建走 CI
```

数据更新（从线上站抽取并部署到 ATP，种子一并刷新）：

```bash
bash scripts/deploy-data.sh   # 抽取 -> rsync -> chmod -R a+rX -> 公网验证
```

## 发布

GitHub Actions（`.github/workflows/build.yml`）：push 到 main 或打 tag `v*` 即构建
release APK（Expo prebuild + Gradle assembleRelease，**不用 EAS Build**）。

- 包名 `top.tpgofighting.collect`，v2.0.0 / versionCode 3，单 ABI arm64-v8a。
- Release 签名：新生成的 keystore（`collect-release.p12`，openssl 生成，备份在
  `keystore/`，密码在 `keystore/store-password.txt`——**请抄进 1Password**）。
  旧版 v1.x 是 debug 签名，**无法覆盖升级：老用户必须先卸载旧版再装 v2.0.0**。
- Secrets：`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` /
  `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`。

## 待 TP 批准

- nginx 给 `/data/*` 加 `Cache-Control: no-cache`（配置片段见产品设计文档 §4.4；
  未改之前 App 用 `articles.json?v=<小时>` 缓存破坏参数兜底）。
