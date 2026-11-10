# 墨阅 · Moyue

一个安静、本地优先的桌面 EPUB / TXT 阅读器，带书架分类和本地音乐播放。

没有账号，没有云端同步。书籍、阅读进度、分类和音乐都留在这台电脑上。

![墨阅首页](docs/home.png)

## 功能

- **EPUB 2 / EPUB 3**：导入、解析元数据、封面、目录与正文
- **TXT 纯文本**：自动识别 UTF-8 / UTF-16 / GBK 编码，识别章节标题，并过滤作者更新说明
- **文件名识别**：从 `书名_作者.txt`、`书名 - 作者.txt`、`《书名》作者.txt` 等文件名自动提取书名和作者
- **本地书库**：使用 IndexedDB 保存书籍文件，重启后仍然可读
- **自动续读**：记录阅读位置，重新打开回到上次那一页
- **两种阅读模式**：左右翻页（按钮 / 滚轮 / 方向键）与上下滚动（一镜到底）
- **翻书动效**：左右翻页时书页和光影扫过，支持上一页反向动画
- **专注阅读**：一键隐藏左侧书架，让正文占满窗口
- **排版设置**：纸白 / 茶褐 / 夜墨三种主题，字号、字重、行距、宋体 / 黑体切换
- **书架分类**：自己创建分类，书籍可加入多个分类，支持「全部 / 分类 / 未分类」查看
- **自定义封面**：为任意书籍选择本地图片，只修改书库显示，不改写原文件
- **本地音乐**：扫描本地音乐文件夹，支持 MP3 / FLAC / WAV / M4A / AAC / OGG / OPUS
- **音乐播放器**：列表播放、上一首 / 下一首、进度、音量；关闭面板后继续播放

| 阅读界面 | 目录 |
| --- | --- |
| ![阅读界面](docs/reader.png) | ![目录](docs/toc.png) |

| 夜间模式 | 继续阅读 |
| --- | --- |
| ![夜间模式](docs/night.png) | ![继续阅读](docs/continue.png) |

| TXT 阅读 | 自定义封面 |
| --- | --- |
| ![TXT 阅读](docs/txt.png) | ![自定义封面](docs/cover.png) |

| 上下滚动 | 专注阅读 |
| --- | --- |
| ![上下滚动](docs/scroll.png) | ![专注阅读](docs/focus.png) |

| 书架分类 | 本地音乐 |
| --- | --- |
| ![书架分类](docs/categories.png) | ![音乐](docs/music.png) |

## 技术栈

- **桌面外壳**：Tauri 2（Rust + 系统 WebView2）
- **前端**：React 19 + TypeScript + Vite 8
- **EPUB 渲染**：epub.js
- **TXT 转换**：JSZip 在内存中生成轻量 EPUB
- **本地存储**：IndexedDB（书籍、封面、TXT 原文）+ localStorage（进度、设置、分类）
- **音乐**：HTMLAudioElement + Tauri asset protocol
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
│  ├─ components/            # 书架、阅读器、分类、音乐、设置
│  ├─ lib/                   # IndexedDB、EPUB/TXT 解析、分类、进度
│  ├─ App.tsx                # 应用状态与页面组合
│  └─ styles.css             # 主题与全部界面样式
├─ src-tauri/                # Tauri 2 / Rust
│  ├─ src/lib.rs             # 应用入口、音乐目录与文件扫描命令
│  ├─ capabilities/          # 窗口权限
│  ├─ icons/                 # 应用图标
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
- 应用安装目录：
  `%LOCALAPPDATA%\Programs\Moyue`

把歌曲文件放进音乐文件夹，打开音乐面板后点「刷新」即可。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `←` / `PageUp` | 上一页 |
| `→` / `PageDown` / `Space` | 下一页 |
| 鼠标滚轮向下 / 向上 | 左右翻页模式：下一页 / 上一页；滚动模式：向下 / 向上滚动 |
| `Ctrl+B` | 隐藏 / 显示左侧书架 |
| `Ctrl+O` | 导入 EPUB / TXT |
| `Esc` | 关闭目录 / 设置 / 分类弹窗 |

> 上下滚动模式下，滚轮和方向键直接滚动正文，不再触发翻页动画。

## 已知限制

- EPUB 和 TXT 是主要支持的格式，PDF、MOBI、AZW3 尚未支持
- 尚无全文搜索、划线批注、书签列表和多栏排版
- TXT 章节识别依赖常见标题格式；没有标题时会按长度自动分节
- 音乐只读取本地文件夹，不读取音频内嵌标签；歌名 / 歌手按文件名解析
- 音乐「打开文件夹」目前只支持 Windows
- 本地数据保存在 WebView2 中；清除应用数据会同时清除书库和进度

## 贡献

欢迎提交 issue 和 pull request。开发说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)
