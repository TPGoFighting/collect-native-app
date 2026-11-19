# Collect Native App v2.1.0 发布说明

## 本次版本内容

v2.1.0 完成增量同步、新文章本地通知、系统分享入口、App Links 和阅读页黑白长图分享卡片。
完整变更见 [CHANGELOG.md](CHANGELOG.md)。

## 构建方式

CI：`.github/workflows/build.yml`，push main 或 tag `v*` 后构建 release APK。
流程为 `npm ci` → 测试 → `expo prebuild --platform android` → `gradlew assembleRelease`；不使用 EAS Build。

本地构建：

```bash
npm ci
npm run typecheck
npm test
npm run test:v210
npm run test:unit
npx expo prebuild --platform android --non-interactive
cd android && ./gradlew assembleRelease
```

本地环境需要 JDK 与 Android SDK。当前开发机没有完整 Android 构建环境，无法在本机产出或验证 release APK。

## 签名要求

- Android 包名：`top.tpgofighting.collect`。
- versionCode：4；versionName：2.1.0。
- CI secrets：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。
- 不得把 keystore、密码或签名指纹硬编码进仓库。
- 旧版 v1.x 是 debug 签名，不能直接覆盖升级；从 v2.0.0 起使用正式 release 签名，v2.x 用户可直接覆盖升级。

## 服务端变更清单（发布前必须完成）

1. 生成 App Links 校验文件：
   - 用正式 release APK 计算证书指纹。`apksigner verify --print-certs app-release.apk` 输出的
     SHA-256 指纹用于生成 `server/assetlinks.json`。
   - 可运行 `ANDROID_HOME=/path/to/sdk bash scripts/make-assetlinks.sh path/to/app-release.apk`；
     不要部署占位符 `REPLACE_WITH_RELEASE_CERT_SHA256_UPPERCASE_COLON_SEPARATED`。
2. 将生成的 `server/assetlinks.json` 部署到：
   `https://collect.tpgofighting.top/.well-known/assetlinks.json`
   - Content-Type 必须是 `application/json`，内容必须可由公网匿名访问。
   - 当前实测：HTTP 404，App Links 尚未通过域名校验。
   - 验证命令：`node scripts/verify-assetlinks.mjs <release_sha256>`。
3. 为 App Link 路径配置浏览器回退：
   - `https://collect.tpgofighting.top/article/<id>` 当前实测 HTTP 404。
   - nginx 应将 `/article/*` 回退到 `index.html`，或站点增加等价路由，避免未安装 App 时浏览器报错。
4. 可选缓存优化：按现有设计为 `/data/*` 设置 `Cache-Control: no-cache`；未配置时 App 使用
   `articles.json?v=<小时>` 作为兜底。
5. 数据发布：使用 `bash scripts/deploy-data.sh` 从线上站点抽取并部署；脚本会在发布后检查
   `assetlinks.json` 是否生效。部署后请提交刷新过的 `assets/seed-data`。

## 安装与验证

- 通过 CI artifact 获取 `collect-v2.1.0.apk`，使用 release 签名安装。
- 验证覆盖升级：从 v2.0.0 安装 v2.1.0。
- 验证分享：微信 / X / 浏览器分享链接到 Collect，确认推荐页预填、重复分享不重复导航。
- 验证 App Links：在域名校验文件部署后，点击
  `https://collect.tpgofighting.top/article/chromium`，确认进入阅读页；冷启动、热启动和返回栈各测一次。
- 验证通知：授予权限后等待新文章发现，确认通知只响一次，点击后进入对应文章；拒绝权限不应消耗提醒资格。
- 验证分享卡片：阅读页打开图片分享，确认预览、保存相册和系统分享正常。

## 注意事项

- 后台同步遵循 Android 系统省电策略，不是实时推送。
- 当前服务端是静态 JSON，没有真正的增量 API 或 push 服务；增量判断依赖 ETag / Last-Modified 与文章 `rev`。
- 当前环境没有 Android SDK、签名密钥、设备或模拟器，真机层面的后台任务、通知、分享和 App Links 行为尚未验证。
- 发布之后若 App Links 仍无法打开，先用 `node scripts/verify-assetlinks.mjs` 确认线上校验文件，再检查 APK 签名是否与文件指纹一致。
