#Librum
一个极轻量的本地 Markdown Wiki 应用。

Librum 使用 Kotlin + Android WebView 构建，将 HTML/CSS/JavaScript 前端与 Android 原生存储桥接结合起来，为个人提供一个简单、离线优先的本地 Wiki。

## 特性

- WebView 加载 `app/src/main/assets/`
- JavaScript → `AndroidStorage` → Android 应用私有目录
- 浏览器预览时仍可回退到 localStorage
- Wiki 页面使用 `[[页面标题]]` / `[[页面标题|显示文字]]`
- 启动时进入“主页”，不存在则自动创建
- 内置轻量 Markdown 后备渲染器，可完全离线运行
- 无 INTERNET 权限
- targetSdk 36，适合 2026 年 Google Play 新应用要求

## 构建

需要 Android Studio / Android SDK / JDK 17+。

```bash
gradle :app:assembleDebug
gradle :app:bundleRelease
```

正式发布前请在 Android Studio 中配置自己的 release signing key。

生成的 Play Store 发布文件是：

`app/build/outputs/bundle/release/app-release.aab`
