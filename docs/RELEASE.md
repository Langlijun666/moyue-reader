# 发布与 OSS 镜像

## 自动发布

推送 `v*` 标签后，Release 工作流会：

1. 构建 Windows NSIS 安装包
2. 上传 GitHub Release
3. 生成指向 OSS 的 `latest.json`
4. 上传安装包、签名和 `latest.json` 到 OSS
5. 通过 Tauri 签名保证 OSS 文件没有被篡改

### 一次性配置

在阿里云创建 RAM 用户，只授予这个 Bucket 的上传权限：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject"],
      "Resource": ["acs:oss:*:*:moyue-release-files/updates/*"]
    }
  ]
}
```

不要使用主账号 AccessKey。

在 GitHub 仓库 Settings → Secrets and variables → Actions 添加：

```text
ALIYUN_OSS_ACCESS_KEY_ID
ALIYUN_OSS_ACCESS_KEY_SECRET
```

### 发布

```powershell
npm version 0.22.0 --no-git-tag-version
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "Release 0.22.0"
git tag v0.22.0
git push origin main
git push origin v0.22.0
```

工作流成功后，检查：

```text
https://moyue-release-files.oss-cn-hangzhou.aliyuncs.com/updates/latest.json
```

里面应该包含新版本号，并且 `url` 指向 OSS。

## 语音模型

语音引擎和模型文件很大，不需要每次发版都上传。

只有更新模型时才手动替换：

```text
tts/sherpa-onnx.tar.bz2
tts/vits-melo-tts-zh_en.tar.bz2
```

替换后同步更新 Rust 里的 SHA256 常量。

## 网站

网站源码在 `site/`。

推送 `main` 且 `site/**` 有变化时，GitHub Actions 会自动部署 GitHub Pages：

```text
https://langlijun666.github.io/moyue-reader/
```

下载按钮会自动读取版本，并指向 OSS 安装包。
