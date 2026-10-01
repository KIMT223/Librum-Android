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

## License

Librum is free and open-source software licensed under the
GNU General Public License, version 3 (GPL-3.0).

Copyright (C) 2026 Librum Contributors

You are free to use, study, modify, and redistribute Librum
under the terms of the GNU General Public License version 3.

A copy of the GNU General Public License is included in the
`LICENSE` file in this repository.

For more information, see:
https://www.gnu.org/licenses/gpl-3.0.html
