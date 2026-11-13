# 墨阅下载站

纯静态单页，无构建步骤，直接上传到 OSS 即可。

## 文件

```text
index.html
styles.css
app.js
assets/
  icon.png
  reader.png
  themes.png
  stats.png
  highlights.png
  tts.png
  library-manager.png
  typography.png
```

## 推荐部署方式

把网站放在 **现有的 `moyue-release-files` Bucket 根目录**，和 `updates/`、`tts/` 同级：

```text
moyue-release-files/
  index.html
  styles.css
  app.js
  assets/
  updates/
    latest.json
    Moyue_0.21.1_x64-setup.exe
    Moyue_0.21.1_x64-setup.exe.sig
  tts/
    sherpa-onnx.tar.bz2
    vits-melo-tts-zh_en.tar.bz2
```

这样网页里的 `updates/latest.json` 是同源请求，不需要配置 CORS。

### 上传

在 OSS 控制台的 Bucket 根目录：

1. 上传 `index.html`、`styles.css`、`app.js`
2. 新建 `assets` 目录，上传 `assets/` 里的所有图片
3. 保留已有 `updates/` 和 `tts/`，不要覆盖或删除

### 开启静态网站

Bucket 配置 → 静态页面：

- 默认首页：`index.html`
- 默认 404 页：可留空

开启后访问：

```text
https://moyue-release-files.oss-cn-hangzhou.aliyuncs.com/
```

未开启静态页面时，也可以直接访问：

```text
https://moyue-release-files.oss-cn-hangzhou.aliyuncs.com/index.html
```

## 更新版本

网站会自动读取：

```text
updates/latest.json
```

每次发布新版本后，只要 OSS 的 `latest.json` 更新，网页上的版本号和下载按钮会自动变化，不需要重新上传网页。

如果同源读取失败，会依次尝试：

1. OSS 绝对地址 `updates/latest.json`
2. GitHub Releases API
3. GitHub Releases 页面

## 注意

- Bucket 权限：公共读，私有写
- 不要开放公共读写
- 不要上传用户数据、AccessKey、私钥
- 自定义域名/CDN 需要备案；默认 OSS 域名不需要
- 免费试用流量有限，语音模型不要反复下载
