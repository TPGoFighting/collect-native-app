# Collect Native App v2.1.0 发布说明

## 本次版本内容

v2.1.0 完成增量同步、新文章本地通知、系统分享入口、App Links 和阅读页黑白长图分享卡片。
完整变更见 [CHANGELOG.md](CHANGELOG.md)。

## 构建方式

CI：`.github/workflows/build.yml`，push main 或 tag `v*` 后构建 release APK。
流程为 `npm ci` → 测试 → `expo prebuild --platform android` → `gradlew assembleRelease`；不使用 EAS Build。

已使用 tag `v2.1.0` 触发 GitHub Actions 云构建并成功产出正式签名 APK：

- 最新构建运行（含启动崩溃修复）：tag `v2.1.0` 指向 commit `3f4b661`，构建成功并已更新 Release 产物。
- GitHub Release：https://github.com/TPGoFighting/collect-native-app/releases/tag/v2.1.0
- 产物：`collect-v2.1.0.apk`（22,957,926 字节，SHA-256 `c7a5ac58da3fd1af6c96e5affe3394be0df5ab3ce08434b20a1f99bf0dbcf768`）
- APK 校验：包名 `top.tpgofighting.collect`、versionCode 4、versionName 2.1.0、签名校验通过。
- 云端真机验证：GitHub Actions Android 模拟器（API 35）实测安装、启动、JS 运行全部通过，logcat 无 FATAL；早期构建因 R8 移除 WorkManager `WorkDatabase_Impl` 构造函数导致启动闪退，已通过 `plugins/withWorkManagerKeepRules.js` 修复。

本地构建不是发布前置条件；若本机具备 JDK 与 Android SDK，可运行：

```bash
npm ci
npm run typecheck
npm test
npm run test:v210
npm run test:unit
npx expo prebuild --platform android --non-interactive
cd android && ./gradlew assembleRelease
```

## 签名要求

- Android 包名：`top.tpgofighting.collect`。
- versionCode：4；versionName：2.1.0。
- release 证书 SHA-256：`02:E2:4B:37:6E:1E:95:BD:1A:0F:95:F5:A5:9E:FF:A4:3B:1B:D7:6C:33:FC:6B:19:0D:DE:58:6E:3E:D4:D9:50`。
- CI secrets：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。
- 证书公钥指纹不是私钥或签名文件，已写入仓库中的 `server/assetlinks.json` 供域名校验。
- 旧版 v1.x 是 debug 签名，不能直接覆盖升级；从 v2.0.0 起使用正式 release 签名，v2.x 用户可直接覆盖升级。

## 服务端变更状态

1. App Links 校验文件已部署：
   `https://collect.tpgofighting.top/.well-known/assetlinks.json`
   - Content-Type：`application/json`。
   - 指纹来自 CI 正式签名 APK，并通过 `node scripts/verify-assetlinks.mjs <release_sha256>` 校验。
2. `/article/<id>` 浏览器回退已配置：
   - nginx 将 `/article/*` 回退到 `index.html`。
   - 实测 `https://collect.tpgofighting.top/article/chromium` 返回 200 / `text/html`。
3. `/data/*` 目前未设置 `Cache-Control: no-cache`；App 使用 `articles.json?v=<小时>` 兜底，不影响发布。
4. 数据发布继续使用 `bash scripts/deploy-data.sh`；脚本会在发布后检查
   `assetlinks.json` 是否生效。部署后请提交刷新过的 `assets/seed-data`。

## 安装与验证

- 从 GitHub Release 下载 `collect-v2.1.0.apk` 安装。
- 验证覆盖升级：从 v2.0.0 安装 v2.1.0。
- 验证分享：微信 / X / 浏览器分享链接到 Collect，确认推荐页预填、重复分享不重复导航。
- 验证 App Links：点击 `https://collect.tpgofighting.top/article/chromium`，确认进入阅读页；冷启动、热启动和返回栈各测一次。
- 验证通知：授予权限后等待新文章发现，确认通知只响一次，点击后进入对应文章；拒绝权限不应消耗提醒资格。
- 验证分享卡片：阅读页打开图片分享，确认预览、保存相册和系统分享正常。

## 注意事项

- 后台同步遵循 Android 系统省电策略，不是实时推送。
- 当前服务端是静态 JSON，没有真正的增量 API 或 push 服务；增量判断依赖 ETag / Last-Modified 与文章 `rev`。
- GitHub Actions 已验证构建、打包和签名；当前环境没有 Android 设备或模拟器，真机层面的后台任务、通知、分享、App Links 跳转与图片保存仍需安装 APK 后验证。
- 发布之后若 App Links 仍无法打开，先用 `node scripts/verify-assetlinks.mjs` 确认线上校验文件，再检查 APK 签名是否与文件指纹一致。
