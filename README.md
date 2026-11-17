# 墨阅 · Moyue

一个安静、本地优先的桌面 EPUB / TXT 阅读器，带书架分类、在线书城和本地音乐播放。

没有账号，没有云端同步。书籍、阅读进度、分类和音乐都留在这台电脑上。

## 下载

Windows 10/11 安装包：[GitHub Releases](https://github.com/Langlijun666/moyue-reader/releases)

安装包当前未做代码签名，Windows SmartScreen 可能提示「未知发布者」；选择「更多信息」→「仍要运行」即可。

![安装程序](docs/installer.png)

![墨阅首页](docs/home.png)

## Android

Android 版已完成第一轮移植：书架、EPUB / TXT / PDF / MOBI / AZW3 阅读、目录、划线笔记和书城复用桌面端代码；手机端不包含本地音乐、离线听书和自动更新。

目前只提供 **arm64 调试包**（debug 签名），适合真机试用，不适合直接上架：

- 安装包在构建后输出到 `release/android/moyue-android-<版本>-arm64-debug.apk`（构建产物，不入库）
- 手机需要允许「安装未知应用」
- 未上架应用商店，也还没有正式签名流程

阅读页默认沉浸显示，轻点正文弹出 / 收起上下工具栏；左右翻页模式下左右滑动翻页，最外侧轻点也可以翻页。\r\n\r\n从源码构建：

1. 安装 JDK 17、Android SDK（platform 37 / build-tools 37）和 NDK 27，并执行
   `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
2. `npx tauri android init --ci`
3. 设置 `JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME`、`GRADLE_USER_HOME`（建议都放到非系统盘）
4. `node scripts/build-android.mjs --apk --debug -t aarch64`

Windows 非管理员无法创建符号链接，脚本会在失败后改用 Gradle 直接打包已编译的 `.so`；工程路径含中文时，脚本会自动补上 `android.overridePathCheck=true`。

## 功能

- **EPUB 2 / EPUB 3**：导入、解析元数据、封面、目录与正文
- **TXT 纯文本**：自动识别 UTF-8 / UTF-16 / GBK 编码，识别章节标题，并过滤作者更新说明
- **文件名识别**：从 `书名_作者.txt`、`书名 - 作者.txt`、`《书名》作者.txt` 等文件名自动提取书名和作者
- **本地书库**：使用 IndexedDB 保存书籍文件，重启后仍然可读；支持 EPUB / TXT / PDF / MOBI / AZW3，支持从资源管理器直接拖入
- **书库管理**：批量导入、文件夹监视、重复检测、系列分组、批量添加 / 移除分类、批量删除 / 换封面、按作者和系列排序；删除进入回收站，30 天内可恢复
- **在线书城（Online 版）**：左侧「书城」可浏览线上书城热榜、搜索书名、查看简介，整本下载为 TXT 并自动补全封面；另含 Project Gutenberg 公版书
- **自动更新**：启动静默检查、后台下载，下载完成后提示重启；支持跳过版本，更新包带签名校验
- **国内镜像**：更新包和离线语音支持 GitHub 主源、阿里云 OSS 备用源
- **错误报告**：本地记录崩溃和异常，错误页面可重新加载、导出诊断；设置中可反馈问题或功能建议
- **内置更新日志**：软件内查看当前版本和历史更新内容，更新后首次启动自动显示
- **书库备份**：手动备份 / 每天自动备份，保留最近 8 份；支持从 ZIP 恢复书籍、封面、进度、分类、书签、划线笔记、阅读统计、主题、字体和背景
- **自动续读**：记录阅读位置，重新打开回到上次那一页
- **全文搜索**：搜索整本书的内容，显示章节和上下文，点击结果跳到具体位置
- **书签**：给当前位置添加书签，在阅读助手中快速跳转或删除
- **目录定位**：打开目录自动停在正在读的章节，也可以点「当前章节」一键跳回
- **上一章 / 下一章**：阅读界面底部直接跳到上一章或下一章，首尾自动禁用
- **划线与笔记**：选中正文划线，支持四种颜色、备注、笔记编辑和点击跳回原文
- **阅读统计**：记录每天阅读时长、页数、连续天数，提供最近 7 天和半年热力图
- **两种阅读模式**：左右翻页（按钮 / 滚轮 / 方向键）与上下滚动（一镜到底），默认上下滚动
- **翻书动效**：纸页扫光、3D 翻页、横向滑动、淡入、轻微缩放、无动画六种可选，支持上一页反向动画
- **专注阅读**：进入阅读后左侧导航自动收起，正文占满窗口
- **排版设置**：九套完整主题，字号、字重、行距、宋体 / 黑体切换；支持导入本地字体、双栏、页边距、段间距和实验性竖排
- **个性主题**：自定义背景色、文字色、强调色，内置六套配色，也可导入自己的图片作为阅读背景
- **书架分类**：自己创建分类，书籍可加入多个分类，支持「全部 / 分类 / 未分类」查看
- **统一书架**：左侧固定导航（书架 / 书城），右侧全宽书架网格，阅读进度直接显示在封面下
- **软件设置**：外观主题、本机数据目录、版本与仓库信息
- **九套完整主题**：纸白、茶褐、夜墨、青瓷、樱粉、海盐、暮紫、松烟、深海，同步改变书库、侧栏、设置和阅读界面
- **自定义外观**：背景色、文字色、强调色可自由调整，也支持导入图片作为阅读背景
- **一键卸载**：应用内卸载，询问卸载原因，默认保留书库和阅读进度，也可选择彻底删除本地数据
- **品牌安装程序**：中文安装界面、墨阅头图与侧边图、应用图标
- **自定义封面**：为任意书籍选择本地图片，只修改书库显示，不改写原文件
- **本地音乐**：扫描本地音乐文件夹，支持 MP3 / FLAC / WAV / M4A / AAC / OGG / OPUS
- **音乐播放器**：顺序播放、列表循环、单曲循环、随机播放；上一首 / 下一首、进度、音量；关闭面板后继续播放
- **听书**：用系统中文语音朗读当前章节，从当前位置开始，当前句子在正文中高亮；支持暂停、语速、音色、定时关闭和自动下一章
- **离线自然语音**：可选下载 sherpa-onnx + MeloTTS 中文模型（下载约 190MB，安装后约 245MB），下载后不联网使用更自然的音色

| 阅读界面 | 目录 |
| --- | --- |
| ![阅读界面](docs/reader.png) | ![目录](docs/toc.png) |

| 夜间模式 | 书架进度 |
| --- | --- |
| ![夜间模式](docs/night.png) | ![书架进度](docs/continue.png) |

| TXT 阅读 | 自定义封面 |
| --- | --- |
| ![TXT 阅读](docs/txt.png) | ![自定义封面](docs/cover.png) |

| 上下滚动 | 阅读设置 |
| --- | --- |
| ![上下滚动](docs/scroll.png) | ![阅读设置](docs/typography.png) |

| 书架分类 | 本地音乐 |
| --- | --- |
| ![书架分类](docs/categories.png) | ![音乐](docs/music.png) |

![在线书城（Online 版）](docs/store.png)

| 书架 | 软件设置 |
| --- | --- |
| ![书架](docs/full-shelf.png) | ![软件设置](docs/settings.png) |

| 听书 | 卸载 |
| --- | --- |
| ![听书](docs/tts.png) | ![卸载](docs/uninstall.png) |

| 全文搜索 | 书签 |
| --- | --- |
| ![全文搜索](docs/search.png) | ![书签](docs/bookmarks.png) |

![划线与笔记](docs/highlights.png)

![阅读统计](docs/stats.png)

![自定义主题](docs/custom-theme.png)

![主题预设](docs/themes.png)

![帮助与反馈](docs/feedback.png)

![更新日志](docs/changelog.png)

![书库管理](docs/library-manager.png)

## 技术栈

- **桌面外壳**：Tauri 2（Rust + 系统 WebView2）
- **前端**：React 19 + TypeScript + Vite 8
- **EPUB 渲染**：epub.js
- **TXT 转换**：JSZip 在内存中生成轻量 EPUB
- **本地存储**：IndexedDB（书籍、封面、TXT 原文）+ localStorage（进度、设置、分类、划线、统计）
- **音乐**：HTMLAudioElement + Tauri asset protocol
- **听书**：Web Speech API + Windows 系统中文语音（离线）
- **图标**：Python / Pillow 生成

## 开发环境

### Windows（主要支持平台）

- Node.js 20+
- Rust stable
- Visual Studio C++ Build Tools，勾选「使用 C++ 的桌面开发」
- WebView2 Runtime（Windows 10/11 通常已预装）

### macOS / Linux

需要安装 Tauri 对应的系统依赖，见 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。
当前音乐文件夹的「打开文件夹」按钮仅实现了 Windows 版本。

## 本地开发

```bash
npm install
npm run tauri:dev
```

只构建前端：

```bash
npm run build
```

构建桌面应用：

```bash
npm run tauri:build
```

生成安装包需要在系统中安装 Tauri 的打包依赖（Windows 通常是 NSIS / WiX）。

## 项目结构

```text
.
├─ src/                      # React 前端
│  ├─ components/            # 书架、阅读器、书城、分类、音乐、设置
│  ├─ lib/                   # IndexedDB、EPUB/TXT 解析、书城抓取、分类、进度
│  ├─ App.tsx                # 应用状态与页面组合
│  └─ styles.css             # 主题与全部界面样式
├─ src-tauri/                # Tauri 2 / Rust
│  ├─ src/lib.rs             # 应用入口、音乐目录与文件扫描命令
│  ├─ capabilities/          # 窗口权限
│  ├─ icons/                 # 应用图标
│  ├─ installer/             # 安装程序头图、侧边图和中文文案
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ public/
│  └─ sample.epub            # 内置示例书（原创内容）
├─ scripts/                  # 图标、示例书等开发脚本
├─ docs/                     # README 截图
├─ package.json
├─ package-lock.json
├─ LICENSE
└─ README.md
```

## 数据保存位置

应用不会把书籍和阅读数据上传到网络。

- WebView2 应用数据（书库、进度、分类、设置）：
  `%LOCALAPPDATA%\com.moyue.reader\EBWebView`
- 音乐文件夹：
  `%APPDATA%\com.moyue.reader\music`
- 书库备份：
  `%LOCALAPPDATA%\com.moyue.reader\backups`
- 应用安装目录：
  `%LOCALAPPDATA%\Moyue`

把歌曲文件放进音乐文件夹，打开音乐面板后点「刷新」即可。





## 书城（Online 版）

Online 版的左侧导航多一个「书城」，和书架共用同一条导航栏。书城有两个来源，可以在顶部切换：

- **线上书城**：玄幻、仙侠、都市、历史等 16 个分类，按分类翻页浏览；也可以按完整书名搜索（站点不支持模糊搜索）。
- **公版书**：Project Gutenberg 的 OPDS 目录，直接下载公版 EPUB。

选中一本书可以「下载并阅读」或「只放进书架」：

- 线上书城的整本 TXT 按 500 章分段下载，合并时去掉每段重复的书名、作者、来源等页眉页脚，再转成 UTF-8 保存
- 导入时按 `书名_作者.txt` 命名，书架能识别书名和作者，并把站点封面存进书库
- 连载中的书站点不支持整本打包，程序会自动改走分段下载，不需要手动处理
- 书城页面和下载都走 Rust 端请求：站点没有 CORS 头，WebView 里直接 `fetch` 读不到

页面解析与下载逻辑在 `src/lib/onlineStore.ts`，界面在 `src/components/BookStore.tsx`，Rust 命令在 `src-tauri/src/lib.rs`。

书城内容来自第三方站点，请在合法范围内使用。

## 听书

阅读界面右上角的耳机按钮打开听书面板：

- 使用 Windows 系统语音，不需要联网
- 可选择「离线自然语音」，首次需下载约 190MB（安装后约 245MB），之后完全离线
- 从当前位置开始朗读，当前句子在正文中高亮
- 读完当前章节自动进入下一章
- 暂停 / 继续、语速调节、中文音色选择
- 平静 / 叙事 / 悬疑 / 轻快四种朗读风格，按标点自动调整节奏和停顿
- 15 / 30 / 60 分钟定时关闭
- 关闭面板后继续朗读，左下角显示迷你播放条

当前版本支持句子高亮，但不会逐字高亮。音色取决于所选引擎：系统语音使用 Windows 已安装的语音；也可以在听书设置中下载离线自然语音。如果系统只有英文语音，可以在 Windows「设置 → 时间和语言 → 语音」中安装中文语音。

## 发布

发布流程和阿里云 OSS 自动镜像配置见 [docs/RELEASE.md](docs/RELEASE.md)。

## 官网

单页下载站源码位于 [`site/`](site/)，可直接上传到阿里云 OSS 静态托管，自动读取 `updates/latest.json` 和 `updates/online/latest.json` 获取两个版本的最新版本号。部署说明见 [site/README.md](site/README.md)。

如果使用 GitHub Pages，地址为：<https://langlijun666.github.io/moyue-reader/>

![官网首页](docs/website.png)

## 书库备份

在「软件设置 → 书库备份」中：

- **立即备份**：生成一个包含书籍文件、封面、进度、分类、书签、划线笔记、阅读统计、主题、字体和背景的 ZIP
- **自动备份**：每天首次打开时自动备份一次，保留最近 8 份
- **恢复备份**：选择 `.zip` 备份文件恢复
  - 恢复前会先自动备份当前书库
  - 采用合并方式，不会删除备份中没有的现有书籍
  - 同一本书会以备份中的版本为准

备份保存在：

```text
%LOCALAPPDATA%\com.moyue.reader\backups
```

备份不包含音乐文件夹中的歌曲。

## 阅读助手

阅读界面右上角的搜索按钮打开阅读助手，也可以按 `Ctrl+F`。

### 全文搜索

- 输入至少两个字，搜索整本书
- 首次搜索会建立索引，长书可能需要几秒
- 结果显示章节、上下文和匹配高亮
- 点击结果跳到具体匹配位置，而不是只跳到章节开头

### 书签

- 切换到「书签」标签
- 点击「添加当前位置书签」
- 点击书签跳转，点击垃圾桶删除
- 书签按书籍分别保存，重启后仍然保留

## 软件设置与卸载

点击书架底部的齿轮按钮打开「软件设置」：

- 切换纸白 / 茶褐 / 夜墨主题
- 查看本机数据目录，并直接打开文件夹
- 查看版本、GitHub 仓库和开源许可证
- 进入卸载流程

卸载时会先询问原因，并给出两个选项：

- **默认**：只卸载程序，保留书库、阅读进度、分类和设置
- **勾选删除本地数据**：同时清除书库、阅读进度、分类和设置，不可恢复
- 音乐文件夹里的歌曲始终不会被卸载程序删除

确认后会关闭墨阅并启动 NSIS 卸载程序。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `←` / `PageUp` | 上一页 |
| `→` / `PageDown` / `Space` | 下一页 |
| 鼠标滚轮向下 / 向上 | 左右翻页模式：下一页 / 上一页；滚动模式：向下 / 向上滚动 |
| `Ctrl+F` | 打开全文搜索 |
| `Ctrl+O` | 导入 EPUB / TXT / PDF / MOBI / AZW3 |
| `Esc` | 关闭目录 / 设置 / 分类弹窗 |

> 上下滚动模式下，滚轮和方向键直接滚动正文，不再触发翻页动画。

## 已知限制

- EPUB、TXT、PDF、MOBI、AZW3 均已支持；PDF 第一版暂不支持划线和朗读，MOBI/AZW3 仅支持无 DRM 文件
- TXT 章节识别依赖常见标题格式；没有标题时会按长度自动分节
- 音乐只读取本地文件夹，不读取音频内嵌标签；歌名 / 歌手按文件名解析
- 听书使用系统 TTS 或可选离线神经语音，音色取决于所选引擎
- 竖排为实验性功能，仅支持单栏左右翻页；双栏仅用于左右翻页模式
- Online 版书城需要联网；线上书城只支持完整书名搜索，目录最多显示 1000 章，整本下载依赖站点打包
- 音乐「打开文件夹」目前只支持 Windows
- 安装包暂未使用 Windows 代码签名证书，首次安装可能触发 SmartScreen；自动更新使用独立的 minisign 签名校验
- 本地数据保存在 WebView2 中；清除应用数据会同时清除书库和进度
- Android 版暂不含音乐、离线听书和自动更新；文件导入和系统分享还在真机验证阶段

## 贡献

欢迎提交 issue 和 pull request。开发说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

反馈邮箱：`xuxinyang121@gmail.com`

## 支持墨阅

如果墨阅帮你省下了一点时间，可以请我喝杯咖啡。

赞助是一次性的，不会解锁任何功能，所有功能仍然免费。赞助主要用于代码签名证书、域名和后续开发。

| 支付宝 | 微信支付 |
| --- | --- |
| <img src="docs/sponsor-alipay.png" width="260" alt="支付宝赞助二维码"> | <img src="docs/sponsor-wechat.png" width="260" alt="微信支付赞助二维码"> |

付款前请确认收款方为「浪里君」。

赞助后如果想出现在公开感谢名单，可以提交[赞助登记](https://github.com/Langlijun666/moyue-reader/issues/new?template=sponsorship.yml)。名单只显示昵称，不显示金额或付款信息。

### 感谢支持者

- 浪里君

## 更新记录

见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE)
